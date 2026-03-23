/**
 * BootstrapRS optimizer — random-search variant that runs multiple independent
 * BootstrapFewShot restarts and selects the best configuration via
 * effect-search.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @since 0.0.0
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
 * BootstrapRS constructor options.
 *
 * @since 0.0.0
 * @category models
 */
export type BootstrapRSOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
> = Readonly<{
  readonly module: DspModule<I, O>
  readonly trainset: ReadonlyArray<Example>
  readonly valset?: ReadonlyArray<Example>
  readonly metric: Metric<ME, MR>
  readonly numCandidates: number
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
 * Run BootstrapFewShot across candidate seeds and keep the best validation performer.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al. (2023)}
 * @since 0.0.0
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
