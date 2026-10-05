/**
 * Projects evaluation reports into search objectives with retained telemetry.
 *
 * @since 0.4.0
 * @module
 */
import { Value as SearchObjectiveValue } from "@scenesystems/effect-search/Objective"
import { Array as Arr, Match, Number, Option, Order, Record, Schema } from "effect"
import { Failure, Report } from "./Evaluate.js"
import { Score } from "./Metric.js"

/** Scalar or vector projection mode.
 * @since 0.4.0
 * @category schemas
 */
export const Mode = Schema.Literals(["single", "multi"])

/** One named aggregate metric.
 * @since 0.4.0
 * @category models
 */
export class MetricScore extends Schema.Class<MetricScore>("@scenesystems/effect-dsp/EvaluationObjective/MetricScore")({
  name: Schema.String,
  score: Score.fields.value
}) {}

/** Evaluation context retained beside a projected objective.
 * @since 0.4.0
 * @category models
 */
export class Telemetry extends Schema.Class<Telemetry>("@scenesystems/effect-dsp/EvaluationObjective/Telemetry")({
  metricScores: Schema.Array(MetricScore),
  failures: Schema.Array(Failure),
  totalExamples: Schema.Finite,
  successCount: Schema.Finite,
  failureCount: Schema.Finite,
  averageDurationMs: Schema.Finite
}) {}

/** Search objective and the evaluation telemetry that produced it.
 * @since 0.4.0
 * @category models
 */
export class Projection extends Schema.Class<Projection>("@scenesystems/effect-dsp/EvaluationObjective/Projection")({
  objective: SearchObjectiveValue,
  telemetry: Telemetry
}) {}

/** Objective value accepted by effect-search.
 * @since 0.4.0
 * @category type-level
 */
export type ObjectiveValue = SearchObjectiveValue

const Entry = Schema.Tuple([Schema.String, Score.fields.value])
const Names = Schema.Array(Schema.String)
const entryOrder: Order.Order<typeof Entry.Type> = Order.mapInput(Order.String, ([name]) => name)
const entries = (report: Report) => Arr.sort(Record.toEntries(report.overallScores), entryOrder)
const names = (report: Report) => Arr.map(entries(report), ([name]) => name)
const score = (report: Report, name: string): number =>
  Option.getOrElse(Record.get(report.overallScores, name), () => 0)
const averageDuration = (report: Report): number =>
  Arr.match(report.outcomes, {
    onEmpty: () => 0,
    onNonEmpty: (results) =>
      Number.divideUnsafe(
        Arr.reduce(results, 0, (sum, result) => Number.sum(sum, result.durationMs)),
        Arr.length(results)
      )
  })
const telemetry = (report: Report): Telemetry =>
  new Telemetry({
    metricScores: Arr.map(entries(report), ([name, value]) => new MetricScore({ name, score: value })),
    failures: report.failures,
    totalExamples: report.totalExamples,
    successCount: report.successCount,
    failureCount: report.failureCount,
    averageDurationMs: averageDuration(report)
  })
const decodeProjection = Schema.decodeEffect(Projection)

/** Projects one named aggregate metric, or the report's failure-inclusive average.
 * @since 0.4.0
 * @category constructors
 */
export const projectSingleObjective = (report: Report, metricName: Option.Option<string>) =>
  decodeProjection({
    objective: Option.match(metricName, { onNone: () => report.average, onSome: (name) => score(report, name) }),
    telemetry: telemetry(report)
  })

/** Projects named aggregate metrics in caller order.
 * @since 0.4.0
 * @category constructors
 */
export const projectMultiObjective = (report: Report, metricNames?: typeof Names.Type) =>
  decodeProjection({
    objective: Arr.map(
      Option.getOrElse(Option.fromUndefinedOr(metricNames), () => names(report)),
      (name) => score(report, name)
    ),
    telemetry: telemetry(report)
  })

const ProjectOptions = Schema.Struct({ report: Report, mode: Mode, metricNames: Schema.optional(Names) })

/** Projects a report according to a scalar or vector mode.
 * @since 0.4.0
 * @category constructors
 */
export const project = (options: typeof ProjectOptions.Type) =>
  Match.value(options.mode).pipe(
    Match.when((mode) => mode === "single", () =>
      projectSingleObjective(
        options.report,
        Option.flatMap(Option.fromUndefinedOr(options.metricNames), Arr.head)
      )),
    Match.orElse(() => projectMultiObjective(options.report, options.metricNames))
  )
