/**
 * Evaluates text profiles against expected layouts, scores their fidelity, and
 * searches for better profile parameters with reproducible Effect optimizations.
 *
 * @since 0.5.0
 * @module
 */
import { Statistics } from "@scenesystems/effect-math"
import { OptimizationEvent, OptimizationSnapshot, Sampler, SearchSpace } from "@scenesystems/effect-search"
import type { Optimization, OptimizationStorage } from "@scenesystems/effect-search"
import { Data, Effect, Option, Schema, Struct } from "effect"
import * as Arr from "effect/Array"
import type * as Layer from "effect/Layer"

import { evaluate as evaluateInternal } from "./internal/calibration/evaluation.js"
import { runFreshOptimization, runResumedOptimization } from "./internal/calibration/optimization.js"
import { scoreReport } from "./internal/calibration/scoring.js"
import type * as MeasurementCache from "./MeasurementCache.js"
import * as Text from "./Text.js"
import type * as TextMeasurer from "./TextMeasurer.js"

const FiniteNumber = Schema.Number.pipe(Schema.finite())
const NonNegativeNumber = FiniteNumber.pipe(Schema.greaterThanOrEqualTo(0))
const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))
const PositiveNumber = FiniteNumber.pipe(Schema.greaterThan(0))
const SignedInt = Schema.Number.pipe(Schema.int())

/**
 * Expected visual text and painted width for one output line.
 *
 * @since 0.5.0
 * @category schemas
 */
export const TargetLine = Schema.Struct({
  /** Exact visual-order text expected for the line. */
  text: Schema.String,
  /** Exact painted width expected in measurement-service units. */
  width: NonNegativeNumber
})

/**
 * Expected visual text and painted width for one output line.
 *
 * @since 0.5.0
 * @category models
 */
export type TargetLine = typeof TargetLine.Type

/**
 * Ordered exact line projections for one calibration target.
 *
 * @since 0.5.0
 * @category schemas
 */
export const TargetLines = Schema.Array(TargetLine)

/**
 * Ordered exact line projections for one calibration target.
 *
 * @since 0.5.0
 * @category models
 */
export type TargetLines = typeof TargetLines.Type

/**
 * Expected aggregate geometry and optional exact lines for one sample.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Target = Schema.Struct({
  /** Expected number of output lines. */
  lineCount: NonNegativeInt,
  /** Expected greatest painted line width. */
  maxLineWidth: NonNegativeNumber,
  /** Optional exact visual lines; omission disables line-level comparison. */
  lines: Schema.optional(TargetLines)
})

/**
 * Expected aggregate geometry and optional exact lines for one sample.
 *
 * @since 0.5.0
 * @category models
 */
export type Target = typeof Target.Type

/**
 * Named prepare and layout input paired with its expected projection.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Case = Schema.Struct({
  /** Stable case label copied into evaluation results. */
  name: Schema.String,
  /** Input compiled for each candidate profile. */
  prepare: Text.Input,
  /** Geometry applied to the prepared handle. */
  layout: Text.Request,
  /** Expected geometry and optional exact lines. */
  expected: Target
})

/**
 * Named prepare and layout input paired with its expected projection.
 *
 * @since 0.5.0
 * @category models
 */
export type Case = typeof Case.Type

/**
 * Ordered corpus evaluated by a calibration run.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Cases = Schema.Array(Case)

/**
 * Ordered corpus evaluated by a calibration run.
 *
 * @since 0.5.0
 * @category models
 */
export type Cases = typeof Cases.Type

/**
 * Named text profile candidate evaluated against a corpus.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Profile = Schema.Struct({
  /** Candidate label copied into the aggregate report. */
  name: Schema.String,
  /** Preparation settings installed while evaluating the candidate. */
  profile: Text.Profile
})

/**
 * Named text profile candidate evaluated against a corpus.
 *
 * @since 0.5.0
 * @category models
 */
export type Profile = typeof Profile.Type

/**
 * Expected and actual projections plus signed deltas and match state.
 *
 * @since 0.5.0
 * @category schemas
 */
export const CaseResult = Schema.Struct({
  /** Source case label. */
  name: Schema.String,
  /** Expected projection from the corpus. */
  expected: Target,
  /** Aggregate geometry produced by the candidate. */
  actual: Text.Summary,
  /** Visual lines produced by the candidate. */
  actualLines: Text.Lines,
  /** Signed `actual.lineCount - expected.lineCount`. */
  lineCountDelta: SignedInt,
  /** Signed `actual.maxLineWidth - expected.maxLineWidth`. */
  maxLineWidthDelta: FiniteNumber,
  /** Positional text or width mismatches; zero when expected lines are omitted. */
  lineMismatchCount: NonNegativeInt,
  /** Whether aggregate geometry and every supplied line expectation match exactly. */
  matched: Schema.Boolean
})

