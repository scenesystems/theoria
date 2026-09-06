/**
 * Conversion of evaluation reports into effect-search objective values and telemetry.
 *
 * @since 0.1.0
 */
import type { ObjectiveValue as EffectSearchObjectiveValue } from "@scenesystems/effect-search/Contracts"
import { Array as Arr, Effect, Option, Order, Record, Schema } from "effect"
import { ExampleFailure, type Report } from "../Evaluate/report.js"

/**
 * Decodes scalar (`"single"`) and vector (`"multi"`) projection modes.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ObjectiveProjectionMode = Schema.Literal("single", "multi")

/**
 * Associates an evaluation metric name with its aggregate score.
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveMetricScore extends Schema.Class<ObjectiveMetricScore>("ObjectiveMetricScore")({
  /** Key from `Report.overallScores`. */
  name: Schema.String,
  /** Aggregate score copied without range or finiteness normalization. */
  score: Schema.Number
}) {}

/**
 * Retains evaluation counts, failures, metric scores, and mean example duration.
 *
 * @remarks
 * Metric scores are sorted by name. Duration averages every result, including
 * failed examples, and is `0` when the report has no results.
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveTelemetry extends Schema.Class<ObjectiveTelemetry>("ObjectiveTelemetry")({
  /** Aggregate report scores in ascending metric-name order. */
  metricScores: Schema.Array(ObjectiveMetricScore),
  /** Captured example failures copied from the report. */
  failures: Schema.Array(ExampleFailure),
  /** Number of examples supplied to evaluation. */
  totalExamples: Schema.Number,
  /** Number of examples scored by every metric. */
  successCount: Schema.Number,
  /** Number of examples with a captured failure. */
  failureCount: Schema.Number,
  /** Arithmetic mean of all per-example durations in milliseconds. */
  averageDurationMs: Schema.Number
}) {}

/**
 * Couples a scalar or vector objective with the report telemetry used to derive it.
 *
 * @remarks
 * The schema accepts either objective shape independently of a projection mode;
 * callers choose the shape through a projection function.
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveProjection extends Schema.Class<ObjectiveProjection>("ObjectiveProjection")({
  /** Scalar metric score or ordered multi-metric vector. */
  objective: Schema.Union(Schema.Number, Schema.Array(Schema.Number)),
  /** Evaluation context retained alongside the search objective. */
  telemetry: ObjectiveTelemetry
}) {}

/**
 * Uses the effect-search scalar-or-vector objective type at the DSP interop boundary.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ObjectiveValue = EffectSearchObjectiveValue

const metricEntryOrder: Order.Order<readonly [string, number]> = Order.mapInput(Order.string, ([name]) => name)

const stableMetricEntries = (report: Report): ReadonlyArray<readonly [string, number]> =>
  Arr.sort(Record.toEntries(report.overallScores), metricEntryOrder)

const stableMetricNames = (report: Report): ReadonlyArray<string> =>
  Arr.map(stableMetricEntries(report), ([name]) => name)

const metricScore = (report: Report, metricName: string): number =>
  Option.getOrElse(Record.get(report.overallScores, metricName), () => 0)

const averageDuration = (report: Report): number =>
  report.results.length <= 0
    ? 0
    : Arr.reduce(report.results, 0, (sum, result) => sum + result.durationMs) / report.results.length

const objectiveTelemetry = (report: Report): ObjectiveTelemetry =>
  new ObjectiveTelemetry({
    metricScores: Arr.map(stableMetricEntries(report), ([name, score]) => new ObjectiveMetricScore({ name, score })),
    failures: report.failures,
    totalExamples: report.totalExamples,
    successCount: report.successCount,
    failureCount: report.failureCount,
    averageDurationMs: averageDuration(report)
  })

const validateProjection = (payload: unknown) => Schema.decodeUnknown(ObjectiveProjection)(payload)

/**
 * Selects one aggregate metric as a scalar search objective.
 *
 * @remarks
 * Omission selects the first metric name alphabetically. A missing selected
 * metric and an empty score record both produce `0`. Projection validation can
 * fail with `ParseResult.ParseError` when report values violate the output schema.
 *
 * @param report - Evaluation report supplying scores and telemetry.
 * @param metricName - Aggregate score key; omission uses alphabetical order.
 * @returns A validated scalar projection with telemetry for the whole report.
 *
 * @since 0.1.0
 * @category constructors
 */
export const projectSingleObjective = (report: Report, metricName: Option.Option<string>) =>
  Effect.gen(function*() {
    const selectedMetricName = Option.getOrElse(
      metricName,
      () => Option.getOrElse(Arr.head(stableMetricNames(report)), () => "score")
    )

    return yield* validateProjection({
      objective: metricScore(report, selectedMetricName),
      telemetry: objectiveTelemetry(report)
    })
  })

/**
 * Selects aggregate metrics as an ordered search objective vector.
 *
 * @remarks
 * Values follow caller order, including duplicate names. Omission uses all
 * report keys alphabetically. Missing names produce `0`, and an explicit empty
 * array produces an empty vector. Projection validation can fail with
 * `ParseResult.ParseError`.
 *
 * @param report - Evaluation report supplying scores and telemetry.
 * @param metricNames - Ordered aggregate score keys; omission selects every key.
 * @returns A validated vector projection with telemetry for the whole report.
 *
 * @since 0.1.0
 * @category constructors
 */
export const projectMultiObjective = (report: Report, metricNames?: ReadonlyArray<string>) =>
  Effect.gen(function*() {
    const selectedMetricNames = Option.getOrElse(Option.fromNullable(metricNames), () => stableMetricNames(report))

    return yield* validateProjection({
      objective: Arr.map(selectedMetricNames, (name) => metricScore(report, name)),
      telemetry: objectiveTelemetry(report)
    })
  })

/**
 * Projects an evaluation report according to a scalar or vector mode.
 *
 * @remarks
 * Single mode reads only the first supplied metric name and applies the scalar
 * fallback when no name is present. Multi mode preserves the complete name list.
 *
 * @param options - Report, projection mode, and optional metric selection.
 * @returns The selected validated objective projection.
 *
 * @since 0.1.0
 * @category constructors
 */
export const projectObjective = (options: {
  readonly report: Report
  readonly mode: Schema.Schema.Type<typeof ObjectiveProjectionMode>
  readonly metricNames?: ReadonlyArray<string>
}) =>
  options.mode === "single"
    ? projectSingleObjective(
      options.report,
      Option.flatMap(Option.fromNullable(options.metricNames), Arr.head)
    )
    : projectMultiObjective(options.report, options.metricNames)
