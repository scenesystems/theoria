/**
 * Selects among baseline and seeded BootstrapFewShot parameter snapshots.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @since 0.1.0
 * @module
 */
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { Array as Arr, Data, Effect, Exit, Option, Ref, Tuple } from "effect"
import type { Schema } from "effect"
import type * as Layer from "effect/Layer"
import { AllTrialsFailed } from "./DspError.js"
import {
  type BootstrapRSExamples,
  type BootstrapRSSeeds,
  buildCandidateStates,
  BuildCandidateStatesOptions,
  normalizeNonNegative,
  resolveSeeds,
  ResolveSeedsOptions
} from "./internal/bootstrapRS/runtime/candidates.js"
import { scoreCandidates, ScoreCandidatesOptions, selectBestCandidate } from "./internal/bootstrapRS/runtime/search.js"
import { collectModuleParamRefs } from "./internal/moduleParameters.js"
import type { Metric } from "./Metric.js"
import * as Module from "./Module.js"
import type { Module as DspModule } from "./Module.js"

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
export class Options<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
> extends Data.Class<{
  /** Module loaded with each candidate in turn, then left in the winning state. */
  readonly module: DspModule<I, O, E, R>
  /** Bootstrap input; each seed deterministically rotates this sequence. */
  readonly trainset: BootstrapRSExamples
  /** Candidate-scoring examples. Defaults to `trainset`. */
  readonly valset?: BootstrapRSExamples
  /** Metric used by both bootstrapping and candidate evaluation. */
  readonly metric: Metric<ME, MR, Schema.Schema.Type<Schema.Struct<O>>>
  /** Bootstrap restart count; zero still evaluates uncompiled and labeled baselines. */
  readonly numCandidates: number
  /** Bootstrap seeds; a supplied array shorter than the restart count reduces the candidate count. */
  readonly seeds?: BootstrapRSSeeds
  /** Round cap forwarded to each bootstrap restart; defaults to `1`. */
  readonly maxRounds?: number
  /** Trace-demo cap forwarded to each bootstrap restart; defaults to `1`. */
  readonly maxBootstrappedDemos?: number
  /** Labeled cap for bootstrap and each destination's compatible baseline; defaults to `1`. */
  readonly maxLabeledDemos?: number
  /** Acceptance threshold forwarded to BootstrapFewShot. */
  readonly threshold?: number
  /** Enables labeled fallback inside each bootstrap restart. */
  readonly fallbackToLabeledFewShot?: boolean
  /** Labeled fallback count forwarded to each bootstrap restart. */
  readonly fallbackLabeledDemoCount?: number
  /** Language model Layer used during bootstrap trace collection. */
  readonly teacher?: Layer.Layer<LanguageModel.LanguageModel, never, never>
}> {}

const noCandidateError = () =>
  new AllTrialsFailed({
    message: "BootstrapRS failed to evaluate any candidate",
    trialCount: 0
  })

/**
 * Evaluates baseline and seeded bootstrap states and loads the highest score.
 *
 * @remarks
 * Candidate construction starts with the initial state and one destination-aware
 * labeled state, followed by sequential BootstrapFewShot runs over seeded
 * rotations of `trainset`. Each destination's labeled state samples only examples
 * accepted by its own demonstration contract and remains empty when none are
 * compatible. Construction failures propagate. Every state is evaluated
 * sequentially on `valset`, or `trainset` when omitted; candidates with zero
 * successful examples are excluded. The first highest-scoring state wins and is
 * loaded into the supplied module.
 *
 * `AllTrialsFailed` means no candidate completed evaluation. Other setup and
 * final-load failures retain their typed channels. Candidate evaluation mutates
 * the module while states are compared. Failure or interruption restores every
 * original parameter Ref, including children, before the effect exits. Success
 * retains the selected state. Concurrent use of the module remains unsafe.
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
export const run = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
>(options: Options<I, O, ME, MR, E, R>) =>
  Effect.acquireUseRelease(
    Effect.forEach(collectModuleParamRefs(options.module), (entry) =>
      Ref.get(entry.params).pipe(Effect.map((params) => Tuple.make(entry.params, params)))),
    () =>
      Effect.gen(function*() {
        const seeds = resolveSeeds(
          new ResolveSeedsOptions({
            numCandidates: normalizeNonNegative(options.numCandidates),
            ...Option.match(Option.fromNullable(options.seeds), {
              onNone: () => ({}),
              onSome: (provided) => ({ seeds: provided })
            })
          })
        )
        const valset = Option.getOrElse(Option.fromNullable(options.valset), () =>
          options.trainset)
        const maxRounds = Option.getOrElse(Option.fromNullable(options.maxRounds), () => 1)
        const maxBootstrappedDemos = Option.getOrElse(Option.fromNullable(options.maxBootstrappedDemos), () => 1)
        const baselineLabeledCount = Option.getOrElse(Option.fromNullable(options.maxLabeledDemos), () => 1)
        const initialState = yield* Module.save(options.module)

        const allCandidates = yield* buildCandidateStates(
          new BuildCandidateStatesOptions({
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
        )

        yield* Effect.if(Option.isNone(Arr.head(allCandidates)), {
          onFalse: () => Effect.void,
          onTrue: noCandidateError
        })

        const scoredCandidates = yield* scoreCandidates(
          new ScoreCandidatesOptions({
            module: options.module,
            candidates: allCandidates,
            valset,
            metric: options.metric
          })
        )

        yield* Effect.if(Option.isNone(Arr.head(scoredCandidates)), {
          onFalse: () => Effect.void,
          onTrue: noCandidateError
        })

        const selectedCandidate = yield* selectBestCandidate(scoredCandidates)

        yield* Module.load(options.module, selectedCandidate.state)

        return options.module
      }),
    (snapshot, exit) =>
      Exit.match(exit, {
        onFailure: () => Effect.forEach(snapshot, ([ref, params]) => Ref.set(ref, params), { discard: true }),
        onSuccess: () => Effect.void
      })
  )
