/**
 * Content hashing whose preimage is defined by a Schema encoder.
 *
 * @remarks
 * Schema encoding converts a decoded value to its wire representation before
 * RFC 8785 canonicalization. Use this boundary for values such as `Date` or
 * branded types whose runtime form is not their serialized form.
 *
 * @see {@link digest}
 * @see {@link canonicalize}
 * @see {@link DigestAlgorithm}
 *
 * @since 0.1.0
 * @category digest
 * @module
 */

import { Effect, Either, type ParseResult, Schema } from "effect"
import { digest } from "./digest.js"
import {
  finalizeIncrementalHasherTagged,
  finalizeIncrementalHasherTaggedSync,
  makeIncrementalHasher,
  makeIncrementalHasherSync,
  updateIncrementalHasher
} from "./internal/digest-bytes.js"
import { canonicalizeWithByteLimit, canonicalizeWithByteLimitEither } from "./internal/jcs.js"
import { encodeSchemaCooperatively } from "./internal/schema-encode-machine.js"
import { encodeUtf8Unchecked } from "./internal/unicode.js"
import type { DigestAlgorithm } from "./schemas/DigestAlgorithm.js"
import {
  type CanonicalByteLimitError,
  type CanonicalByteLimitExceeded,
  type CanonicalizationError,
  InvalidCanonicalByteLimit
} from "./schemas/errors.js"

const isByteLimit = Schema.is(Schema.NonNegativeInt)

/**
 * A tagged digest paired with the exact byte length of its canonical preimage.
 *
 * @since 0.3.4
 * @category schemas
 */
export class SchemaValueDigest extends Schema.Class<SchemaValueDigest>("SchemaValueDigest")({
  /** Algorithm-tagged digest of the canonical encoded value. */
  digest: Schema.String,
  /** Exact UTF-8 byte count of the canonical preimage. */
  canonicalByteLength: Schema.NonNegativeInt
}) {}

const digestEncodedBounded = (
  encoded: unknown,
  maximumBytes: number,
  algorithm: DigestAlgorithm
): Effect.Effect<SchemaValueDigest, CanonicalByteLimitExceeded | CanonicalizationError> =>
  Effect.flatMap(
    makeIncrementalHasher(algorithm),
    (hasher) =>
      Effect.flatMap(
        canonicalizeWithByteLimit(
          encoded,
          maximumBytes,
          (segment) => updateIncrementalHasher(hasher, encodeUtf8Unchecked(segment))
        ),
        (canonicalByteLength) =>
          Effect.map(
            finalizeIncrementalHasherTagged(algorithm, hasher),
            (tagged) => new SchemaValueDigest({ digest: tagged, canonicalByteLength })
          )
      )
  )

const digestEncodedBoundedSync = (
  encoded: unknown,
  maximumBytes: number,
  algorithm: DigestAlgorithm
): Either.Either<SchemaValueDigest, CanonicalByteLimitExceeded | CanonicalizationError> => {
  const hasher = makeIncrementalHasherSync(algorithm)
  return Either.map(
    canonicalizeWithByteLimitEither(
      encoded,
      maximumBytes,
      (segment) => updateIncrementalHasher(hasher, encodeUtf8Unchecked(segment))
    ),
    (canonicalByteLength) =>
      new SchemaValueDigest({
        digest: finalizeIncrementalHasherTaggedSync(algorithm, hasher),
        canonicalByteLength
      })
  )
}

/**
 * Hashes the encoded form of a Schema value rather than its runtime representation.
 *
 * @remarks
 * Schema requirements remain in `R`. Encoding failures and canonicalization
 * failures stay distinct in the error channel. Canonical traversal is stack-safe
 * and yields between bounded batches. The default algorithm is `"blake3-256"`.
 *
 * @typeParam A - Decoded value type accepted by the schema encoder.
 * @typeParam I - Encoded representation passed to canonicalization.
 * @typeParam R - Services required by schema encoding.
 * @param schema - Schema whose encoder defines the hashed wire representation.
 * @param value - Decoded value to encode and digest.
 * @param algorithm - Hash algorithm; defaults to BLAKE3-256.
 * @returns A tagged digest while preserving encoding failures and requirements.
 *
 * @since 0.1.0
 * @category digest
 */
