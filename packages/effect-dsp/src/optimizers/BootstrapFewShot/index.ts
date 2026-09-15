/**
 * Collects demonstrations from scored module traces.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @since 0.1.0
 * @module
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { streamFromEmitter } from "@scenesystems/effect-search/Study"
import { Array as Arr, Boolean as Bool, Data, Effect, Number as Num, Option, Predicate, Ref, Schema } from "effect"
import type { Stream } from "effect"
import type * as Layer from "effect/Layer"
import { withModuleParamsDemosAndInstructions } from "../../contracts/ModuleParams.js"
import { BootstrapFailed } from "../../Errors/optimizer.js"
import { Example } from "../../Example/index.js"
import type { Metric } from "../../Metric/model.js"
import type { Module } from "../../Module/model.js"
import { BootstrapEvent, type BootstrapEvent as BootstrapEventType } from "../../Optimizer/events/bootstrap.js"
import { labeledFewShot, LabeledFewShotOptions } from "../LabeledFewShot/index.js"
import { labeledTrainset, normalizeNonNegative } from "./runtime/demos.js"
import { BootstrapState, DEFAULT_BOOTSTRAP_FALLBACK_DEMO_COUNT, DEFAULT_BOOTSTRAP_THRESHOLD } from "./runtime/model.js"
import { type BootstrapEventSink, bootstrapRound, BootstrapRoundOptions } from "./runtime/round.js"

const averageScore = (state: BootstrapState): number =>
  Bool.match(Num.greaterThan(state.evaluatedExamples, 0), {
    onFalse: () => 0,
    onTrue: () => Num.unsafeDivide(state.scoreSum, state.evaluatedExamples)
  })

/**
 * Ordered dataset rows consumed by BootstrapFewShot.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BootstrapExamples = Schema.Array(Example)

/**
 * Ordered dataset rows consumed by BootstrapFewShot.
 *
 * @since 0.1.0
 * @category type-level
 */
export type BootstrapExamples = typeof BootstrapExamples.Type

const bootstrapFailure = (message: string, threshold: number, state: BootstrapState): BootstrapFailed =>
  new BootstrapFailed({
    message,
    roundsAttempted: state.roundsAttempted,
    totalTraces: state.totalTraces,
    threshold,
    acceptedTraces: state.acceptedTraces,
    rejectedTraces: state.rejectedTraces,
    evaluatedExamples: state.evaluatedExamples,
    bestScoreSeen: state.bestScoreSeen,
    bestScore: state.bestScore,
    averageScore: averageScore(state)
  })

/**
 * Configures trace collection and labeled fallback.
 *
 * @remarks
 * Only examples with an `output` are retained. Each round visits that filtered
 * sequence in order. Count options are rounded down; negative and non-finite
 * values become zero. Existing demonstrations are truncated to the bootstrap
 * cap before the first round.
 *
 * @typeParam I - Module input fields decoded from training examples.
 * @typeParam O - Module output fields used to create accepted demonstrations.
 * @typeParam ME - Expected failure type of the metric.
 * @typeParam MR - Services required by the metric.
 *
 * @since 0.1.0
 * @category models
 */
export class BootstrapFewShotOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
> extends Data.Class<{
  /** Module mutated in place and returned by the optimizer. */
  readonly module: Module<I, O, E, R>
  /** Training examples used for teacher runs and labeled fallback. */
  readonly trainset: BootstrapExamples
  /** Scores each module output; values greater than or equal to `threshold` are accepted. */
  readonly metric: Metric<ME, MR>
  /** Maximum filtered-trainset passes. Zero skips trace collection. */
  readonly maxRounds: number
  /** Trace-demo cap, including retained existing demos but excluding labeled fallback. */
  readonly maxBootstrappedDemos: number
  /** Positive prefix length after unlabeled examples are removed; other values leave the sequence unbounded. */
  readonly maxLabeledDemos?: number
  /** Minimum accepted score. Defaults to `1`. */
  readonly threshold?: number
  /** Whether zero accepted traces trigger labeled fallback. Defaults to `true`. */
  readonly fallbackToLabeledFewShot?: boolean
  /** Labeled fallback count, independent of `maxBootstrappedDemos`; defaults to `3`. */
  readonly fallbackLabeledDemoCount?: number
  /** Layer used only while running teacher traces; otherwise the ambient language model is used. */
  readonly teacher?: Layer.Layer<LanguageModel.LanguageModel, never, never>
}> {}

