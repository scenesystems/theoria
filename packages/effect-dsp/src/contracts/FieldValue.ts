/**
 * Recursive JSON-like value type and record schema used as the universal
 * payload carrier across module I/O, trace entries, and optimizer events.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Recursive union of JSON-compatible primitives, arrays, and objects.
 * This is the runtime representation — see the companion `FieldValue`
 * schema for validation.
 *
 * @see {@link FieldRecord} — record-shaped carrier built from FieldValue
 *
 * @since 0.1.0
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
 * @since 0.1.0
 * @category schemas
 */
export const FieldValue = FieldValueSchema

/**
 * Schema for records whose values are JSON-compatible {@link FieldValue}
 * trees. Projection contracts use this narrower representation at
 * serialization boundaries; not every public module API uses it.
 *
 * @see {@link FieldValue} — the recursive value schema
 *
 * @since 0.1.0
 * @category schemas
 */
export const FieldRecord = Schema.Record({
  key: Schema.String,
  value: FieldValue
}).annotations({ identifier: "effect-dsp/FieldRecord" })

/**
 * Validated recursive payload consumed by metrics, traces, and optimizer
 * events. Decoding guarantees every nested value is JSON-compatible.
 *
 * @see {@link FieldRecord}
 * @since 0.1.0
 * @category type-level
 */
export type FieldRecord = typeof FieldRecord.Type

/**
 * Serialized counterpart of {@link FieldRecord} at persistence and event
 * boundaries. Because `FieldValue` applies no transformations, encoding a
 * decoded record preserves the same recursive JSON-compatible shape.
 *
 * @see {@link FieldRecord}
 * @since 0.1.0
 * @category type-level
 */
export type FieldRecordEncoded = typeof FieldRecord.Encoded