/**
 * Expected and actual projections plus signed deltas and match state.
 *
 * @since 0.5.0
 * @category models
 */
export type CaseResult = typeof CaseResult.Type

/**
 * Ordered per-case results retained by a calibration report.
 *
 * @since 0.5.0
 * @category schemas
 */
export const CaseResults = Schema.Array(CaseResult)

/**
 * Ordered per-case results retained by a calibration report.
 *
 * @since 0.5.0
 * @category models
 */
export type CaseResults = typeof CaseResults.Type

/**
 * Candidate profile, aggregate absolute errors, and per-case results.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Report = Schema.Struct({
  /** Candidate evaluated by the report. */
  profile: Profile,
  /** Number of evaluated cases. */
  caseCount: NonNegativeInt,
  /** Number of cases with exact aggregate and optional line matches. */
  matchedCaseCount: NonNegativeInt,
  /** Sum of absolute line-count deltas. */
  totalLineCountError: NonNegativeInt,
  /** Sum of absolute maximum-width deltas. */
  totalMaxLineWidthError: NonNegativeNumber,
  /** Sum of positional line mismatches. */
  totalLineMismatchCount: NonNegativeInt,
  /** Case results in corpus order. */
  results: CaseResults
})

/**
 * Candidate profile, aggregate absolute errors, and per-case results.
 *
 * @since 0.5.0
 * @category models
 */
export type Report = typeof Report.Type

/**
 * Positive multipliers used to collapse calibration penalties into one loss.
 *
 * @since 0.5.0
 * @category schemas
 */
export const ScoreWeights = Schema.Struct({
  /** Multiplier applied to each positional line mismatch. */
  lineMismatchCount: PositiveNumber,
  /** Multiplier applied to each absolute line-count delta. */
  lineCountError: PositiveNumber,
  /** Multiplier applied to absolute maximum-width error. */
  maxLineWidthError: PositiveNumber
})

/**
 * Positive multipliers used to collapse calibration penalties into one loss.
 *
 * @since 0.5.0
 * @category models
 */
export type ScoreWeights = typeof ScoreWeights.Type

/**
 * Weighted single-objective minimization policy for calibration studies.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Objective = Schema.Struct({
  /** Caller-defined label recorded with optimization artifacts. */
  name: Schema.String,
  /** Fixed direction consumed by calibration studies. */
  direction: Schema.Literal("minimize"),
  /** Fixed formula used to collapse penalties. */
  scorer: Schema.Literal("weighted-sum"),
  /** Diagnostic ordering label for the line mismatch penalty. */
  primaryMetric: Schema.Literal("lineMismatchCount"),
  /** Diagnostic ordering label for the line-count penalty. */
  secondaryMetric: Schema.Literal("lineCountError"),
  /** Diagnostic ordering label for the maximum-width penalty. */
  tertiaryMetric: Schema.Literal("maxLineWidthError"),
  /** Positive multipliers used by the weighted sum. */
  scoreWeights: ScoreWeights
})

/**
 * Weighted single-objective minimization policy for calibration studies.
 *
 * @since 0.5.0
 * @category models
 */
export type Objective = typeof Objective.Type

const EmptyLossSummary = Schema.Struct({
  count: Schema.Literal(0),
  mean: Schema.Literal(0),
  minimum: Schema.Literal(0),
  maximum: Schema.Literal(0),
  variance: Schema.Literal(0),
  standardDeviation: Schema.Literal(0)
})

const NonEmptyLossSummary = Statistics.SummaryStatistics.pipe(
  Schema.pick("count", "mean", "min", "max", "variance", "standardDeviation"),
  Schema.rename({ min: "minimum", max: "maximum" })
)

/**
 * Descriptive statistics for weighted per-case losses, with an explicit zero
 * representation for an empty corpus.
 *
 * @since 0.5.0
 * @category schemas
 */
export const LossSummary = Schema.Union(EmptyLossSummary, NonEmptyLossSummary)

/**
 * Descriptive statistics for weighted per-case losses.
 *
 * @since 0.5.0
 * @category models
 */
export type LossSummary = typeof LossSummary.Type

/**
 * Ordered non-negative per-case losses produced by weighted scoring.
 *
 * @since 0.5.0
 * @category schemas
 */
export const CaseLosses = Schema.Array(NonNegativeNumber)

/**
 * Ordered non-negative per-case losses produced by weighted scoring.
 *
 * @since 0.5.0
 * @category models
 */
