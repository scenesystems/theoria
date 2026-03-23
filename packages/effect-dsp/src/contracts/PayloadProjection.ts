/**
 * Projection helpers that convert typed module payloads into the universal
 * {@link FieldRecord} shape consumed by traces, events, and optimizer state.
 *
 * @since 0.0.0
 */
import { Effect, Schema } from "effect"
import { FieldRecord, type FieldRecord as FieldRecordType } from "./FieldValue.js"

/**
 * Decode an unknown value into a validated {@link FieldRecord}. The caller
 * supplies `onError` to map parse failures into their domain error type.
 * Used by the forward runtime to normalize raw LM responses before they
 * enter the trace.
 *
 * @see {@link FieldRecord} — the target schema
 * @see {@link encodeAndProjectFieldRecord} — encode-then-project variant
 *
 * @since 0.0.0
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
 * Encode a typed value through its Schema, then project the encoded form
 * into a {@link FieldRecord}. Composes Schema encoding with payload
 * projection in one step — useful for converting strongly-typed module
 * outputs into the generic record shape before trace emission.
 *
 * @see {@link projectFieldRecord} — decode-only variant
 * @see {@link FieldRecord} — the target schema
 *
 * @since 0.0.0
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
