/**
 * Scores complete runs and collects destination-owned demonstrations.
 *
 * @since 0.1.0
 * @internal
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import {
  Array as Arr,
  Boolean as Bool,
  Data,
  Effect,
  Equivalence,
  Number as Num,
  Option,
  Predicate,
  Record,
  Schema,
  String,
  Tuple
} from "effect"
import type * as LanguageModel from "effect/ai/LanguageModel"
import type * as Layer from "effect/Layer"
import { events, type EventSink, type Examples } from "../../../BootstrapFewShot.js"
import { Demonstration as Demo } from "../../../Demonstration.js"
import { BootstrapFailed } from "../../../DspError.js"
import type { Example } from "../../../Example.js"
import type { Metric } from "../../../Metric.js"
import { type Module, withParameters } from "../../../Module.js"
import {
  withDemos as withModuleParamsDemos,
  withDemosAndInstructions as withModuleParamsDemosAndInstructions
} from "../../../ModuleParameters.js"
import { withTracing } from "../../../Trace.js"
import { CurrentRole } from "../../modelRole.js"
import { mergeAcceptedDemos, MergeAcceptedDemosOptions, roundInstructions } from "./demos.js"
import { AcceptedDemo, BootstrapState, demoCount, ExampleEvaluation, PredictorDemos, RoundEvaluation } from "./model.js"

/** @internal */
export class BootstrapRoundOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR,
  E,
  R,
  EE,
  ER
> extends Data.Class<{
  readonly state: BootstrapState
  readonly module: Module<I, O, E, R>
  readonly trainset: Examples
  readonly metric: Metric<ME, MR, Schema.Schema.Type<Schema.Struct<O>>>
  readonly threshold: number
  readonly emit: EventSink<EE, ER>
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

const evaluateExample = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R, EE, ER>(
  options: BootstrapRoundOptions<I, O, ME, MR, E, R, EE, ER>,
  example: Example
) =>
  Effect.gen(function*() {
    const input = yield* Schema.decodeEffect(options.module.signature.inputSchema)(example.input)
    const expected = yield* Option.match(Option.fromNullishOr(example.output), {
      onNone: () =>
        Effect.fail(
          new BootstrapFailed({
            message: "BootstrapFewShot requires labeled examples",
            roundsAttempted: options.state.roundsAttempted,
            totalTraces: options.state.totalTraces,
            threshold: options.threshold,
            acceptedTraces: options.state.acceptedTraces,
            rejectedTraces: options.state.rejectedTraces,
            evaluatedExamples: options.state.evaluatedExamples,
            bestScoreSeen: options.state.bestScoreSeen,
            bestScore: options.state.bestScore,
            averageScore: 0
          })
        ),
      onSome: (output) =>
        Schema.decodeEffect(options.module.signature.outputSchema)(output).pipe(
          Effect.mapError(() =>
            new BootstrapFailed({
              message: "expected output does not match module output schema",
              roundsAttempted: options.state.roundsAttempted,
              totalTraces: options.state.totalTraces,
              threshold: options.threshold,
              acceptedTraces: options.state.acceptedTraces,
              rejectedTraces: options.state.rejectedTraces,
              evaluatedExamples: options.state.evaluatedExamples,
              bestScoreSeen: options.state.bestScoreSeen,
              bestScore: options.state.bestScore,
              averageScore: 0
            })
          )
        )
    })
    const traced = yield* withTracing(provideTeacherLayer(options.module.forward(input), options.teacher)).pipe(
      Effect.provideService(CurrentRole, "teacher")
    )
    const result = traced[0]
    const metric = yield* options.metric.score(result, expected)
    const entries = Arr.filter(
      traced[1],
      Predicate.and(
        (entry) => String.Equivalence(entry.outcome, "completed"),
        (entry) =>
          Arr.some(options.state.predictors, (predictor) => String.Equivalence(predictor.owner.name, entry.moduleName))
      )
    )
    const accepted = Bool.and(
      Bool.and(
        Equivalence.strictEqual<number>()(metric.score, metric.score),
        Equivalence.strictEqual<number>()(options.threshold, options.threshold)
      ),
      Num.isGreaterThanOrEqualTo(metric.score, options.threshold)
    )
    const demos = yield* Bool.match(accepted, {
      onFalse: () => Effect.succeed(Arr.empty<AcceptedDemo>()),
      onTrue: () =>
        Effect.gen(function*() {
          // A composed root need not make an LM call. Its successful typed result
          // still owns a root demo; child demos come only from completed traces.
          const rootTrace = Arr.findLast(entries, (entry) => String.Equivalence(entry.moduleName, options.module.name))
          const rootDemo = yield* Option.match(rootTrace, {
            onSome: (entry) => options.module.signature.demonstrationCodec.decodeDocuments(entry.input, entry.output),
            onNone: () =>
              Effect.gen(function*() {
                return new Demo({
                  input: yield* Schema.encodeUnknownEffect(options.module.signature.inputSchema)(input),
                  output: yield* Schema.encodeUnknownEffect(options.module.signature.outputSchema)(result)
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
                  predictor.owner.demonstrationCodec.decodeDocuments(entry.input, entry.output).pipe(
                    Effect.map((demo) => new AcceptedDemo({ name: predictor.owner.name, demo }))
                  )
              )
          )
          return Arr.prepend(Arr.flatten(stages), root)
        })
    })
    yield* Effect.forEach(entries, (entry) =>
      options.emit(Bool.match(accepted, {
        onTrue: () => events.TraceAccepted({ moduleName: entry.moduleName, score: metric.score }),
        onFalse: () =>
          events.TraceRejected({
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

export const bootstrapRound = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R, EE, ER>(
  options: BootstrapRoundOptions<I, O, ME, MR, E, R, EE, ER>
) =>
  Effect.gen(function*() {
    yield* options.emit(events.RoundStarted({ round: options.state.round, maxRounds: options.maxRounds }))
    const parameters = Record.fromEntries(Arr.map(options.state.predictors, (predictor) =>
      Tuple.make(
        predictor.owner.id,
        withModuleParamsDemosAndInstructions(
          predictor.params,
          predictor.params.demos,
          roundInstructions(predictor.params.instructions, options.state.round)
        )
      )))
    const round = aggregateRound(
      yield* Effect.forEach(options.trainset, (example) => evaluateExample(options, example), {
        concurrency: "unbounded"
      }).pipe(withParameters(parameters))
    )
    const predictors = yield* Effect.forEach(options.state.predictors, (predictor) =>
      mergeAcceptedDemos(
        new MergeAcceptedDemosOptions({
          existing: predictor.params.demos,
          accepted: Arr.map(
            Arr.filter(round.acceptedDemos, (entry) => String.Equivalence(entry.name, predictor.owner.name)),
            (entry) => entry.demo
          ),
          maxBootstrappedDemos: options.maxBootstrappedDemos,
          contract: predictor.owner.demonstrationCodec
        })
      ).pipe(Effect.map((merged) =>
        new PredictorDemos({
          owner: predictor.owner,
          params: withModuleParamsDemos(predictor.params, merged.demos)
        })
      )))
    yield* options.emit(
      events.RoundCompleted({ round: options.state.round, demosCollected: demoCount(predictors) })
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
      continue: Num.isGreaterThan(demoCount(predictors), demoCount(options.state.predictors))
    })
  })
