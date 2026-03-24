/**
 * Recursive JSON-like value type and record schema used as the universal
 * payload carrier across module I/O, trace entries, and optimizer events.
 *
 * @since 0.0.0
 */
import { Schema } from "effect"

/**
 * Recursive union of JSON-compatible primitives, arrays, and objects.
 * This is the runtime representation — see the companion `FieldValue`
 * schema for validation.
 *
 * @see {@link FieldRecord} — record-shaped carrier built from FieldValue
 *
 * @since 0.0.0
 * @category models
 */
export type FieldValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<FieldValue>
  | { readonly [key: string]: FieldValue }

const FieldValueSchema: Schema.Schema<FieldValue, FieldValue, never> = Schema.suspend(
  (): Schema.Schema<FieldValue, FieldValue, never> =>
    Schema.Union(
      Schema.String,
      Schema.Number,
      Schema.Boolean,
      Schema.Null,
      Schema.Array(FieldValueSchema),
      Schema.Record({ key: Schema.String, value: FieldValueSchema })
    )
)

/**
 * Recursive schema that validates arbitrary JSON-like values. Used
 * internally by {@link FieldRecord} and by trace/event serialization
 * to ensure payloads stay within the supported value space.
 *
 * @see {@link FieldRecord} — the record-level schema built on this
 *
 * @since 0.0.0
 * @category schemas
 */
export const FieldValue = FieldValueSchema

/**
 * Schema-validated `Record<string, FieldValue>` — the universal payload
 * shape for module inputs, outputs, demonstrations, and optimizer event
 * data. Every public module API accepts and returns this shape.
 *
 * @see {@link FieldValue} — the recursive value schema
 * @see {@link MetricPayload} — domain alias used by metric scorers
 *
 * @since 0.0.0
 * @category schemas
 */
export const FieldRecord = Schema.Record({
  key: Schema.String,
  value: FieldValue
}).annotations({ identifier: "effect-dsp/FieldRecord" })

/**
 * Inferred decoded type of {@link FieldRecord}.
 *
 * @see {@link FieldRecord}
 * @since 0.0.0
 * @category type-level
 */
export type FieldRecord = typeof FieldRecord.Type

/**
 * Inferred encoded (wire-format) type of {@link FieldRecord}.
 *
 * @see {@link FieldRecord}
 * @since 0.0.0
 * @category type-level
 */
export type FieldRecordEncoded = typeof FieldRecord.Encoded