export type { BootstrapEventSink } from "./runtime/round.js"

/**
 * Discards bootstrap events without adding failures or requirements.
 *
 * @since 0.1.0
 * @category constants
 */
export const noBootstrapEvents: BootstrapEventSink = () => Effect.void

const streamBootstrapFewShotEvents = <A, E, R>(
  runWithEvents: (emit: BootstrapEventSink) => Effect.Effect<A, E, R>
): Stream.Stream<BootstrapEventType, E, R> => streamFromEmitter(runWithEvents)

/**
 * Adds accepted trace demonstrations to a module while emitting lifecycle events.
 *
 * @remarks
 * Events are awaited in execution order. A round evaluates every retained
 * example and accepts the root trace when its metric score is at least the
 * threshold. Collection stops at the demonstration cap, the round cap, or the
 * first round that adds no new demonstration. Accepted values replace the
 * module's demonstrations after each completed round.
 *
 * If no demonstration remains, labeled fallback runs by default. Disabled or
 * empty fallback fails with `BootstrapFailed`. Input decoding, module calls,
 * metrics, and event-sink defects preserve their normal Effect behavior. The
 * same module object is returned after mutation.
 *
 * @typeParam I - Module input fields decoded from training examples.
 * @typeParam O - Module output fields captured from accepted traces.
 * @typeParam ME - Expected failure type of the metric.
 * @typeParam MR - Services required by the metric.
 * @param options - Training data, metric, module, caps, threshold, and optional teacher.
 * @param emit - Infallible sink awaited once per emitted lifecycle event.
 * @returns The supplied module after bootstrap or labeled fallback updates.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al. (2023)}
 * @since 0.1.0
 * @category constructors
 */
