/**
 * Content hashing whose preimage is defined by a Schema encoder.
 *
 * @remarks
 * The caller's Schema encoder owns conversion from a decoded value to its wire
 * representation before RFC 8785 canonicalization. Use this boundary for values
 * such as `Date` or branded types whose runtime form is not their serialized form.
 * This package delegates to public Schema encoding APIs and does not interpret the
 * Schema AST.
 *
 * @see {@link digest}
 * @see {@link canonicalize}
 * @see {@link DigestAlgorithm}
 *
 * @since 0.1.0
 * @category digest
 * @module
 */

import { Boolean as B, Effect, Either, type ParseResult, Schema } from "effect"
import { digest } from "./digest.js"
import {
  finalizeIncrementalHasherTagged,
  finalizeIncrementalHasherTaggedSync,
  makeIncrementalHasher,
  makeIncrementalHasherSync,
  updateIncrementalHasher
} from "./internal/digest-bytes.js"
import { canonicalizeWithByteLimit, canonicalizeWithByteLimitEither } from "./internal/jcs.js"
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
 * `Schema.encode` defines and produces the preimage once per execution, with its
 * requirements retained in `R`. Encoding failures and canonicalization failures
 * stay distinct in the error channel. Native synchronous Schema transforms are
 * not bounded interruption points. Subsequent canonical traversal is stack-safe
 * and cooperative between batches, while record key enumeration and sorting and
 * final string and UTF-8 materialization remain synchronous. The default algorithm
 * is `"blake3-256"`.
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
  Effect.flatMap(
    Effect.suspend(() => Schema.encode(schema)(value)),
    (encoded) => digest(algorithm, encoded)
  )

/**
 * Hashes a Schema value only when its canonical UTF-8 preimage fits an inclusive byte limit.
 *
 * @remarks
 * Schema encoding and canonical traversal each occur once per execution. Encoding
 * retains the Schema's native service requirements, interruption, failure, and
 * defect semantics and delegates completely to `Schema.encode`; no package-owned
 * AST interpreter participates. Native synchronous transforms are not made
 * cooperative by this operation. The byte limit applies to the encoded canonical
 * preimage.
 *
 * Stack-safe canonical traversal yields between bounded batches, but `Record.keys`
 * and key sorting for an individual record remain synchronous. The serializer
 * measures emitted UTF-8 segments and rejects the first segment that would take
 * the total over `maximumBytes`; it does not deliberately observe exactly
 * `maximumBytes + 1` bytes and does not materialize or publish the complete
 * oversized preimage. On success, `canonicalByteLength` is the number of bytes
 * sent to the incremental hasher. The limit must be a non-negative safe integer.
 * The default algorithm is `"blake3-256"`.
 *
 * @typeParam A - Decoded value type accepted by the schema encoder.
 * @typeParam I - Encoded representation passed to canonicalization.
 * @typeParam R - Services required by schema encoding.
 * @param schema - Schema whose encoder defines the preimage.
 * @param value - Decoded value to encode and digest.
 * @param maximumBytes - Inclusive non-negative safe-integer limit.
 * @param algorithm - Hash algorithm; defaults to BLAKE3-256.
 * @returns The digest and exact admitted byte length, or an encoding, admission, or limit error.
 *
 * @since 0.3.3
 * @category digest
 */
export const digestSchemaValueWithByteLimit = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  value: A,
  maximumBytes: number,
  algorithm: DigestAlgorithm = "blake3-256"
): Effect.Effect<
  SchemaValueDigest,
  CanonicalByteLimitError | CanonicalizationError | ParseResult.ParseError,
  R
> =>
  B.match(isByteLimit(maximumBytes), {
    onTrue: () =>
      Effect.flatMap(
        Effect.suspend(() => Schema.encode(schema)(value)),
        (encoded) => digestEncodedBounded(encoded, maximumBytes, algorithm)
      ),
    onFalse: () => Effect.fail(new InvalidCanonicalByteLimit({}))
  })

/**
 * Hashes an owner-controlled Schema value without starting an Effect runtime.
 *
 * @remarks
 * The operation delegates encoding to `Schema.encodeEither` and blocks the current
 * JavaScript turn for Schema transforms, traversal, key enumeration and sorting,
 * segment hashing, and completion. It uses the same segment-counting byte-limit
 * contract as `digestSchemaValueWithByteLimit`. Choose an owner-controlled limit
 * appropriate for synchronous work. The default algorithm is `"blake3-256"`.
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
  B.match(isByteLimit(maximumBytes), {
    onTrue: () =>
      Either.flatMap(
        Schema.encodeEither(schema)(value),
        (encoded) => digestEncodedBoundedSync(encoded, maximumBytes, algorithm)
      ),
    onFalse: () => Either.left(new InvalidCanonicalByteLimit({}))
  })
