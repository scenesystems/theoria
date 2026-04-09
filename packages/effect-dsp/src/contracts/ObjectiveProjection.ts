/**
 * Deterministic projection of `Evaluate.Report` results into the objective
 * values consumed by `effect-search` study APIs (single-scalar or
 * multi-objective vectors).
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Option, Order, Record, Schema } from "effect"
import type { ObjectiveValue as EffectSearchObjectiveValue } from "effect-search/Contracts"
import { ExampleFailure, type Report } from "../Evaluate/report.js"

/**
 * Discriminant controlling whether the objective is projected as a single
 * scalar or a multi-objective vector.
 *
 * @see {@link ObjectiveProjection.fromReport} — dispatches on this mode
 *
 * @since 0.1.0
 * @category schemas
 */
export const ObjectiveProjectionMode = Schema.Literal("single", "multi")

/**
 * One metric's name and its aggregated score, sorted deterministically by
 * name so objective vectors are stable across runs.
 *
 * @see {@link ObjectiveTelemetry} — carries an array of these
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveMetricScore extends Schema.Class<ObjectiveMetricScore>("ObjectiveMetricScore")({
  name: Schema.String,
  score: Schema.Number
}) {
  /**
   * Construct one deterministic metric score from a stable report entry.
   *
   * @since 0.2.0
   * @category constructors
   */
  static fromMetricEntry(entry: readonly [string, number]): ObjectiveMetricScore {
    return ObjectiveMetricScore.make({
      name: entry[0],
      score: entry[1]
    })
  }
}

/**
 * Summary statistics emitted alongside the objective value — metric
 * breakdowns, failure details, and timing. Enables optimizer UIs and
 * logging to display rich context without re-evaluating.
 *
 * @see {@link ObjectiveProjection} — bundles telemetry with the objective
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveTelemetry extends Schema.Class<ObjectiveTelemetry>("ObjectiveTelemetry")({
  metricScores: Schema.Array(ObjectiveMetricScore),
  failures: Schema.Array(ExampleFailure),
  totalExamples: Schema.Number,
  successCount: Schema.Number,
  failureCount: Schema.Number,
  averageDurationMs: Schema.Number
}) {
  /**
   * Project report-level evaluation context into deterministic telemetry.
   *
   * @since 0.2.0
   * @category constructors
   */
  static fromReport(report: Report): ObjectiveTelemetry {
    return ObjectiveTelemetry.make({
      metricScores: Arr.map(stableMetricEntries(report), ObjectiveMetricScore.fromMetricEntry),
      failures: report.failures,
      totalExamples: report.totalExamples,
      successCount: report.successCount,
      failureCount: report.failureCount,
      averageDurationMs: averageDuration(report)
    })
  }
}

/**
 * Complete projection of an evaluation report into the shape consumed by
 * `effect-search` study APIs. `objective` is either a single scalar
 * (for single-metric optimization) or a numeric vector (for
 * multi-objective Pareto search).
 *
 * @see {@link ObjectiveProjection.fromReport} — canonical projection constructor
 * @see {@link ObjectiveTelemetry} — evaluation context carried alongside
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveProjection extends Schema.Class<ObjectiveProjection>("ObjectiveProjection")({
  objective: Schema.Union(Schema.Number, Schema.Array(Schema.Number)),
  telemetry: ObjectiveTelemetry
}) {
  /**
   * Project an evaluation report into the scalar or vector objective form
   * consumed by `effect-search` study APIs.
   *
   * @since 0.1.0
   * @category constructors
   */
  static fromReport(options: {
    readonly report: Report
    readonly mode: Schema.Schema.Type<typeof ObjectiveProjectionMode>
    readonly metricName?: string
    readonly metricNames?: ReadonlyArray<string>
  }): Effect.Effect<ObjectiveProjection> {
    const telemetry = ObjectiveTelemetry.fromReport(options.report)

    return Effect.succeed(
      options.mode === "single"
        ? ObjectiveProjection.make({
          objective: metricScore(options.report, resolveSingleMetricName(options)),
          telemetry
        })
        : ObjectiveProjection.make({
          objective: Arr.map(resolveMetricNames(options), (name) => metricScore(options.report, name)),
          telemetry
        })
    )
  }
}

/**
 * Re-export of the `effect-search` objective value type so downstream
 * consumers can reference it without importing `effect-search` directly.
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

const resolveMetricNames = (options: {
  readonly report: Report
  readonly metricNames?: ReadonlyArray<string>
}): ReadonlyArray<string> =>
  Option.getOrElse(
    Option.fromNullable(options.metricNames),
    () => stableMetricNames(options.report)
  )

const resolveSingleMetricName = (options: {
  readonly report: Report
  readonly metricName?: string
  readonly metricNames?: ReadonlyArray<string>
}): string =>
  Option.getOrElse(
    Option.fromNullable(options.metricName),
    () =>
      Option.getOrElse(
        Option.flatMap(Option.fromNullable(options.metricNames), Arr.head),
        () => Option.getOrElse(Arr.head(stableMetricNames(options.report)), () => "score")
      )
  )

const metricScore = (report: Report, metricName: string): number =>
  Option.getOrElse(Record.get(report.overallScores, metricName), () => 0)

const averageDuration = (report: Report): number =>
  report.results.length <= 0
    ? 0
    : Arr.reduce(report.results, 0, (sum, result) => sum + result.durationMs) / report.results.length