export const bootstrapFewShotWithEvents = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
>(
  options: BootstrapFewShotOptions<I, O, ME, MR, E, R>,
  emit: BootstrapEventSink
) =>
  Effect.gen(function*() {
    const maxRounds = normalizeNonNegative(options.maxRounds)
    const maxBootstrappedDemos = normalizeNonNegative(options.maxBootstrappedDemos)
    const threshold = Option.getOrElse(Option.fromNullable(options.threshold), () => DEFAULT_BOOTSTRAP_THRESHOLD)
    const fallbackToLabeledFewShot = Option.getOrElse(
      Option.fromNullable(options.fallbackToLabeledFewShot),
      () => true
    )
    const fallbackLabeledDemoCount = normalizeNonNegative(
      Option.getOrElse(
        Option.fromNullable(options.fallbackLabeledDemoCount),
        () => DEFAULT_BOOTSTRAP_FALLBACK_DEMO_COUNT
      )
    )
    const teacher = Option.fromNullable(options.teacher)
    const initialParams = yield* Ref.get(options.module.params)
    const initialDemos = Arr.take(initialParams.demos, maxBootstrappedDemos)
    const trainset = labeledTrainset(options.trainset, Option.fromNullable(options.maxLabeledDemos))

    yield* Ref.update(
      options.module.params,
      (params) => withModuleParamsDemosAndInstructions(params, initialDemos, initialParams.instructions)
    )

    const finalState = yield* Effect.iterate(
      new BootstrapState({
        round: 1,
        roundsAttempted: 0,
        demos: initialDemos,
        totalTraces: 0,
        acceptedTraces: 0,
        rejectedTraces: 0,
        evaluatedExamples: 0,
        scoreSum: 0,
        bestScoreSeen: false,
        bestScore: 0,
        fallbackUsed: false,
        continue: true
      }),
      {
        while: Predicate.and(
          Predicate.and(
            (state: BootstrapState) => state.continue,
            (state) => Num.lessThanOrEqualTo(state.round, maxRounds)
          ),
          (state) => Num.lessThan(Arr.length(state.demos), maxBootstrappedDemos)
        ),
        body: (state) =>
          bootstrapRound(
            new BootstrapRoundOptions({
              state,
              module: options.module,
              trainset,
              metric: options.metric,
              threshold,
              emit,
              teacher,
              maxBootstrappedDemos,
              maxRounds,
              initialInstructions: initialParams.instructions
            })
          )
      }
    )

    return yield* Effect.if(Option.isNone(Arr.head(finalState.demos)), {
      onFalse: () =>
        emit(
          BootstrapEvent.BootstrapCompleted({
            totalDemos: Arr.length(finalState.demos),
            roundsUsed: finalState.roundsAttempted,
            fallbackUsed: false
          })
        ).pipe(Effect.as(options.module)),
      onTrue: () =>
        Effect.if(
          Bool.match(fallbackToLabeledFewShot, {
            onFalse: () => false,
            onTrue: () => Num.greaterThan(fallbackLabeledDemoCount, 0)
          }),
          {
            onFalse: () => bootstrapFailure("BootstrapFewShot produced zero accepted demos", threshold, finalState),
            onTrue: () =>
              Effect.gen(function*() {
                yield* emit(
                  BootstrapEvent.BootstrapFallbackActivated({
                    threshold,
                    roundsAttempted: finalState.roundsAttempted,
                    acceptedTraces: finalState.acceptedTraces,
                    rejectedTraces: finalState.rejectedTraces,
                    bestScoreSeen: finalState.bestScoreSeen,
                    bestScore: finalState.bestScore,
                    averageScore: averageScore(finalState),
                    fallbackLabeledDemoCount
                  })
                )

                const optimized = yield* labeledFewShot(
                  new LabeledFewShotOptions({
                    module: options.module,
                    trainset,
                    k: fallbackLabeledDemoCount
                  })
                )
                const paramsAfterFallback = yield* Ref.get(options.module.params)

                return yield* Effect.if(Option.isNone(Arr.head(paramsAfterFallback.demos)), {
                  onTrue: () =>
                    bootstrapFailure(
                      "BootstrapFewShot produced zero accepted demos and labeled fallback yielded zero demos",
                      threshold,
                      finalState
                    ),
                  onFalse: () =>
                    Effect.gen(function*() {
                      yield* emit(
                        BootstrapEvent.BootstrapFallbackCompleted({
                          fallbackDemosAdded: Arr.length(paramsAfterFallback.demos),
                          totalDemos: Arr.length(paramsAfterFallback.demos),
                          roundsUsed: finalState.roundsAttempted
                        })
                      )
                      yield* emit(
                        BootstrapEvent.BootstrapCompleted({
                          totalDemos: Arr.length(paramsAfterFallback.demos),
                          roundsUsed: finalState.roundsAttempted,
                          fallbackUsed: true
                        })
                      )

                      return optimized
                    })
                })
              })
          }
        )
    })
  })

/**
 * Adds trace demonstrations without retaining lifecycle events.
 *
 * @remarks
 * Mutation, fallback, and failures match {@link bootstrapFewShotWithEvents}.
 *
 * @param options - Bootstrap configuration passed to the event-aware operation.
 * @returns The supplied module after successful optimization.
 * @typeParam I - Module input fields decoded from training examples.
 * @typeParam O - Module output fields captured from accepted traces.
 * @typeParam ME - Expected failure type of the metric.
 * @typeParam MR - Services required by the metric.
 *
 * @since 0.1.0
 * @category constructors
 */
export const bootstrapFewShot = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
>(options: BootstrapFewShotOptions<I, O, ME, MR, E, R>) => bootstrapFewShotWithEvents(options, noBootstrapEvents)

/**
 * Emits bootstrap events as stream consumption drives optimization.
 *
 * @remarks
 * Events retain execution order. The final module is available through the
 * mutated `options.module`, not as a stream element. Bootstrap failures fail the
 * stream.
 *
 * @param options - Bootstrap configuration evaluated when the stream runs.
 * @returns A lazy stream of lifecycle events.
 * @typeParam I - Module input fields decoded from training examples.
 * @typeParam O - Module output fields captured from accepted traces.
 * @typeParam ME - Expected failure type of the metric.
 * @typeParam MR - Services required by the metric.
 *
 * @since 0.1.0
 * @category constructors
 */
export const bootstrapFewShotStream = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
>(
  options: BootstrapFewShotOptions<I, O, ME, MR, E, R>
) => streamBootstrapFewShotEvents((emit) => bootstrapFewShotWithEvents(options, emit))

export * from "./progress.js"
