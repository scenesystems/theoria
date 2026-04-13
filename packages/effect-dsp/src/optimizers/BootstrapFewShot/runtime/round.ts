/**
 * BootstrapFewShot round execution — runs one training example, scores the
 * trace, and collects the demo if it passes the threshold.
 *
 * @since 0.1.0
 * @internal
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { Array as Arr, Effect, Option, Ref, Schema } from "effect"
import type * as Layer from "effect/Layer"
import { MetricPayload } from "../../../contracts/MetricFn.js"
import { withModuleParamsDemosAndInstructions } from "../../../contracts/ModuleParams.js"
import { BootstrapFailed } from "../../../Errors/optimizer.js"
import { Demo, type Example } from "../../../Example/index.js"
import { MetricContext } from "../../../Metric/context.js"
import type { Metric } from "../../../Metric/model.js"
import type { Module } from "../../../Module/model.js"
import { BootstrapEvent, type BootstrapEvent as BootstrapEventType } from "../../../Optimizer/events/bootstrap.js"
import { withTracing } from "../../../Trace/index.js"
import { mergeAcceptedDemos, roundInstructions } from "./demos.js"
import { BootstrapState, ExampleEvaluation, RoundEvaluation } from "./model.js"

// Per-example scoring and round-level aggregation are co-located because
// round telemetry fields share the same acceptance semantics.

const emptyRoundEvaluation = new RoundEvaluation({
  acceptedDemos: Arr.empty<Demo>(),
  traceCount: 0,
  acceptedCount: 0,
  rejectedCount: 0,
  evaluatedCount: 0,
  scoreSum: 0,
  bestScoreSeen: false,
  bestScore: 0
})

export type BootstrapEventSink = (event: BootstrapEventType) => Effect.Effect<void>

const decodeMetricPayload = (payload: unknown) =>
  Schema.decodeUnknown(MetricPayload)(payload).pipe(
    Effect.mapError(
      () =>
        new BootstrapFailed({
          message: "BootstrapFewShot requires metric payloads compatible with MetricPayload",
          roundsAttempted: 0,
          totalTraces: 0,
          threshold: 0,
          acceptedTraces: 0,
          rejectedTraces: 0,
          evaluatedExamples: 0,
          bestScoreSeen: false,
          bestScore: 0,
          averageScore: 0
        })
    )
  )

const decodeMetricPayloadOrEmpty = (payload: unknown) =>
  Schema.decodeUnknown(MetricPayload)(payload).pipe(
    Effect.orElseSucceed(() => ({}))
  )

const provideTeacherLayer = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  teacher: Option.Option<Layer.Layer<LanguageModel.LanguageModel, never, never>>
): Effect.Effect<A, E, R> =>
  Option.match(teacher, {
    onNone: () => effect,
    onSome: (layer) => effect.pipe(Effect.provide(layer))
  })

const evaluateExample = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR
>(options: {
  readonly module: Module<I, O>
  readonly example: Example
  readonly metric: Metric<ME, MR>
  readonly threshold: number
  readonly emit: BootstrapEventSink
  readonly teacher: Option.Option<Layer.Layer<LanguageModel.LanguageModel, never, never>>
}) =>
  Effect.gen(function*() {
    const decodedInput = yield* Schema.decodeUnknown(options.module.signature.inputSchema)(options.example.input)
    const inputPayload = yield* decodeMetricPayloadOrEmpty(options.example.input)
    const expectedOutput = yield* Option.match(Option.fromNullable(options.example.output), {
      onNone: () =>
        Effect.fail(
          new BootstrapFailed({
            message: "BootstrapFewShot requires labeled examples",
            roundsAttempted: 0,
            totalTraces: 0,
            threshold: options.threshold,
            acceptedTraces: 0,
            rejectedTraces: 0,
            evaluatedExamples: 0,
            bestScoreSeen: false,
            bestScore: 0,
            averageScore: 0
          })
        ),
      onSome: (output) => Effect.succeed(output)
    })
    const expectedPayload = yield* decodeMetricPayload(expectedOutput)
    const traced = yield* withTracing(
      provideTeacherLayer(options.module.forward(decodedInput), options.teacher)
    )
    const predictionPayload = yield* decodeMetricPayload(traced[0])
    const metricResult = yield* options.metric.scoreContext(
      Option.fromNullable(options.example.metadata).pipe(
        Option.match({
          onNone: () =>
            MetricContext.of({
              input: inputPayload,
              prediction: predictionPayload,
              expected: expectedPayload
            }),
          onSome: (metadata) =>
            MetricContext.of({
              input: inputPayload,
              prediction: predictionPayload,
              expected: expectedPayload,
              metadata
            })
        })
      )
    )
    const rootTrace = Arr.last(Arr.filter(traced[1], (entry) => entry.moduleName === options.module.name))

    return yield* Option.match(rootTrace, {
      onNone: () =>
        options.emit(
          BootstrapEvent.TraceRejected({
            moduleName: options.module.name,
            score: metricResult.score,
            threshold: options.threshold
          })
        ).pipe(
          Effect.as(
            new ExampleEvaluation({ demo: Option.none(), traceCount: 0, accepted: false, score: metricResult.score })
          )
        ),
      onSome: (traceEntry) =>
        Effect.if(metricResult.score >= options.threshold, {
          onTrue: () =>
            options.emit(
              BootstrapEvent.TraceAccepted({
                moduleName: traceEntry.moduleName,
                score: metricResult.score
              })
            ).pipe(
              Effect.as(
                new ExampleEvaluation({
                  demo: Option.some(new Demo({ input: traceEntry.input, output: traceEntry.output })),
                  traceCount: 1,
                  accepted: true,
                  score: metricResult.score
                })
              )
            ),
          onFalse: () =>
            options.emit(
              BootstrapEvent.TraceRejected({
                moduleName: traceEntry.moduleName,
                score: metricResult.score,
                threshold: options.threshold
              })
            ).pipe(
              Effect.as(
                new ExampleEvaluation({
                  demo: Option.none(),
                  traceCount: 1,
                  accepted: false,
                  score: metricResult.score
                })
              )
            )
        })
    })
  })

export const bootstrapRound = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR
>(options: {
  readonly state: BootstrapState
  readonly module: Module<I, O>
  readonly trainset: ReadonlyArray<Example>
  readonly metric: Metric<ME, MR>
  readonly threshold: number
  readonly emit: BootstrapEventSink
  readonly teacher: Option.Option<Layer.Layer<LanguageModel.LanguageModel, never, never>>
  readonly maxBootstrappedDemos: number
  readonly maxRounds: number
  readonly initialInstructions: string
}) =>
  Effect.gen(function*() {
    yield* options.emit(BootstrapEvent.RoundStarted({ round: options.state.round, maxRounds: options.maxRounds }))

    const roundEvaluation = yield* Effect.acquireUseRelease(
      Ref.get(options.module.params).pipe(
        Effect.tap((params) =>
          Ref.set(
            options.module.params,
            withModuleParamsDemosAndInstructions(
              params,
              options.state.demos,
              roundInstructions(options.initialInstructions, options.state.round)
            )
          )
        )
      ),
      () =>
        Effect.forEach(
          options.trainset,
          (example) =>
            evaluateExample({
              module: options.module,
              example,
              metric: options.metric,
              threshold: options.threshold,
              emit: options.emit,
              teacher: options.teacher
            }),
          { concurrency: "inherit" }
        ).pipe(
          Effect.map((evaluations) => {
            const scoreAndAcceptanceStats = Arr.reduce(
              evaluations,
              {
                acceptedCount: 0,
                rejectedCount: 0,
                scoreSum: 0,
                bestScoreSeen: false,
                bestScore: 0
              },
              (stats, evaluation) => ({
                acceptedCount: stats.acceptedCount + (evaluation.accepted
                  ? 1
                  : 0),
                rejectedCount: stats.rejectedCount + (evaluation.accepted
                  ? 0
                  : 1),
                scoreSum: stats.scoreSum + evaluation.score,
                bestScoreSeen: true,
                bestScore: stats.bestScoreSeen
                  ? Math.max(stats.bestScore, evaluation.score)
                  : evaluation.score
              })
            )

            return evaluations.length <= 0
              ? emptyRoundEvaluation
              : new RoundEvaluation({
                acceptedDemos: Arr.filterMap(evaluations, (evaluation) => evaluation.demo),
                traceCount: Arr.reduce(evaluations, 0, (count, evaluation) => count + evaluation.traceCount),
                acceptedCount: scoreAndAcceptanceStats.acceptedCount,
                rejectedCount: scoreAndAcceptanceStats.rejectedCount,
                evaluatedCount: evaluations.length,
                scoreSum: scoreAndAcceptanceStats.scoreSum,
                bestScoreSeen: scoreAndAcceptanceStats.bestScoreSeen,
                bestScore: scoreAndAcceptanceStats.bestScore
              })
          })
        ),
      (params) => Ref.set(options.module.params, params)
    )

    const merged = mergeAcceptedDemos({
      existing: options.state.demos,
      accepted: roundEvaluation.acceptedDemos,
      maxBootstrappedDemos: options.maxBootstrappedDemos
    })

    yield* Ref.update(options.module.params, (params) =>
      withModuleParamsDemosAndInstructions(params, merged.demos, options.initialInstructions))

    yield* options.emit(
      BootstrapEvent.RoundCompleted({
        round: options.state.round,
        demosCollected: merged.demos.length
      })
    )

    return new BootstrapState({
      round: options.state.round + 1,
      roundsAttempted: options.state.roundsAttempted + 1,
      demos: merged.demos,
      totalTraces: options.state.totalTraces + roundEvaluation.traceCount,
      acceptedTraces: options.state.acceptedTraces + roundEvaluation.acceptedCount,
      rejectedTraces: options.state.rejectedTraces + roundEvaluation.rejectedCount,
      evaluatedExamples: options.state.evaluatedExamples + roundEvaluation.evaluatedCount,
      scoreSum: options.state.scoreSum + roundEvaluation.scoreSum,
      bestScoreSeen: options.state.bestScoreSeen || roundEvaluation.bestScoreSeen,
      bestScore: options.state.bestScoreSeen && roundEvaluation.bestScoreSeen
        ? Math.max(options.state.bestScore, roundEvaluation.bestScore)
        : options.state.bestScoreSeen
        ? options.state.bestScore
        : roundEvaluation.bestScore,
      fallbackUsed: options.state.fallbackUsed,
      continue: merged.added > 0
    })
  })
