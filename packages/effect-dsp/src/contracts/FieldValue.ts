/**
 * Recursive scalar, array, and record values used at serialized DSP boundaries.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Restricts serialized DSP fields to recursive scalar, array, and record values.
 *
 * @remarks
 * Numbers include every JavaScript number accepted by `Schema.Number`, including
 * non-finite values. Consumers that require strict JSON must reject or normalize
 * those values before serialization.
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
 * Decodes recursively nested strings, numbers, booleans, nulls, arrays, and records.
 *
 * @remarks
 * Primitive and array values are preserved. Record-like objects are rebuilt from
 * their enumerable string keys, so prototypes are not retained and a `Date`
 * decodes as an empty record. `undefined`, `bigint`, functions, and symbols fail.
 *
 * @since 0.1.0
 * @category schemas
 */
export const FieldValue = FieldValueSchema

/**
 * Decodes string-keyed records whose values satisfy {@link FieldValue}.
 *
 * @remarks
 * Projection contracts use this shape for trace and optimizer event payloads.
 * Encoding preserves the same recursive representation.
 *
 * @since 0.1.0
 * @category schemas
 */
export const FieldRecord = Schema.Record({
  key: Schema.String,
  value: FieldValue
}).annotations({ identifier: "effect-dsp/FieldRecord" })

/**
 * Selects the decoded record produced by the {@link FieldRecord} schema.
 * @since 0.1.0
 * @category type-level
 */
export type FieldRecord = typeof FieldRecord.Type

/**
 * Selects the encoded record accepted by {@link FieldRecord}.
 *
 * @remarks
 * The field schemas apply no transformations, so decoded and encoded records
 * have the same recursive shape.
 * @since 0.1.0
 * @category type-level
 */
export type FieldRecordEncoded = typeof FieldRecord.Encoded
