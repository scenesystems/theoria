/**
 * Shared evaluation runtime kernel used by both `Evaluate.run` and `Evaluate.stream`.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"
import type { Schema } from "effect"
import type { Example as ExampleModel } from "../../Example/index.js"
import type { Metric } from "../../Metric/model.js"
import type { Module } from "../../Module/model.js"
import { EvaluationEvent } from "../events.js"
import { aggregateOutcomes } from "./aggregate.js"
import { evaluateOutcome, type EvaluationEventSink, resolveConcurrency, sortedMetricEntries } from "./example.js"

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
export type EvaluateOptions<
  I extends Schema.Struct.Fields = Schema.Struct.Fields,
  O extends Schema.Struct.Fields = Schema.Struct.Fields,
  ME = never,
  MR = never
> = Readonly<{
  /** Module invoked once for each example. */
  readonly module: Module<I, O>
  /** Labeled examples. An example without an output is reported as a failure. */
  readonly examples: ReadonlyArray<ExampleModel>
  /** Named metrics applied to every successful prediction, in name-sorted order. */
  readonly metrics: Readonly<Record<string, Metric<ME, MR>>>
  /** Maximum concurrent example evaluations passed to Effect; omitted values use `1`. */
  readonly concurrency?: number
}>

export {
  /**
   * Receives each evaluation lifecycle event.
   *
   * @since 0.1.0
   * @category type-level
   */
  type EvaluationEventSink
} from "./example.js"

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
  MR = never
>(
  options: EvaluateOptions<I, O, ME, MR>,
  emit: EvaluationEventSink
) =>
  Effect.gen(function*() {
    const total = options.examples.length
    const metrics = sortedMetricEntries(options.metrics)
    const outcomes = yield* Effect.forEach(
      options.examples,
      (example, index) =>
        evaluateOutcome({
          index,
          total,
          example,
          module: options.module,
          metrics,
          emit
        }),
      {
        concurrency: resolveConcurrency(options)
      }
    )
    const aggregate = aggregateOutcomes({
      metricEntries: metrics,
      outcomes,
      total
    })

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
