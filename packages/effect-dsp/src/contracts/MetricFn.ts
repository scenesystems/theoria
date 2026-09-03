/**
 * Scorer function contracts used by `Evaluate` and optimizer inner loops.
 *
 * @since 0.1.0
 */
import type { Effect } from "effect"
import { FieldRecord } from "./FieldValue.js"
import type { MetricResult } from "./MetricResult.js"

/**
 * Payload schema for metric scoring — a recursive {@link FieldRecord} carrying
 * the prediction or expected output fields. Aliased here so metric functions
 * reference a domain-specific name rather than the generic `FieldRecord`.
 *
 * @see {@link FieldRecord} — the underlying recursive record schema
 *
 * @since 0.1.0
 * @category schemas
 */
export const MetricPayload = FieldRecord

/**
 * Validated prediction or expected-output payload passed to a metric. All
 * nested values have already been restricted to the JSON-compatible field
 * value space.
 *
 * @see {@link MetricPayload}
 * @since 0.1.0
 * @category type-level
 */
export type MetricPayload = typeof MetricPayload.Type

/**
 * Metric payload representation used at serialization boundaries. It has the
 * same recursive shape as the decoded payload because the underlying field
 * schema performs validation without transforming values.
 *
 * @see {@link MetricPayload}
 * @since 0.1.0
 * @category type-level
 */
export type MetricPayloadEncoded = typeof MetricPayload.Encoded

/**
 * Effectful scorer that compares a prediction with an expected output.
 * `E` is the scorer's typed failure and `R` is its required Effect context.
 *
 * @see {@link PureMetricFn} — synchronous variant for simple scorers
 * @see {@link MetricResult} — the score + optional feedback returned
 *
 * @since 0.1.0
 * @category models
 */
export type MetricFn<E = never, R = never> = (
  prediction: MetricPayload,
  expected: MetricPayload
) => Effect.Effect<MetricResult, E, R>

/**
 * Synchronous scorer with no typed failure or Effect context.
 *
 * @see {@link MetricFn} — effectful variant for LM-as-judge scorers
 * @see {@link MetricResult} — the score + optional feedback returned
 *
 * @since 0.1.0
 * @category models
 */
export type PureMetricFn = (
  prediction: MetricPayload,
  expected: MetricPayload
) => MetricResult
