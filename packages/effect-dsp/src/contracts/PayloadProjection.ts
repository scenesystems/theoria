/**
 * Schema-based conversion into trace and optimizer payload records.
 *
 * @since 0.1.0
 */
import { Effect, Schema } from "effect"
import { FieldRecord, type FieldRecord as FieldRecordType } from "./FieldValue.js"

/**
 * Decodes an unknown value as a {@link FieldRecord} and maps parse failure.
 *
 * @remarks
 * Parse details are discarded before `onError` runs. If `onError` throws, the
 * exception becomes an Effect defect.
 *
 * @typeParam E - Caller-defined typed failure.
 * @param value - Untrusted value at a trace or event boundary.
 * @param onError - Lazy error constructor invoked after decoding fails.
 * @returns A newly decoded record, or the caller-defined failure.
 *
 * @since 0.1.0
 * @category combinators
 */
export const projectFieldRecord = <E>(
  value: unknown,
  onError: () => E
): Effect.Effect<FieldRecordType, E> =>
  Schema.decodeUnknown(FieldRecord)(value).pipe(
    Effect.mapError(() => onError())
  )

/**
 * Encodes a typed value and decodes the encoded representation as a field record.
 *
 * @remarks
 * Schema encoding and field-record decoding failures both map to the same lazy
 * error. Encoding retains the supplied schema's service requirements.
 *
 * @typeParam A - Decoded value accepted by the source schema.
 * @typeParam I - Encoded representation produced by the source schema.
 * @typeParam R - Services required while encoding.
 * @typeParam E - Caller-defined typed failure.
 * @param schema - Codec that defines the intermediate representation.
 * @param value - Decoded value to encode and project.
 * @param onError - Lazy error constructor used for either failed stage.
 * @returns A field record decoded from the schema's encoded value.
 *
 * @since 0.1.0
 * @category combinators
 */
export const encodeAndProjectFieldRecord = <A, I, R, E>(
  schema: Schema.Schema<A, I, R>,
  value: A,
  onError: () => E
): Effect.Effect<FieldRecordType, E, R> =>
  Schema.encodeUnknown(schema)(value).pipe(
    Effect.mapError(() => onError()),
    Effect.flatMap((encoded) => projectFieldRecord(encoded, onError))
  )
