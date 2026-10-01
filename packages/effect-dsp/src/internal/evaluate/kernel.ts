/**
 * Shared evaluation runtime kernel used by both `Evaluate.run` and `Evaluate.stream`.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Option } from "effect"
import type { Schema } from "effect"
import { events, type Options } from "../../Evaluate.js"
import { AggregateOptions, aggregateOutcomes } from "./aggregate.js"
import { EvaluateExampleOptions, evaluateOutcome, type EvaluationEventSink, sortedMetricEntries } from "./example.js"

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
  options: Options<I, O, ME, MR, E, R>,
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
      events.EvaluationCompleted({
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