export type CaseLosses = typeof CaseLosses.Type

/**
 * Per-case losses, their descriptive summary, and their total.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Score = Schema.Struct({
  /** Weighted loss for each report result in report order. */
  caseLosses: CaseLosses,
  /** Descriptive statistics over the per-case losses. */
  summary: LossSummary,
  /** Sum of every per-case loss. */
  total: NonNegativeNumber
})

/**
 * Per-case losses, their descriptive summary, and their total.
 *
 * @since 0.5.0
 * @category models
 */
export type Score = typeof Score.Type

/**
 * Non-negative inclusive float bounds and an optional quantization step.
 *
 * @since 0.5.0
 * @category schemas
 */
export const FloatDimension = Schema.Struct({
  /** Inclusive sampling lower bound. */
  low: NonNegativeNumber,
  /** Inclusive sampling upper bound; compilation requires `high >= low`. */
  high: NonNegativeNumber,
  /** Optional positive quantization interval. */
  step: Schema.optional(PositiveNumber)
})

/**
 * Non-negative inclusive float bounds and an optional quantization step.
 *
 * @since 0.5.0
 * @category models
 */
export type FloatDimension = typeof FloatDimension.Type

/**
 * Positive inclusive integer bounds and an optional sampling interval.
 *
 * @since 0.5.0
 * @category schemas
 */
export const IntDimension = Schema.Struct({
  /** Inclusive positive integer lower bound. */
  low: PositiveInt,
  /** Inclusive positive integer upper bound; compilation requires `high >= low`. */
  high: PositiveInt,
  /** Optional positive integer sampling interval. */
  step: Schema.optional(PositiveInt)
})

/**
 * Positive inclusive integer bounds and an optional sampling interval.
 *
 * @since 0.5.0
 * @category models
 */
export type IntDimension = typeof IntDimension.Type

/**
 * Ordered non-empty text-direction choices supplied to a sampler.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Directions = Schema.NonEmptyArray(Text.Direction)

/**
 * Ordered non-empty text-direction choices supplied to a sampler.
 *
 * @since 0.5.0
 * @category models
 */
export type Directions = typeof Directions.Type

/**
 * Categorical choices for `Text.Profile.defaultDirection`.
 *
 * @since 0.5.0
 * @category schemas
 */
export const DirectionDimension = Schema.Struct({
  /** Ordered non-empty direction choices supplied to the sampler. */
  values: Directions
})

/**
 * Categorical choices for `Text.Profile.defaultDirection`.
 *
 * @since 0.5.0
 * @category models
 */
export type DirectionDimension = typeof DirectionDimension.Type

/**
 * Ordered non-empty boolean choices supplied to a sampler.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Booleans = Schema.NonEmptyArray(Schema.Boolean)

/**
 * Ordered non-empty boolean choices supplied to a sampler.
 *
 * @since 0.5.0
 * @category models
 */
export type Booleans = typeof Booleans.Type

/**
 * Categorical choices for one text-profile toggle.
 *
 * @since 0.5.0
 * @category schemas
 */
export const BooleanDimension = Schema.Struct({
  /** Ordered non-empty boolean choices supplied to the sampler. */
  values: Booleans
})

/**
 * Categorical choices for one text-profile toggle.
 *
 * @since 0.5.0
 * @category models
 */
export type BooleanDimension = typeof BooleanDimension.Type

/**
 * Tunable dimensions corresponding one-for-one with text-profile fields.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Search = Schema.Struct({
  /** Search bounds for `Text.Profile.lineFitEpsilon`. */
  lineFitEpsilon: FloatDimension,
  /** Search bounds for `Text.Profile.tabWidth`. */
  tabWidth: IntDimension,
  /** Candidate values for `Text.Profile.defaultDirection`. */
  defaultDirection: DirectionDimension,
  /** Candidate values for `Text.Profile.preferEarlySoftHyphenBreak`. */
  preferEarlySoftHyphenBreak: BooleanDimension,
  /** Candidate values for `Text.Profile.preferPrefixWidthsForBreakableRuns`. */
  preferPrefixWidthsForBreakableRuns: BooleanDimension
})

/**
 * Tunable dimensions corresponding one-for-one with text-profile fields.
 *
 * @since 0.5.0
 * @category models
 */
export type Search = typeof Search.Type

const OptimizationEventLog = Schema.Array(OptimizationEvent.OptimizationEvent)

/**
 * Resumable snapshot and ordered events from one optimization invocation.
 *
 * @since 0.5.0
 * @category schemas
 */
