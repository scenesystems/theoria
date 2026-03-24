/**
 * Deterministic projection of `Evaluate.Report` results into the objective
 * values consumed by `effect-search` study APIs (single-scalar or
 * multi-objective vectors).
 *
 * @since 0.0.0
 */
import { Array as Arr, Effect, Option, Order, Record, Schema } from "effect"
import type { ObjectiveValue as EffectSearchObjectiveValue } from "effect-search/Contracts"
import { ExampleFailure, type Report } from "../Evaluate/report.js"

/**
 * Discriminant controlling whether the objective is projected as a single
 * scalar or a multi-objective vector.
 *
 * @see {@link projectObjective} — dispatches on this mode
 *
 * @since 0.0.0
 * @category schemas
 */
export const ObjectiveProjectionMode = Schema.Literal("single", "multi")

/**
 * One metric's name and its aggregated score, sorted deterministically by
 * name so objective vectors are stable across runs.
 *
 * @see {@link ObjectiveTelemetry} — carries an array of these
 *
 * @since 0.0.0
 * @category models
 */
export class ObjectiveMetricScore extends Schema.Class<ObjectiveMetricScore>("ObjectiveMetricScore")({
  name: Schema.String,
  score: Schema.Number
}) {}

/**
 * Summary statistics emitted alongside the objective value — metric
 * breakdowns, failure details, and timing. Enables optimizer UIs and
 * logging to display rich context without re-evaluating.
 *
 * @see {@link ObjectiveProjection} — bundles telemetry with the objective
 *
 * @since 0.0.0
 * @category models
 */
export class ObjectiveTelemetry extends Schema.Class<ObjectiveTelemetry>("ObjectiveTelemetry")({
  metricScores: Schema.Array(ObjectiveMetricScore),
  failures: Schema.Array(ExampleFailure),
  totalExamples: Schema.Number,
  successCount: Schema.Number,
  failureCount: Schema.Number,
  averageDurationMs: Schema.Number
}) {}

/**
 * Complete projection of an evaluation report into the shape consumed by
 * `effect-search` study APIs. `objective` is either a single scalar
 * (for single-metric optimization) or a numeric vector (for
 * multi-objective Pareto search).
 *
 * @see {@link projectSingleObjective} — single-scalar projection
 * @see {@link projectMultiObjective} — vector projection
 * @see {@link ObjectiveTelemetry} — evaluation context carried alongside
 *
 * @since 0.0.0
 * @category models
 */
export class ObjectiveProjection extends Schema.Class<ObjectiveProjection>("ObjectiveProjection")({
  objective: Schema.Union(Schema.Number, Schema.Array(Schema.Number)),
  telemetry: ObjectiveTelemetry
}) {}

/**
 * Re-export of the `effect-search` objective value type so downstream
 * consumers can reference it without importing `effect-search` directly.
 *
 * @since 0.0.0
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
 * Project a single scalar objective from an evaluation report. Selects
 * the named metric (or the first metric alphabetically if omitted) and
 * bundles it with {@link ObjectiveTelemetry}.
 *
 * @see {@link ObjectiveProjection} — the returned projection
 * @see {@link projectMultiObjective} — vector variant
 *
 * @since 0.0.0
 * @category constructors
 */
export const projectSingleObjective = (report: Report, metricName?: string) =>
  Effect.gen(function*() {
    const selectedMetricName = Option.getOrElse(
      Option.fromNullable(metricName),
      () => Option.getOrElse(Arr.head(stableMetricNames(report)), () => "score")
    )

    return yield* validateProjection({
      objective: metricScore(report, selectedMetricName),
      telemetry: objectiveTelemetry(report)
    })
  })

/**
 * Project a multi-objective vector from an evaluation report. Each named
 * metric becomes one element in the objective array, ordered by the
 * supplied names (or alphabetically if omitted).
 *
 * @see {@link ObjectiveProjection} — the returned projection
 * @see {@link projectSingleObjective} — scalar variant
 *
 * @since 0.0.0
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
 * Dispatch to {@link projectSingleObjective} or
 * {@link projectMultiObjective} based on the provided
 * {@link ObjectiveProjectionMode}.
 *
 * @see {@link ObjectiveProjectionMode} — the mode discriminant
 * @see {@link ObjectiveProjection} — the returned projection
 *
 * @since 0.0.0
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
      Option.match(Option.flatMap(Option.fromNullable(options.metricNames), Arr.head), {
        onNone: () => undefined,
        onSome: (metricName) => metricName
      })
    )
    : projectMultiObjective(options.report, options.metricNames)
