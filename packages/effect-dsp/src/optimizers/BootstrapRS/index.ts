/**
 * BootstrapRS optimizer — random-search variant that runs multiple independent
 * BootstrapFewShot restarts and selects the best configuration via
 * effect-search.
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
 * Options for seeded BootstrapFewShot restarts and validation selection.
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
  /** Module restored between candidates, then loaded with the winning state. */
  readonly module: DspModule<I, O>
  /** Bootstrap input; each seed deterministically rotates this sequence. */
  readonly trainset: ReadonlyArray<Example>
  /** Candidate-scoring examples. Defaults to `trainset`. */
  readonly valset?: ReadonlyArray<Example>
  /** Metric used by both bootstrapping and candidate evaluation. */
  readonly metric: Metric<ME, MR>
  /** Number of candidate restarts; non-positive values fail with `AllTrialsFailed`. */
  readonly numCandidates: number
  /** Candidate seeds; missing entries are deterministically generated. */
  readonly seeds?: ReadonlyArray<number>
  readonly maxRounds?: number
  readonly maxBootstrappedDemos?: number
  readonly maxLabeledDemos?: number
  readonly threshold?: number
  readonly fallbackToLabeledFewShot?: boolean
  readonly fallbackLabeledDemoCount?: number
  readonly teacher?: Layer.Layer<LanguageModel.LanguageModel, never, never>
}>

const noCandidateError = () =>
  new AllTrialsFailed({
    message: "BootstrapRS failed to evaluate any candidate",
    trialCount: 0
  })

/**
 * Selects a BootstrapFewShot module state by evaluating candidates across seeds.
 *
 * @remarks
 * BootstrapFewShot runs across candidate seeds sequentially, each saved
 * candidate is scored on `valset`, and the highest-scoring state is loaded into
 * `module`. Ties preserve candidate order. Failed bootstrap candidates are
 * excluded; absence of any buildable or scoreable candidate fails with
 * `AllTrialsFailed`. The seed changes deterministic training-set rotation, not
 * Effect's random service.
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