export const OptimizationArtifacts = Schema.Struct({
  /** Cumulative checkpoint after the requested trials finish. */
  snapshot: OptimizationSnapshot.OptimizationSnapshot,
  /** Events emitted by the current invocation in emission order. */
  eventLog: OptimizationEventLog
})

/**
 * Resumable snapshot and ordered events from one optimization invocation.
 *
 * @since 0.5.0
 * @category models
 */
export type OptimizationArtifacts = typeof OptimizationArtifacts.Type

/**
 * Persistable optimization metadata and diagnostics for the selected profile.
 *
 * @since 0.5.0
 * @category schemas
 */
export const OptimizationReport = Schema.Struct({
  /** Weighted minimization policy used by the optimization. */
  objective: Objective,
  /** Dimensions compiled for candidate sampling. */
  search: Search,
  /** Stop condition reported by Effect Search. */
  completionReason: OptimizationEvent.CompletionReason,
  /** Weighted total loss of the selected profile. */
  bestScore: NonNegativeNumber,
  /** Distribution of the selected profile's per-case losses. */
  bestLossSummary: LossSummary,
  /** Checkpoint and events available for persistence. */
  artifacts: OptimizationArtifacts
})

/**
 * Persistable optimization metadata and diagnostics for the selected profile.
 *
 * @since 0.5.0
 * @category models
 */
export type OptimizationReport = typeof OptimizationReport.Type

/**
 * Reports that supplied optimization storage did not retain the generated snapshot.
 * The wire tag remains `CalibrationSnapshotMissing` for persisted failures.
 *
 * @since 0.5.0
 * @category errors
 */
export class OptimizationSnapshotMissing extends Schema.TaggedError<OptimizationSnapshotMissing>(
  "@scenesystems/effect-text/Calibration/OptimizationSnapshotMissing"
)(
  "CalibrationSnapshotMissing",
  {
    /** Number of trials the storage still retained in its trial log. */
    trialLogLength: NonNegativeInt
  }
) {}

/**
 * Reports that supplied storage resolved to a multi-objective optimization result.
 * The wire tag remains `CalibrationStudyNotSingleObjective` for persisted failures.
 *
 * @since 0.5.0
 * @category errors
 */
export class OptimizationNotSingleObjective extends Schema.TaggedError<OptimizationNotSingleObjective>(
  "@scenesystems/effect-text/Calibration/OptimizationNotSingleObjective"
)(
  "CalibrationStudyNotSingleObjective",
  {
    /** Number of trials retained by the multi-objective result. */
    trialCount: NonNegativeInt,
    /** Number of non-dominated trials on the stored Pareto front. */
    paretoFrontSize: NonNegativeInt
  }
) {}

/**
 * Configures a fresh or resumed profile optimization.
 *
 * @since 0.5.0
 * @category models
 */
export class OptimizeOptions extends Data.Class<{
  /** Calibration corpus evaluated for every candidate. */
  readonly cases: Cases
  /** Segmentation and measurement-cache layer acquired for candidate evaluation. */
  readonly services: Layer.Layer<Text.Segmenter | MeasurementCache.MeasurementCache>
  /** Fresh or additional trial budget; must be a non-negative integer. */
  readonly trials: number
  /** Weighted minimization policy; defaults to {@link defaultObjective}. */
  readonly objective?: Objective
  /** Candidate sampler; defaults to seed-zero TPE. */
  readonly sampler?: Sampler.Sampler
  /** Preferred text-profile search dimensions. */
  readonly search?: Search
  /** Prior checkpoint whose completed trials seed the resumed optimization. */
  readonly snapshot?: OptimizationSnapshot.OptimizationSnapshot
  /** Optional Effect Search persistence service for trial logs and checkpoints. */
  readonly optimizationStorage?: OptimizationStorage.Service
}> {}

/**
 * Selected profile, evaluated report, optimization result, and resumable artifacts.
 *
 * @since 0.5.0
 * @category models
 */
export class OptimizationResult extends Data.Class<{
  /** Lowest-loss profile selected by the completed study. */
  readonly bestProfile: Profile
  /** Final evaluation of the selected profile. */
  readonly bestReport: Report
  /** Effect Search single-objective result. */
  readonly optimizationResult: Optimization.SingleObjectiveResult<Text.Profile>
  /** Persistable optimization metadata and artifacts. */
  readonly optimization: OptimizationReport
}> {}

/**
 * Weighted-sum objective with penalties of 10,000 for line mismatches, 1,000
 * for line-count error, and 1 for maximum-width error.
 *
 * @since 0.5.0
 * @category defaults
 */
