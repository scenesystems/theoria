/**
 * Selects among baseline and seeded BootstrapFewShot parameter snapshots.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @since 0.1.0
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { Effect, Option } from "effect"
import type { Schema } from "effect"
import type * as Layer from "effect/Layer"
import { AllTrialsFailed } from "../../Errors/optimizer.js"
import type { Example } from "../../Example/index.js"
import type { Metric } from "../../Metric/model.js"
import * as Module from "../../Module/index.js"
import type { Module as DspModule } from "../../Module/model.js"
import { buildCandidateStates, normalizeNonNegative, resolveSeeds } from "./runtime/candidates.js"
import { scoreCandidates, selectBestCandidate } from "./runtime/search.js"

/**
 * Configures seeded bootstrap candidates and their validation comparison.
 *
 * @typeParam I - Module input fields decoded during candidate evaluation.
 * @typeParam O - Module output fields scored by the metric.
 * @typeParam ME - Expected failure type of the metric.
 * @typeParam MR - Services required by the metric.
 *
 * @since 0.1.0
 * @category models
 */
export type BootstrapRSOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
> = Readonly<{
  /** Module loaded with each candidate in turn, then left in the winning state. */
  readonly module: DspModule<I, O>
  /** Bootstrap input; each seed deterministically rotates this sequence. */
  readonly trainset: ReadonlyArray<Example>
  /** Candidate-scoring examples. Defaults to `trainset`. */
  readonly valset?: ReadonlyArray<Example>
  /** Metric used by both bootstrapping and candidate evaluation. */
  readonly metric: Metric<ME, MR>
  /** Bootstrap restart count; zero still evaluates uncompiled and labeled baselines. */
  readonly numCandidates: number
  /** Bootstrap seeds; a supplied array shorter than the restart count reduces the candidate count. */
  readonly seeds?: ReadonlyArray<number>
  /** Round cap forwarded to each bootstrap restart; defaults to `1`. */
  readonly maxRounds?: number
  /** Trace-demo cap forwarded to each bootstrap restart; defaults to `1`. */
  readonly maxBootstrappedDemos?: number
  /** Labeled prefix cap for bootstrap and labeled-baseline construction; defaults to `1`. */
  readonly maxLabeledDemos?: number
  /** Acceptance threshold forwarded to BootstrapFewShot. */
  readonly threshold?: number
  /** Enables labeled fallback inside each bootstrap restart. */
  readonly fallbackToLabeledFewShot?: boolean
  /** Labeled fallback count forwarded to each bootstrap restart. */
  readonly fallbackLabeledDemoCount?: number
  /** Language model Layer used during bootstrap trace collection. */
  readonly teacher?: Layer.Layer<LanguageModel.LanguageModel, never, never>
}>

const noCandidateError = () =>
  new AllTrialsFailed({
    message: "BootstrapRS failed to evaluate any candidate",
    trialCount: 0
  })

/**
 * Evaluates baseline and seeded bootstrap states and loads the highest score.
 *
 * @remarks
 * Candidate construction starts with the initial state and one labeled
 * few-shot state, followed by sequential BootstrapFewShot runs over seeded
 * rotations of `trainset`. Failed bootstrap runs are dropped. Every remaining
 * state is evaluated sequentially on `valset`, or `trainset` when omitted;
 * evaluation failures are also dropped. The first highest-scoring state wins
 * and is loaded into the supplied module.
 *
 * `AllTrialsFailed` means no candidate completed evaluation. Other setup and
 * final-load failures retain their typed channels. Candidate evaluation mutates
 * the module while states are compared, so concurrent use of that module is
 * unsafe until this effect completes.
 *
 * @typeParam I - Module input fields decoded during evaluation.
 * @typeParam O - Module output fields scored by the metric.
 * @typeParam ME - Expected failure type of the metric.
 * @typeParam MR - Services required by the metric.
 * @param options - Candidate generation, validation, metric, and bootstrap settings.
 * @returns The supplied module loaded with the selected parameter snapshot.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al. (2023)}
 * @since 0.1.0
 * @category constructors
 */
export const bootstrapRS = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
>(options: BootstrapRSOptions<I, O, ME, MR>) =>
  Effect.gen(function*() {
    const seeds = resolveSeeds({
      numCandidates: normalizeNonNegative(options.numCandidates),
      ...Option.match(Option.fromNullable(options.seeds), {
        onNone: () => ({}),
        onSome: (provided) => ({ seeds: provided })
      })
    })
    const valset = Option.getOrElse(Option.fromNullable(options.valset), () => options.trainset)
    const maxRounds = Option.getOrElse(Option.fromNullable(options.maxRounds), () => 1)
    const maxBootstrappedDemos = Option.getOrElse(Option.fromNullable(options.maxBootstrappedDemos), () => 1)
    const baselineLabeledCount = Option.getOrElse(Option.fromNullable(options.maxLabeledDemos), () => 1)
    const initialState = yield* Module.save(options.module)

    const allCandidates = yield* buildCandidateStates({
      module: options.module,
      initialState,
      trainset: options.trainset,
      metric: options.metric,
      seeds,
      maxRounds,
      maxBootstrappedDemos,
      ...Option.match(Option.fromNullable(options.maxLabeledDemos), {
        onNone: () => ({}),
        onSome: (maxLabeledDemos) => ({ maxLabeledDemos })
      }),
      ...Option.match(Option.fromNullable(options.threshold), {
        onNone: () => ({}),
        onSome: (threshold) => ({ threshold })
      }),
      ...Option.match(Option.fromNullable(options.teacher), {
        onNone: () => ({}),
        onSome: (teacher) => ({ teacher })
      }),
      ...Option.match(Option.fromNullable(options.fallbackToLabeledFewShot), {
        onNone: () => ({}),
        onSome: (fallbackToLabeledFewShot) => ({ fallbackToLabeledFewShot })
      }),
      ...Option.match(Option.fromNullable(options.fallbackLabeledDemoCount), {
        onNone: () => ({}),
        onSome: (fallbackLabeledDemoCount) => ({ fallbackLabeledDemoCount })
      }),
      baselineLabeledCount
    })

    if (allCandidates.length <= 0) {
      return yield* Effect.fail(noCandidateError())
    }

    const scoredCandidates = yield* scoreCandidates({
      module: options.module,
      candidates: allCandidates,
      valset,
      metric: options.metric
    })

    if (scoredCandidates.length <= 0) {
      return yield* Effect.fail(noCandidateError())
    }

    const selectedCandidate = yield* selectBestCandidate(scoredCandidates)

    yield* Module.load(options.module, selectedCandidate.state)

    return options.module
  })
