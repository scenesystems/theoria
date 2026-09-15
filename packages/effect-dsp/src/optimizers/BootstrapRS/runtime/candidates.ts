/**
 * BootstrapRS candidate generation — runs BootstrapFewShot with different
 * seeds and collects parameter snapshots.
 *
 * @since 0.1.0
 * @internal
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Data, Effect, Inspectable, Match, Number as Num, Option, Schema, String as Str } from "effect"
import type * as Layer from "effect/Layer"
import { AllTrialsFailed } from "../../../Errors/optimizer.js"
import * as Evaluate from "../../../Evaluate/index.js"
import { Example } from "../../../Example/index.js"
import type { Metric } from "../../../Metric/model.js"
import * as Module from "../../../Module/index.js"
import type { Module as DspModule } from "../../../Module/model.js"
import { bootstrapFewShot, BootstrapFewShotOptions } from "../../BootstrapFewShot/index.js"
import { labeledFewShot, LabeledFewShotOptions } from "../../LabeledFewShot/index.js"

/** @internal */
export const BootstrapRSExamples = Schema.Array(Example)

/** @internal */
export type BootstrapRSExamples = typeof BootstrapRSExamples.Type

/** @internal */
export const BootstrapRSSeeds = Schema.Array(Schema.Number)

/** @internal */
export type BootstrapRSSeeds = typeof BootstrapRSSeeds.Type

/** @internal */
export class ResolveSeedsOptions extends Schema.Class<ResolveSeedsOptions>("BootstrapRSResolveSeedsOptions")({
  numCandidates: Schema.Number,
  seeds: Schema.optional(BootstrapRSSeeds)
}) {}

/**
 * Clamps a number to a non-negative value, replacing any negative input with zero.
 *
 * @since 0.1.0
 * @category utils
 * @internal
 */
export const normalizeNonNegative = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Numeric.isFinite, (candidate) => Numeric.max(0, Numeric.floor(candidate))),
    Match.orElse(() => 0)
  )

/**
 * Rotates an example array by a seed-derived offset so each candidate
 * sees training data in a different order.
 *
 * The offset is `seed % length`, ensuring deterministic but varied
 * orderings across candidate runs.
 *
 * @since 0.1.0
 * @category utils
 * @internal
 */
export const rotateExamples = (examples: BootstrapRSExamples, seed: number): BootstrapRSExamples =>
  Arr.match(examples, {
    onEmpty: () => examples,
    onNonEmpty: (nonEmptyExamples) => {
      const offset = Num.remainder(normalizeNonNegative(seed), Arr.length(nonEmptyExamples))

      return Arr.appendAll(Arr.drop(nonEmptyExamples, offset), Arr.take(nonEmptyExamples, offset))
    }
  })

/**
 * Resolves the seed sequence for candidate generation.
 *
 * When explicit seeds are provided, takes up to `numCandidates` from them.
 * Otherwise generates a sequential range `[0, numCandidates)`.
 *
 * @since 0.1.0
 * @category utils
 * @internal
 */
export const resolveSeeds = (options: ResolveSeedsOptions): BootstrapRSSeeds => {
  const normalizedCandidateCount = normalizeNonNegative(options.numCandidates)

  return Option.match(Option.fromNullable(options.seeds), {
    onNone: () =>
      Match.value(normalizedCandidateCount).pipe(
        Match.when(0, () => Arr.empty<number>()),
        Match.orElse((count) => Arr.range(0, Num.decrement(count)))
      ),
    onSome: (provided) => Arr.take(provided, normalizedCandidateCount)
  })
}

/**
 * Snapshot of a candidate's optimized parameters paired with a human-readable label.
 *
 * Labels follow the convention `"uncompiled"`, `"labeled-few-shot"`, or
 * `"bootstrap-{seed}"` to identify the optimization strategy that produced
 * the state.
 *
 * @since 0.1.0
 * @category models
 * @internal
 */
export class CandidateState extends Schema.Class<CandidateState>("BootstrapRSCandidateState")({
  label: Schema.String,
  state: Module.SavedState
}) {}

/** @internal */
export const CandidateStates = Schema.Array(CandidateState)

/** @internal */
export type CandidateStates = typeof CandidateStates.Type

/** @internal */
export class EvaluateCandidateOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR,
  E,
  R
> extends Data.Class<{
  readonly module: DspModule<I, O, E, R>
  readonly candidate: CandidateState
  readonly valset: BootstrapRSExamples
  readonly metric: Metric<ME, MR>
}> {}

/** @internal */
export class BuildCandidateStatesOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR,
  E,
  R
