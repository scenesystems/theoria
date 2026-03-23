/**
 * BootstrapFewShot optimizer — collect high-scoring demonstrations by running
 * a teacher module and filtering traces above a score threshold.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @since 0.0.0
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { Array as Arr, Effect, Option, Ref } from "effect"
import type { Schema, Stream } from "effect"
import { streamFromEmitter } from "effect-search/Study"
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
 * Configuration for BootstrapFewShot — module, training set, metric, round
 * count, demo limits, score threshold, and optional teacher layer.
 *
 * @since 0.0.0
 * @category models
 */
export type BootstrapFewShotOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
> = Readonly<{
  readonly module: Module<I, O>
  readonly trainset: ReadonlyArray<Example>
  readonly metric: Metric<ME, MR>
  readonly maxRounds: number
  readonly maxBootstrappedDemos: number
  readonly maxLabeledDemos?: number
  readonly threshold?: number
  readonly fallbackToLabeledFewShot?: boolean
  readonly fallbackLabeledDemoCount?: number
  readonly teacher?: Layer.Layer<LanguageModel.LanguageModel, never, never>
}>

export type { BootstrapEventSink } from "./runtime/round.js"

/**
 * No-op event sink that discards all bootstrap events.
 *
 * @since 0.0.0
 * @category constants
 */
export const noBootstrapEvents: BootstrapEventSink = () => Effect.void

const streamBootstrapFewShotEvents = <A, E, R>(
  runWithEvents: (emit: BootstrapEventSink) => Effect.Effect<A, E, R>
): Stream.Stream<BootstrapEventType, E, R> => streamFromEmitter(runWithEvents)

/**
 * Run BootstrapFewShot with an explicit event sink. Iterates through training
 * examples, runs the module (optionally via a teacher layer), scores traces,
 * and collects demos above the threshold. Falls back to `labeledFewShot` when
 * no demos pass the threshold.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al. (2023)}
 * @since 0.0.0
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
 * Run BootstrapFewShot and return the module with collected demonstrations.
 *
 * @since 0.0.0
 * @category constructors
 */
export const bootstrapFewShot = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
>(options: BootstrapFewShotOptions<I, O, ME, MR>) => bootstrapFewShotWithEvents(options, noBootstrapEvents)

/**
 * Run BootstrapFewShot and project all lifecycle events as an Effect Stream.
 *
 * @since 0.0.0
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