export const defaultObjective: Objective = {
  name: "weighted-layout-fidelity",
  direction: "minimize",
  scorer: "weighted-sum",
  primaryMetric: "lineMismatchCount",
  secondaryMetric: "lineCountError",
  tertiaryMetric: "maxLineWidthError",
  scoreWeights: {
    lineMismatchCount: 10_000,
    lineCountError: 1_000,
    maxLineWidthError: 1
  }
}

/**
 * Search dimensions covering fit epsilon from 0 through 0.05, tab widths from
 * 2 through 8, both directions, and both values of each break preference.
 *
 * @since 0.5.0
 * @category defaults
 */
export const defaultSearch: Search = {
  lineFitEpsilon: { low: 0, high: 0.05, step: 0.001 },
  tabWidth: { low: 2, high: 8, step: 1 },
  defaultDirection: { values: Text.Direction.literals },
  preferEarlySoftHyphenBreak: { values: Arr.make(false, true) },
  preferPrefixWidthsForBreakableRuns: { values: Arr.make(true, false) }
}

/**
 * Evaluates a candidate profile against expected aggregate geometry and exact
 * visual lines. Cases run sequentially in corpus order.
 *
 * @since 0.5.0
 * @category evaluation
 */
export const evaluate = (
  profile: Profile,
  cases: Cases
): Effect.Effect<Report, TextMeasurer.Failed, Text.Segmenter | MeasurementCache.MeasurementCache> =>
  evaluateInternal(profile, cases)

/**
 * Purely collapses an evaluation report into weighted per-case and total loss.
 *
 * @since 0.5.0
 * @category scoring
 */
export const score = (report: Report, objective: Objective = defaultObjective): Score => scoreReport(report, objective)

/**
 * Compiles profile dimensions into an Effect Search configuration space.
 * Invalid bounds or distribution metadata fail with `InvalidSearchSpace`.
 *
 * @since 0.5.0
 * @category optimization
 */
export const searchSpace = (search: Search = defaultSearch) =>
  SearchSpace.make({
    lineFitEpsilon: SearchSpace.float(
      search.lineFitEpsilon.low,
      search.lineFitEpsilon.high,
      Struct.pick(search.lineFitEpsilon, "step")
    ),
    tabWidth: SearchSpace.int(search.tabWidth.low, search.tabWidth.high, Struct.pick(search.tabWidth, "step")),
    defaultDirection: SearchSpace.categorical(search.defaultDirection.values),
    preferEarlySoftHyphenBreak: SearchSpace.categorical(search.preferEarlySoftHyphenBreak.values),
    preferPrefixWidthsForBreakableRuns: SearchSpace.categorical(
      search.preferPrefixWidthsForBreakableRuns.values
    )
  })

/**
 * Runs a fresh or resumed Effect Search optimization and selects the profile with the
 * lowest weighted calibration loss.
 *
 * @remarks
 * Candidate measurement failures become trial failures. The returned event log
 * covers this invocation while its snapshot contains cumulative resumable state.
 *
 * @since 0.5.0
 * @category optimization
 */
export const optimize = (options: OptimizeOptions) =>
  Effect.gen(function*() {
    const objective = Option.fromNullable(options.objective).pipe(
      Option.getOrElse(() => defaultObjective)
    )
    const search = Option.fromNullable(options.search).pipe(
      Option.getOrElse(() => defaultSearch)
    )
    const sampler = Option.fromNullable(options.sampler).pipe(
      Option.getOrElse(() => Sampler.tpe({ seed: 0 }))
    )
    const storage = Option.fromNullable(options.optimizationStorage)
    const space = yield* searchSpace(search)
    const optimization = yield* Option.fromNullable(options.snapshot).pipe(
      Option.match({
        onNone: () =>
          runFreshOptimization({
            cases: options.cases,
            objective,
            sampler,
            services: options.services,
            storage,
            space,
            trials: options.trials
          }),
        onSome: (snapshot) =>
          runResumedOptimization({
            cases: options.cases,
            objective,
            sampler,
            services: options.services,
            snapshot,
            storage,
            space,
            trials: options.trials
          })
      })
    )
    const bestProfile = Profile.make({ name: "best", profile: optimization.optimizationResult.bestTrial.config })
    const bestReport = yield* evaluate(bestProfile, options.cases).pipe(Effect.provide(options.services))
    const bestScore = score(bestReport, objective)

    return new OptimizationResult({
      bestProfile,
      bestReport,
      optimizationResult: optimization.optimizationResult,
      optimization: {
        objective,
        search,
        completionReason: optimization.optimizationResult.completionReason,
        bestScore: bestScore.total,
        bestLossSummary: bestScore.summary,
        artifacts: {
          snapshot: optimization.snapshot,
          eventLog: optimization.eventLog
        }
      }
    })
  })
