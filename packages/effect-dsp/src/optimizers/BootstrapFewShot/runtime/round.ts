/**
 * Scores complete runs and collects destination-owned demonstrations.
 *
 * @since 0.1.0
 * @internal
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import {
  Array as Arr,
  Boolean as Bool,
  Data,
  Effect,
  Number as Num,
  Option,
  Predicate,
  Ref,
  Schema,
  String,
  Tuple
} from "effect"
import type * as Layer from "effect/Layer"
import { withModuleParamsDemos, withModuleParamsDemosAndInstructions } from "../../../contracts/ModuleParams.js"
import { BootstrapFailed } from "../../../Errors/optimizer.js"
import { Demo, type Example } from "../../../Example/index.js"
import type { Metric } from "../../../Metric/model.js"
import type { Module } from "../../../Module/model.js"
import { BootstrapEvent, type BootstrapEvent as BootstrapEventType } from "../../../Optimizer/events/bootstrap.js"
import { withTracing } from "../../../Trace/index.js"
import type { BootstrapExamples } from "../index.js"
import { mergeAcceptedDemos, roundInstructions } from "./demos.js"
import { AcceptedDemo, BootstrapState, demoCount, ExampleEvaluation, PredictorDemos, RoundEvaluation } from "./model.js"

/**
 * Receives each bootstrap event before optimization advances.
 * @since 0.1.0
 * @category type-level
 */
export type BootstrapEventSink = (event: BootstrapEventType) => Effect.Effect<void>

/** @internal */
export class BootstrapRoundOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR,
  E,
  R
> extends Data.Class<{
  readonly state: BootstrapState
  readonly module: Module<I, O, E, R>
  readonly trainset: BootstrapExamples
  readonly metric: Metric<ME, MR, Schema.Schema.Type<Schema.Struct<O>>>
  readonly threshold: number
  readonly emit: BootstrapEventSink
  readonly teacher: Option.Option<Layer.Layer<LanguageModel.LanguageModel, never, never>>
  readonly maxBootstrappedDemos: number
  readonly maxRounds: number
}> {}

const provideTeacherLayer = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  teacher: Option.Option<Layer.Layer<LanguageModel.LanguageModel, never, never>>
): Effect.Effect<A, E, R> =>
  Option.match(teacher, {
    onNone: () => effect,
    onSome: (layer) => effect.pipe(Effect.provide(layer))
  })

const evaluateExample = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>(
  options: BootstrapRoundOptions<I, O, ME, MR, E, R>,
  example: Example
) =>
  Effect.gen(function*() {
    const input = yield* Schema.decodeUnknown(options.module.signature.inputSchema)(example.input)
    const expected = yield* Option.match(Option.fromNullable(example.output), {
      onNone: () =>
        Effect.fail(
          new BootstrapFailed({
            message: "BootstrapFewShot requires labeled examples",
            roundsAttempted: options.state.roundsAttempted,
            totalTraces: options.state.totalTraces
          })
        ),
      onSome: (output) =>
        Schema.decodeUnknown(options.module.signature.outputSchema)(output).pipe(
          Effect.mapError(() =>
            new BootstrapFailed({
              message: "expected output does not match module output schema",
              roundsAttempted: options.state.roundsAttempted,
              totalTraces: options.state.totalTraces
            })
          )
        )
    })
    const traced = yield* withTracing(provideTeacherLayer(options.module.forward(input), options.teacher))
    const result = Tuple.getFirst(traced)
    const metric = yield* options.metric.score(result, expected)
    const entries = Arr.filter(
      Tuple.getSecond(traced),
      Predicate.and(
        (entry) => String.Equivalence(entry.outcome, "completed"),
        (entry) =>
          Arr.some(options.state.predictors, (predictor) => String.Equivalence(predictor.owner.name, entry.moduleName))
      )
    )
    const accepted = Bool.and(
      Bool.and(Schema.is(Schema.NonNaN)(metric.score), Schema.is(Schema.NonNaN)(options.threshold)),
      Num.greaterThanOrEqualTo(metric.score, options.threshold)
    )
    const demos = yield* Effect.if(accepted, {
      onFalse: () => Effect.succeed(Arr.empty<AcceptedDemo>()),
      onTrue: () =>
        Effect.gen(function*() {
          // A composed root need not make an LM call. Its successful typed result
          // still owns a root demo; child demos come only from completed traces.
          const rootTrace = Arr.findLast(entries, (entry) => String.Equivalence(entry.moduleName, options.module.name))
          const rootDemo = yield* Option.match(rootTrace, {
            onSome: (entry) => options.module.signature.demoContract.fromTrace(entry.input, entry.output),
            onNone: () =>
              Effect.gen(function*() {
                return new Demo({
                  input: yield* Schema.encode(options.module.signature.inputSchema)(input),
                  output: yield* Schema.encode(options.module.signature.outputSchema)(result)
                })
              })
          })
          const root = new AcceptedDemo({
            name: options.module.name,
            demo: rootDemo
          })
          const stages = yield* Effect.forEach(
            Arr.filter(
              options.state.predictors,
              (predictor) => Bool.not(String.Equivalence(predictor.owner.name, options.module.name))
            ),
            (predictor) =>
              Effect.forEach(
                Arr.filter(entries, (entry) => String.Equivalence(entry.moduleName, predictor.owner.name)),
                (entry) =>
                  predictor.owner.demoContract.fromTrace(entry.input, entry.output).pipe(
                    Effect.map((demo) => new AcceptedDemo({ name: predictor.owner.name, demo }))
                  )
              )
          )
          return Arr.prepend(Arr.flatten(stages), root)
        })
    })
    yield* Effect.forEach(entries, (entry) =>
      options.emit(Bool.match(accepted, {
        onTrue: () => BootstrapEvent.TraceAccepted({ moduleName: entry.moduleName, score: metric.score }),
        onFalse: () =>
          BootstrapEvent.TraceRejected({
            moduleName: entry.moduleName,
            score: metric.score,
            threshold: options.threshold
          })
      })), { discard: true })
    return new ExampleEvaluation({
      demos,
      traceCount: Arr.length(entries),
      acceptedCount: Bool.match(accepted, { onTrue: () => Arr.length(entries), onFalse: () => 0 }),
      rejectedCount: Bool.match(accepted, { onFalse: () => Arr.length(entries), onTrue: () => 0 }),
      score: metric.score
    })
  })

