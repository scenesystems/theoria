/**
 * Selects among baseline and seeded BootstrapFewShot parameter snapshots.
 *
 * @see {@link https://arxiv.org/abs/2310.03714 | Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines", 2023}
 * @since 0.1.0
 * @module
 */
import { empty as emptySettings, type ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import { Array as Arr, Data, Effect, Option, Schema } from "effect"
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
import type { Metric } from "./Metric.js"
import * as Module from "./Module.js"
import type { Module as DspModule } from "./Module.js"
import * as Optimized from "./Optimized.js"
import * as ParameterSet from "./ParameterSet.js"

/** Candidate validation scores and the selected index in construction order.
 * A missing score denotes a candidate with no successful evaluation rows.
 * @since 0.6.0
 * @category models
 */
export class Report extends Schema.Class<Report>("@scenesystems/effect-dsp/BootstrapRS/Report")({
  candidates: Schema.Array(Schema.Struct({ label: Schema.String, score: Schema.Option(Schema.Finite) })),
  selectedIndex: Schema.Int
}) {}

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
  /** Program evaluated under overlays without changing its parameter refs. */
  readonly module: DspModule<I, O, E, R>
  /** Bootstrap input; each seed deterministically rotates this sequence. */
  readonly trainset: BootstrapRSExamples
  /** Candidate-scoring examples. Defaults to `trainset`. */
  readonly valset?: BootstrapRSExamples
  /** Metric used by both bootstrapping and candidate evaluation. */
  readonly metric: Metric<ME, MR>
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
  readonly metricThreshold?: Option.Option<number>
  /** Failure count that raises TooManyErrors. */
  readonly maxErrors?: Option.Option<number>
  /** Teacher program used during bootstrap trace collection. */
  readonly teacher?: DspModule<I, O, E, R>
  /** Generation settings for the teacher role. */
  readonly teacherSettings?: ModelSettings
}> {}

const noCandidateError = () =>
  new AllTrialsFailed({
    message: "BootstrapRS failed to evaluate any candidate",
    trialCount: 0
  })

/**
 * Evaluates baseline and seeded bootstrap states and binds the highest score.
 *
 * @remarks
 * Candidate construction starts with the initial state and one destination-aware
 * labeled state, followed by sequential BootstrapFewShot runs over seeded
 * rotations of `trainset`. Each destination's labeled state samples only examples
 * accepted by its own demonstration contract and remains empty when none are
 * compatible. Construction failures propagate. Every state is evaluated
 * sequentially on `valset`, or `trainset` when omitted; candidates with zero
 * successful examples are excluded. The first highest-scoring state wins and is
 * returned as a bound copy of the supplied module.
 *
 * `AllTrialsFailed` means no candidate completed evaluation. Other setup and
 * evaluation failures retain their typed channels. Each candidate executes with
 * its own immutable overlay. Success, failure, and interruption leave the
 * caller's parameter refs unchanged.
 *
 * @typeParam I - Module input fields decoded during evaluation.
 * @typeParam O - Module output fields scored by the metric.
 * @typeParam ME - Expected failure type of the metric.
 * @typeParam MR - Services required by the metric.
 * @param options - Candidate generation, validation, metric, and bootstrap settings.
 * @returns A bound program, selected parameters, and candidate scores.
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
  Effect.gen(function*() {
    const seeds = resolveSeeds(
      new ResolveSeedsOptions({
        numCandidates: normalizeNonNegative(options.numCandidates),
        ...Option.match(Option.fromUndefinedOr(options.seeds), {
          onNone: () => ({}),
          onSome: (provided) => ({ seeds: provided })
        })
      })
    )
    const valset = Option.getOrElse(Option.fromUndefinedOr(options.valset), () => options.trainset)
    const maxRounds = Option.getOrElse(Option.fromUndefinedOr(options.maxRounds), () => 1)
    const maxBootstrappedDemos = Option.getOrElse(Option.fromUndefinedOr(options.maxBootstrappedDemos), () => 1)
    const baselineLabeledCount = Option.getOrElse(Option.fromUndefinedOr(options.maxLabeledDemos), () => 1)
    const initialState = yield* ParameterSet.snapshot(options.module)

    const allCandidates = yield* buildCandidateStates(
      new BuildCandidateStatesOptions({
        module: options.module,
        initialState,
        trainset: options.trainset,
        metric: options.metric,
        seeds,
        maxRounds,
        maxBootstrappedDemos,
        ...Option.match(Option.fromUndefinedOr(options.maxLabeledDemos), {
          onNone: () => ({}),
          onSome: (maxLabeledDemos) => ({ maxLabeledDemos })
        }),
        metricThreshold: options.metricThreshold ?? Option.none(),
        maxErrors: options.maxErrors ?? Option.none(),
        teacherSettings: options.teacherSettings ?? emptySettings,
        ...Option.match(Option.fromUndefinedOr(options.teacher), {
          onNone: () => ({}),
          onSome: (teacher) => ({ teacher })
        }),
        baselineLabeledCount
      })
    )

    yield* Effect.suspend(() =>
      Option.match(Arr.head(allCandidates), {
        onSome: () => Effect.void,
        onNone: noCandidateError
      })
    )

    const scoredCandidates = yield* scoreCandidates(
      new ScoreCandidatesOptions({
        module: options.module,
        candidates: allCandidates,
        valset,
        metric: options.metric
      })
    )

    yield* Effect.suspend(() =>
      Option.match(Arr.head(scoredCandidates), {
        onSome: () => Effect.void,
        onNone: noCandidateError
      })
    )

    const selectedCandidate = yield* selectBestCandidate(scoredCandidates)

    return new Optimized.Result({
      program: Module.bound(options.module, selectedCandidate.state),
      parameters: selectedCandidate.state,
      report: new Report({
        candidates: Arr.map(
          allCandidates,
          (candidate) => ({
            label: candidate.label,
            score: Option.map(
              Arr.findFirst(scoredCandidates, ([entry]) => entry === candidate),
              ([, score]) => score
            )
          })
        ),
        selectedIndex: Option.getOrThrow(
          Arr.findFirstIndex(allCandidates, (candidate) => candidate === selectedCandidate)
        )
      })
    })
  })
