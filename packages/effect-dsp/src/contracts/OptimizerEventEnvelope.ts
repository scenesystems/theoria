/**
 * Transport envelope for optimizer-specific progress events.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"
import { OptimizerKind } from "./OptimizerKind.js"

/**
 * Associates an optimizer and event tag with an encoded event payload.
 *
 * @remarks
 * The envelope validates payload values only as a string-keyed record of
 * `unknown`; consumers must decode the payload with the event schema selected by
 * `optimizer` and `eventTag`.
 *
 * @since 0.1.0
 * @category models
 */
export class OptimizerEventEnvelope extends Schema.Class<OptimizerEventEnvelope>("OptimizerEventEnvelope")({
  /** Optimizer lifecycle that emitted the event. */
  optimizer: OptimizerKind,
  /** Optimizer-specific event discriminant. */
  eventTag: Schema.String,
  /** Encoded event fields requiring event-specific decoding by the consumer. */
  payload: Schema.Record({ key: Schema.String, value: Schema.Unknown })
}) {}
