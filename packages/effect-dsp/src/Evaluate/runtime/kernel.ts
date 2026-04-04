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
 * Configuration for an evaluation run: module, examples, metrics, and
 * optional concurrency.
 *
 * @since 0.1.0
 * @category models
 * @see {@link import("../../Module/model.js").Module}
 * @see {@link import("../../Example/index.js").Example}
 * @see {@link import("../../Metric/model.js").Metric}
 * @see {@link import("../report.js").Report}
 */
export type EvaluateOptions<
  I extends Schema.Struct.Fields = Schema.Struct.Fields,
  O extends Schema.Struct.Fields = Schema.Struct.Fields,
  ME = never,
  MR = never
> = Readonly<{
  readonly module: Module<I, O>
  readonly examples: ReadonlyArray<ExampleModel>
  readonly metrics: Readonly<Record<string, Metric<ME, MR>>>
  readonly concurrency?: number
}>

export {
  /**
   * Callback invoked with each evaluation lifecycle event for streaming
   * progress.
   *
   * @since 0.1.0
   * @category type-level
   */
  type EvaluationEventSink
} from "./example.js"

/**
 * Execute evaluation once and project progress through the provided event
 * sink. Shared by both `Evaluate.run` and `Evaluate.stream`.
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
 * No-op event sink that discards all events. Used by the batch {@link run}
 * projection.
 *
 * @since 0.1.0
 * @category constants
 */
export const noEvents: EvaluationEventSink = () => Effect.void