const aggregateRound = (evaluations: Iterable<ExampleEvaluation>): RoundEvaluation =>
  Arr.reduce(
    evaluations,
    new RoundEvaluation({
      acceptedDemos: Arr.empty(),
      traceCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      evaluatedCount: 0,
      scoreSum: 0,
      bestScoreSeen: false,
      bestScore: 0
    }),
    (state, evaluation) =>
      new RoundEvaluation({
        acceptedDemos: Arr.appendAll(state.acceptedDemos, evaluation.demos),
        traceCount: Num.sum(state.traceCount, evaluation.traceCount),
        acceptedCount: Num.sum(state.acceptedCount, evaluation.acceptedCount),
        rejectedCount: Num.sum(state.rejectedCount, evaluation.rejectedCount),
        evaluatedCount: Num.increment(state.evaluatedCount),
        scoreSum: Num.sum(state.scoreSum, evaluation.score),
        bestScoreSeen: true,
        bestScore: Bool.match(state.bestScoreSeen, {
          onFalse: () => evaluation.score,
          onTrue: () => Numeric.max(state.bestScore, evaluation.score)
        })
      })
  )

export const bootstrapRound = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>(
  options: BootstrapRoundOptions<I, O, ME, MR, E, R>
) =>
  Effect.gen(function*() {
    yield* options.emit(BootstrapEvent.RoundStarted({ round: options.state.round, maxRounds: options.maxRounds }))
    const round = yield* Effect.acquireUseRelease(
      Effect.forEach(options.state.predictors, (predictor) =>
        Ref.get(predictor.owner.params).pipe(
          Effect.map((params) => new PredictorDemos({ owner: predictor.owner, params }))
        )),
      () =>
        Effect.gen(function*() {
          yield* Effect.forEach(options.state.predictors, (predictor) =>
            Ref.set(
              predictor.owner.params,
              withModuleParamsDemosAndInstructions(
                predictor.params,
                predictor.params.demos,
                roundInstructions(predictor.params.instructions, options.state.round)
              )
            ), { discard: true })
          return aggregateRound(
            yield* Effect.forEach(options.trainset, (example) => evaluateExample(options, example), {
              concurrency: "inherit"
            })
          )
        }),
      (snapshots) =>
        Effect.forEach(snapshots, (snapshot) => Ref.set(snapshot.owner.params, snapshot.params), { discard: true })
    )
    const predictors = yield* Effect.forEach(options.state.predictors, (predictor) =>
      mergeAcceptedDemos({
        existing: predictor.params.demos,
        accepted: Arr.map(
          Arr.filter(round.acceptedDemos, (entry) => String.Equivalence(entry.name, predictor.owner.name)),
          (entry) => entry.demo
        ),
        maxBootstrappedDemos: options.maxBootstrappedDemos,
        contract: predictor.owner.demoContract
      }).pipe(Effect.map((merged) =>
        new PredictorDemos({
          owner: predictor.owner,
          params: withModuleParamsDemos(predictor.params, merged.demos)
        })
      )))
    yield* Effect.forEach(predictors, (predictor) => Ref.set(predictor.owner.params, predictor.params), {
      discard: true
    })
      .pipe(Effect.uninterruptible)
    yield* options.emit(
      BootstrapEvent.RoundCompleted({ round: options.state.round, demosCollected: demoCount(predictors) })
    )
    return new BootstrapState({
      round: Num.increment(options.state.round),
      roundsAttempted: Num.increment(options.state.roundsAttempted),
      predictors,
      totalTraces: Num.sum(options.state.totalTraces, round.traceCount),
      acceptedTraces: Num.sum(options.state.acceptedTraces, round.acceptedCount),
      rejectedTraces: Num.sum(options.state.rejectedTraces, round.rejectedCount),
      evaluatedExamples: Num.sum(options.state.evaluatedExamples, round.evaluatedCount),
      scoreSum: Num.sum(options.state.scoreSum, round.scoreSum),
      bestScoreSeen: Bool.or(options.state.bestScoreSeen, round.bestScoreSeen),
      bestScore: Bool.match(options.state.bestScoreSeen, {
        onFalse: () => round.bestScore,
        onTrue: () =>
          Bool.match(round.bestScoreSeen, {
            onFalse: () => options.state.bestScore,
            onTrue: () => Numeric.max(options.state.bestScore, round.bestScore)
          })
      }),
      fallbackUsed: options.state.fallbackUsed,
      continue: Num.greaterThan(demoCount(predictors), demoCount(options.state.predictors))
    })
  })