export const digestSchemaValue = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  value: A,
  algorithm: DigestAlgorithm = "blake3-256"
): Effect.Effect<string, CanonicalizationError | ParseResult.ParseError, R> =>
  Effect.flatMap(Schema.encode(schema)(value), (encoded) => digest(algorithm, encoded))

/**
 * Hashes a Schema value only when its canonical UTF-8 preimage fits an inclusive byte limit.
 *
 * @remarks
 * Structural encoding and canonical traversal each occur once and yield between
 * bounded batches. Native key enumeration and user-defined Schema transforms
 * remain synchronous. The byte limit does not bound input depth, property count,
 * or key-sorting work, so hostile input also needs structural limits.
 *
 * Traversal stops after observing byte `maximumBytes + 1`; it does not
 * materialize or publish the complete oversized preimage. On success,
 * `canonicalByteLength` is the number of bytes sent to the incremental hasher.
 * The limit must be a non-negative safe integer. The default algorithm is
 * `"blake3-256"`.
 *
 * @typeParam A - Decoded value type accepted by the schema encoder.
 * @typeParam I - Encoded representation passed to canonicalization.
 * @param schema - Context-free schema whose encoder defines the preimage.
 * @param value - Decoded value to encode and digest.
 * @param maximumBytes - Inclusive non-negative safe-integer limit.
 * @param algorithm - Hash algorithm; defaults to BLAKE3-256.
 * @returns The digest and exact admitted byte length, or an encoding, admission, or limit error.
 *
 * @since 0.3.3
 * @category digest
 */
export const digestSchemaValueWithByteLimit = <A, I>(
  schema: Schema.Schema<A, I, never>,
  value: A,
  maximumBytes: number,
  algorithm: DigestAlgorithm = "blake3-256"
): Effect.Effect<
  SchemaValueDigest,
  CanonicalByteLimitError | CanonicalizationError | ParseResult.ParseError,
  never
> =>
  isByteLimit(maximumBytes)
    ? Effect.flatMap(
      encodeSchemaCooperatively(schema, value),
      (encoded) => digestEncodedBounded(encoded, maximumBytes, algorithm)
    )
    : new InvalidCanonicalByteLimit({})

/**
 * Hashes an owner-controlled Schema value without starting an Effect runtime.
 *
 * @remarks
 * The operation uses `Schema.encodeEither` and blocks the current JavaScript
 * turn until completion. Choose an owner-controlled limit appropriate for
 * synchronous work. The default algorithm is `"blake3-256"`.
 *
 * @typeParam A - Decoded value type accepted by the schema encoder.
 * @typeParam I - Encoded representation passed to canonicalization.
 * @param schema - Context-free schema whose synchronous encoder defines the preimage.
 * @param value - Decoded value to encode and digest.
 * @param maximumBytes - Inclusive non-negative safe-integer limit.
 * @param algorithm - Hash algorithm; defaults to BLAKE3-256.
 * @returns `Right` with digest metadata or `Left` with an expected failure.
 *
 * @since 0.5.0
 * @category digest
 */
export const digestSchemaValueWithByteLimitSync = <A, I>(
  schema: Schema.Schema<A, I, never>,
  value: A,
  maximumBytes: number,
  algorithm: DigestAlgorithm = "blake3-256"
): Either.Either<
  SchemaValueDigest,
  CanonicalByteLimitError | CanonicalizationError | ParseResult.ParseError
> =>
  isByteLimit(maximumBytes)
    ? Either.flatMap(
      Schema.encodeEither(schema)(value),
      (encoded) => digestEncodedBoundedSync(encoded, maximumBytes, algorithm)
    )
    : Either.left(new InvalidCanonicalByteLimit({}))