> extends Data.Class<{
  readonly module: DspModule<I, O, E, R>
  readonly initialState: Module.SavedState
  readonly trainset: BootstrapRSExamples
  readonly metric: Metric<ME, MR>
  readonly seeds: BootstrapRSSeeds
  readonly maxRounds: number
  readonly maxBootstrappedDemos: number
  readonly maxLabeledDemos?: number
  readonly threshold?: number
  readonly fallbackToLabeledFewShot?: boolean
  readonly fallbackLabeledDemoCount?: number
  readonly teacher?: Layer.Layer<LanguageModel.LanguageModel, never, never>
  readonly baselineLabeledCount: number
}> {}

/**
 * Loads a candidate's saved parameters into the module, runs the evaluation
 * metric against the validation set, and returns the aggregate score.
 *
 * Fails with `AllTrialsFailed` when the evaluation produces zero successful
 * examples.
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const evaluateCandidate = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR,
  E,
  R
>(options: EvaluateCandidateOptions<I, O, ME, MR, E, R>) =>
  Effect.gen(function*() {
    yield* Module.load(options.module, options.candidate.state)
    const report = yield* Evaluate.run({
      module: options.module,
      examples: options.valset,
      metrics: {
        bootstrapRS: options.metric
      },
      concurrency: 1
    })

    yield* Effect.if(Num.lessThanOrEqualTo(report.successCount, 0), {
      onFalse: () => Effect.void,
      onTrue: () =>
        new AllTrialsFailed({
          message: Str.concat(
            Str.concat("Candidate '", options.candidate.label),
            "' produced zero successful evaluation examples"
          ),
          trialCount: 0
        })
    })

    return Option.getOrElse(Option.fromNullable(report.overallScores.bootstrapRS), () => 0)
  })

/**
 * Generates the full set of candidate parameter snapshots for random search.
 *
 * **Candidates produced:**
 * - An uncompiled baseline using the module's initial state
 * - A labeled-few-shot baseline using the first seed
 * - One bootstrap-few-shot candidate per seed, each trained on a rotated
 *   view of the training set
 *
 * A bootstrap that fails to load, train or save fails candidate generation;
 * the optimizer does not report a winner from a partially built pool.
 *
 * @since 0.1.0
 * @category constructors
 * @internal
 */
export const buildCandidateStates = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR,
  E,
  R
>(options: BuildCandidateStatesOptions<I, O, ME, MR, E, R>) =>
  Effect.gen(function*() {
    const labeledBaseline = yield* Effect.gen(function*() {
      yield* Module.load(options.module, options.initialState)
      yield* labeledFewShot(
        new LabeledFewShotOptions({
          module: options.module,
          trainset: options.trainset,
          k: options.baselineLabeledCount,
          seed: Option.getOrElse(Arr.head(options.seeds), () => 0)
        })
      )
      const state = yield* Module.save(options.module)

      return new CandidateState({
        label: "labeled-few-shot",
        state
      })
    })

    const bootstrapCandidates = yield* Effect.forEach(
      options.seeds,
      (seed) =>
        Effect.gen(function*() {
          yield* Module.load(options.module, options.initialState)
          yield* bootstrapFewShot(
            new BootstrapFewShotOptions({
              module: options.module,
              trainset: rotateExamples(options.trainset, seed),
              metric: options.metric,
              maxRounds: options.maxRounds,
              maxBootstrappedDemos: options.maxBootstrappedDemos,
              ...Option.match(Option.fromNullable(options.maxLabeledDemos), {
                onNone: () => ({}),
                onSome: (value) => ({ maxLabeledDemos: value })
              }),
              ...Option.match(Option.fromNullable(options.threshold), {
                onNone: () => ({}),
                onSome: (value) => ({ threshold: value })
              }),
              ...Option.match(Option.fromNullable(options.teacher), {
                onNone: () => ({}),
                onSome: (teacher) => ({ teacher })
              }),
              ...Option.match(Option.fromNullable(options.fallbackToLabeledFewShot), {
                onNone: () => ({ fallbackToLabeledFewShot: false }),
                onSome: (fallbackToLabeledFewShot) => ({ fallbackToLabeledFewShot })
              }),
              ...Option.match(Option.fromNullable(options.fallbackLabeledDemoCount), {
                onNone: () => ({}),
                onSome: (fallbackLabeledDemoCount) => ({ fallbackLabeledDemoCount })
              })
            })
          )
          const state = yield* Module.save(options.module)

          return new CandidateState({
            label: Str.concat("bootstrap-", Inspectable.toStringUnknown(seed)),
            state
          })
        }),
      { concurrency: 1 }
    )

    return Arr.appendAll(
      Arr.make(
        new CandidateState({ label: "uncompiled", state: options.initialState }),
        labeledBaseline
      ),
      bootstrapCandidates
    )
  })
