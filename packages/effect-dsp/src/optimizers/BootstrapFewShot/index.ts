/**
 * Collects demonstrations from scored module traces.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @since 0.1.0
 * @module
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { streamFromEmitter } from "@scenesystems/effect-search/Study"
import { Array as Arr, Effect, Option, Ref } from "effect"
import type { Schema, Stream } from "effect"
import type * as Layer from "effect/Layer"
import { withModuleParamsDemosAndInstructions } from "../../contracts/ModuleParams.js"
import { BootstrapFailed } from "../../Errors/optimizer.js"
import type { Example } from "../../Example/index.js"
import type { Metric } from "../../Metric/model.js"
import type { Module } from "../../Module/model.js"
import { BootstrapEvent, type BootstrapEvent as BootstrapEventType } from "../../Optimizer/events/bootstrap.js"
import { labeledFewShot } from "../LabeledFewShot/index.js"
import { labeledTrainset, normalizeNonNegative } from "./runtime/demos.js"
import { BootstrapState, DEFAULT_BOOTSTRAP_FALLBACK_DEMO_COUNT, DEFAULT_BOOTSTRAP_THRESHOLD } from "./runtime/model.js"
import { type BootstrapEventSink, bootstrapRound } from "./runtime/round.js"

const averageScore = (state: BootstrapState): number =>
  state.evaluatedExamples > 0
    ? state.scoreSum / state.evaluatedExamples
    : 0

const bootstrapFailure = (options: {
  readonly message: string
  readonly threshold: number
  readonly state: BootstrapState
}): BootstrapFailed =>
  new BootstrapFailed({
    message: options.message,
    roundsAttempted: options.state.roundsAttempted,
    totalTraces: options.state.totalTraces,
    threshold: options.threshold,
    acceptedTraces: options.state.acceptedTraces,
    rejectedTraces: options.state.rejectedTraces,
    evaluatedExamples: options.state.evaluatedExamples,
    bestScoreSeen: options.state.bestScoreSeen,
    bestScore: options.state.bestScore,
    averageScore: averageScore(options.state)
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
export type BootstrapFewShotOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
> = Readonly<{
  /** Module mutated in place and returned by the optimizer. */
  readonly module: Module<I, O>
  /** Training examples used for teacher runs and labeled fallback. */
  readonly trainset: ReadonlyArray<Example>
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
}>

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
  MR = never
>(
  options: BootstrapFewShotOptions<I, O, ME, MR>,
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
        while: (state) => state.continue && state.round <= maxRounds && state.demos.length < maxBootstrappedDemos,
        body: (state) =>
          bootstrapRound({
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
      }
    )

    if (finalState.demos.length <= 0) {
      if (fallbackToLabeledFewShot && fallbackLabeledDemoCount > 0) {
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

        const optimized = yield* labeledFewShot({
          module: options.module,
          trainset,
          k: fallbackLabeledDemoCount
        })
        const paramsAfterFallback = yield* Ref.get(options.module.params)

        if (paramsAfterFallback.demos.length <= 0) {
          return yield* Effect.fail(
            bootstrapFailure({
              message: "BootstrapFewShot produced zero accepted demos and labeled fallback yielded zero demos",
              threshold,
              state: finalState
            })
          )
        }

        yield* emit(
          BootstrapEvent.BootstrapFallbackCompleted({
            fallbackDemosAdded: paramsAfterFallback.demos.length,
            totalDemos: paramsAfterFallback.demos.length,
            roundsUsed: finalState.roundsAttempted
          })
        )

        yield* emit(
          BootstrapEvent.BootstrapCompleted({
            totalDemos: paramsAfterFallback.demos.length,
            roundsUsed: finalState.roundsAttempted,
            fallbackUsed: true
          })
        )

        return optimized
      }

      return yield* Effect.fail(
        bootstrapFailure({
          message: "BootstrapFewShot produced zero accepted demos",
          threshold,
          state: finalState
        })
      )
    }

    yield* emit(
      BootstrapEvent.BootstrapCompleted({
        totalDemos: finalState.demos.length,
        roundsUsed: finalState.roundsAttempted,
        fallbackUsed: false
      })
    )

    return options.module
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
  MR = never
>(options: BootstrapFewShotOptions<I, O, ME, MR>) => bootstrapFewShotWithEvents(options, noBootstrapEvents)

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
  MR = never
>(
  options: BootstrapFewShotOptions<I, O, ME, MR>
) => streamBootstrapFewShotEvents((emit) => bootstrapFewShotWithEvents(options, emit))

export * from "./progress.js"
