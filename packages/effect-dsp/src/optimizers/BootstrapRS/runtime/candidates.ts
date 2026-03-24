/**
 * BootstrapRS candidate generation — runs BootstrapFewShot with different
 * seeds and collects parameter snapshots.
 *
 * @since 0.0.0
 * @internal
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { Array as Arr, Effect, Either, Match, Option, Schema } from "effect"
import type * as Layer from "effect/Layer"
import { AllTrialsFailed } from "../../../Errors/optimizer.js"
import * as Evaluate from "../../../Evaluate/index.js"
import type { Example } from "../../../Example/index.js"
import type { Metric } from "../../../Metric/model.js"
import * as Module from "../../../Module/index.js"
import type { Module as DspModule } from "../../../Module/model.js"
import { bootstrapFewShot } from "../../BootstrapFewShot/index.js"
import { labeledFewShot } from "../../LabeledFewShot/index.js"

/**
 * Clamps a number to a non-negative value, replacing any negative input with zero.
 *
 * @since 0.0.0
 * @category utils
 * @internal
 */
export const normalizeNonNegative = (value: number): number =>
  Match.value(value).pipe(
    Match.when((candidate) => candidate < 0, () => 0),
    Match.orElse((candidate) => candidate)
  )

/**
 * Rotates an example array by a seed-derived offset so each candidate
 * sees training data in a different order.
 *
 * The offset is `seed % length`, ensuring deterministic but varied
 * orderings across candidate runs.
 *
 * @since 0.0.0
 * @category utils
 * @internal
 */
export const rotateExamples = (examples: ReadonlyArray<Example>, seed: number): ReadonlyArray<Example> => {
  const length = examples.length

  if (length <= 0) {
    return examples
  }

  const offset = normalizeNonNegative(seed) % length

  return Arr.appendAll(Arr.drop(examples, offset), Arr.take(examples, offset))
}

const buildSeeds = (
  count: number,
  next: number,
  acc: ReadonlyArray<number>
): ReadonlyArray<number> =>
  count <= 0
    ? acc
    : buildSeeds(count - 1, next + 1, Arr.append(acc, next))

/**
 * Resolves the seed sequence for candidate generation.
 *
 * When explicit seeds are provided, takes up to `numCandidates` from them.
 * Otherwise generates a sequential range `[0, numCandidates)`.
 *
 * @since 0.0.0
 * @category utils
 * @internal
 */
export const resolveSeeds = (options: {
  readonly numCandidates: number
  readonly seeds?: ReadonlyArray<number>
}): ReadonlyArray<number> => {
  const normalizedCandidateCount = normalizeNonNegative(options.numCandidates)

  return Option.match(Option.fromNullable(options.seeds), {
    onNone: () => buildSeeds(normalizedCandidateCount, 0, Arr.empty<number>()),
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
 * @since 0.0.0
 * @category models
 * @internal
 */
export class CandidateState extends Schema.Class<CandidateState>("BootstrapRSCandidateState")({
  label: Schema.String,
  state: Module.SavedState
}) {}

/**
 * Loads a candidate's saved parameters into the module, runs the evaluation
 * metric against the validation set, and returns the aggregate score.
 *
 * Fails with `AllTrialsFailed` when the evaluation produces zero successful
 * examples.
 *
 * @since 0.0.0
 * @category constructors
 * @internal
 */
export const evaluateCandidate = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR
>(options: {
  readonly module: DspModule<I, O>
  readonly candidate: CandidateState
  readonly valset: ReadonlyArray<Example>
  readonly metric: Metric<ME, MR>
}) =>
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

    if (report.successCount <= 0) {
      return yield* Effect.fail(
        new AllTrialsFailed({
          message: `Candidate '${options.candidate.label}' produced zero successful evaluation examples`,
          trialCount: 0
        })
      )
    }

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
 * Bootstrap candidates that fail are silently dropped. The uncompiled and
 * labeled-few-shot baselines are always included.
 *
 * @since 0.0.0
 * @category constructors
 * @internal
 */
export const buildCandidateStates = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME,
  MR
>(options: {
  readonly module: DspModule<I, O>
  readonly initialState: Module.SavedState
  readonly trainset: ReadonlyArray<Example>
  readonly metric: Metric<ME, MR>
  readonly seeds: ReadonlyArray<number>
  readonly maxRounds: number
  readonly maxBootstrappedDemos: number
  readonly maxLabeledDemos?: number
  readonly threshold?: number
  readonly fallbackToLabeledFewShot?: boolean
  readonly fallbackLabeledDemoCount?: number
  readonly teacher?: Layer.Layer<LanguageModel.LanguageModel, never, never>
  readonly baselineLabeledCount: number
}) =>
  Effect.gen(function*() {
    const labeledBaseline = yield* Effect.gen(function*() {
      yield* Module.load(options.module, options.initialState)
      yield* labeledFewShot({
        module: options.module,
        trainset: options.trainset,
        k: options.baselineLabeledCount,
        seed: Option.getOrElse(Arr.head(options.seeds), () => 0)
      })
      const state = yield* Module.save(options.module)

      return new CandidateState({
        label: "labeled-few-shot",
        state
      })
    })

    const bootstrapCandidates = yield* Effect.forEach(
      options.seeds,
      (seed) =>
        Effect.either(
          Effect.gen(function*() {
            yield* Module.load(options.module, options.initialState)
            yield* bootstrapFewShot({
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
            const state = yield* Module.save(options.module)

            return new CandidateState({
              label: `bootstrap-${seed}`,
              state
            })
          })
        ).pipe(
          Effect.map(
            Either.match({
              onLeft: () => Option.none<CandidateState>(),
              onRight: (candidate) => Option.some(candidate)
            })
          )
        ),
      { concurrency: 1 }
    ).pipe(
      Effect.map((candidates) => Arr.filterMap(candidates, (candidate) => candidate))
    )

    return Arr.appendAll(
      Arr.make(
        new CandidateState({ label: "uncompiled", state: options.initialState }),
        labeledBaseline
      ),
      bootstrapCandidates
    )
  })
