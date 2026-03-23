/**
 * Scorer function contracts used by `Evaluate` and optimizer inner loops.
 *
 * @since 0.0.0
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
 * @since 0.0.0
 * @category schemas
 */
export const MetricPayload = FieldRecord

/**
 * Inferred decoded type of {@link MetricPayload}.
 *
 * @see {@link MetricPayload}
 * @since 0.0.0
 * @category type-level
 */
export type MetricPayload = typeof MetricPayload.Type

/**
 * Inferred encoded (wire-format) type of {@link MetricPayload}.
 *
 * @see {@link MetricPayload}
 * @since 0.0.0
 * @category type-level
 */
export type MetricPayloadEncoded = typeof MetricPayload.Encoded

/**
 * Effectful scorer that compares a prediction against an expected output
 * and produces a {@link MetricResult}. The Effect signature allows scorers
 * to call external services (e.g. an LM-as-judge) or access context.
 *
 * @see {@link PureMetricFn} — synchronous variant for simple scorers
 * @see {@link MetricResult} — the score + optional feedback returned
 *
 * @since 0.0.0
 * @category models
 */
export type MetricFn<E = never, R = never> = (
  prediction: MetricPayload,
  expected: MetricPayload
) => Effect.Effect<MetricResult, E, R>

/**
 * Synchronous scorer for metrics that need no effects — exact-match,
 * substring containment, numeric distance, etc. Automatically lifted
 * into {@link MetricFn} by the metric constructors.
 *
 * @see {@link MetricFn} — effectful variant for LM-as-judge scorers
 * @see {@link MetricResult} — the score + optional feedback returned
 *
 * @since 0.0.0
 * @category models
 */
export type PureMetricFn = (
  prediction: MetricPayload,
  expected: MetricPayload
) => MetricResult
