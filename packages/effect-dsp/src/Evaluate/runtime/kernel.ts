/**
 * Shared evaluation runtime kernel used by both `Evaluate.run` and `Evaluate.stream`.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Option, Schema } from "effect"
import type { Record } from "effect"
import { Example } from "../../Example/index.js"
import type { Metric } from "../../Metric/model.js"
import type { Module } from "../../Module/model.js"
import { EvaluationEvent } from "../events.js"
import { AggregateOptions, aggregateOutcomes } from "./aggregate.js"
import { EvaluateExampleOptions, evaluateOutcome, type EvaluationEventSink, sortedMetricEntries } from "./example.js"

const EvaluationExamples = Schema.Array(Example)
type EvaluationExamples = typeof EvaluationExamples.Type

/**
 * Configures module evaluation over a fixed set of examples and metrics.
 *
 * @remarks
 * Module, schema, and metric failures are captured in the resulting report. The
 * module's service requirements remain in the Effect returned by {@link run} and
 * the Stream returned by {@link stream}.
 *
 * @typeParam I - Input fields accepted by the module.
 * @typeParam O - Output fields returned by the module.
 * @typeParam ME - Expected failure from any configured metric.
 * @typeParam MR - Services required by the configured metrics.
 *
 * @since 0.1.0
 * @category models
 */
export class EvaluateOptions<
  I extends Schema.Struct.Fields = Schema.Struct.Fields,
  O extends Schema.Struct.Fields = Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
> extends Data.Class<{
  /** Module invoked once for each example. */
  readonly module: Module<I, O, E, R>
  /** Labeled examples. An example without an output is reported as a failure. */
  readonly examples: EvaluationExamples
  /** Named metrics applied to every successful prediction, in name-sorted order. */
  readonly metrics: Record.ReadonlyRecord<string, Metric<ME, MR>>
  /** Maximum concurrent example evaluations passed to Effect; omitted values use `1`. */
  readonly concurrency?: number
}> {}

export { type EvaluationEventSink } from "./example.js"

/**
 * Runs the evaluation kernel and sends lifecycle events to a sink.
 *
 * @since 0.1.0
 * @category combinators
 */
export const evaluateKernel = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never,
  E = never,
  R = never
>(
  options: EvaluateOptions<I, O, ME, MR, E, R>,
  emit: EvaluationEventSink
) =>
  Effect.gen(function*() {
    const total = Arr.length(options.examples)
    const metrics = sortedMetricEntries(options.metrics)
    const outcomes = yield* Effect.forEach(
      options.examples,
      (example, index) =>
        evaluateOutcome(
          new EvaluateExampleOptions({
            index,
            total,
            example,
            module: options.module,
            metrics,
            emit
          })
        ),
      {
        concurrency: Option.getOrElse(Option.fromNullable(options.concurrency), () => 1)
      }
    )
    const aggregate = aggregateOutcomes(
      new AggregateOptions({
        metricEntries: metrics,
        outcomes,
        total
      })
    )

    yield* emit(
      EvaluationEvent.EvaluationCompleted({
        overallScore: aggregate.averageScore,
        total
      })
    )

    return aggregate.report
  })

/**
 * Event sink that discards every event.
 *
 * @since 0.1.0
 * @category constants
 */
export const noEvents: EvaluationEventSink = () => Effect.void
