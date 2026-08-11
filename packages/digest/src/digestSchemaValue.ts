/**
 * Schema-aware digest pipeline.
 *
 * Composes `Schema.encode` → JCS canonicalization → hash → base64url
 * → algorithm-tagged string in a single call. This is the canonical
 * way to produce durable content digests of typed values.
 *
 * The Schema encoding step converts rich runtime types (Date, branded
 * types, etc.) into their portable JSON wire form before hashing,
 * ensuring cross-language determinism.
 *
 * ```
 * Typed Value (A)
 *   → Schema.encode(schema)(value)     // A → I (wire form)
 *   → canonicalize(wireValue)          // RFC 8785 JCS
 *   → UTF-8 encode
 *   → hash (BLAKE3-256 or SHA-256)
 *   → base64url encode
 *   → algorithm-tagged string
 * ```
 *
 * @see {@link digest} — pipeline without Schema encoding
 * @see {@link canonicalize} — JCS canonicalization stage
 * @see {@link DigestAlgorithm} — supported algorithm literals
 *
 * @since 0.1.0
 * @category digest
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
 * A tagged Schema-value digest together with its exact canonical UTF-8 length.
 *
 * @since 0.3.4
 * @category schemas
 */
export class SchemaValueDigest extends Schema.Class<SchemaValueDigest>("SchemaValueDigest")({
  digest: Schema.String,
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
 * Digest a Schema-typed value through the full pipeline.
 *
 * First encodes the value via `Schema.encode` to produce the
 * portable wire form, then runs the standard
 * canonicalize → hash → base64url pipeline.
 *
 * Schema requirements are preserved in `R`, and encoding failures remain
 * distinguishable from the closed canonicalization failures. Canonical traversal
 * is deterministic, stack-safe, and cooperative in fixed-size Effect batches.
 *
 * Default algorithm is `"blake3-256"`.
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
 * Digest a Schema value only when its exact canonical UTF-8 preimage is within
 * an inclusive byte limit.
 *
 * Schema encoding and canonical traversal each occur once. Traversal stops at
 * the first canonical fragment containing byte `maximumBytes + 1`, before the
 * complete oversized preimage is materialized and before digest finalization
 * or publication. On success, `canonicalByteLength` is the exact byte count
 * emitted to the private incremental digest sink.
 *
 * `maximumBytes` is inclusive and must be a non-negative safe integer.
 *
 * Default algorithm is `"blake3-256"`.
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
    ? Effect.flatMap(Schema.encode(schema)(value), (encoded) => digestEncodedBounded(encoded, maximumBytes, algorithm))
    : new InvalidCanonicalByteLimit({})

/**
 * Synchronously digest a Schema value only when its exact canonical UTF-8
 * preimage is within an inclusive byte limit.
 *
 * This is the bounded, non-cooperative counterpart to
 * `digestSchemaValueWithByteLimit`. It uses `Schema.encodeEither` and the same
 * strict JCS state machine, UTF-8 law, and incremental digest kernels without
 * executing an Effect runtime. Expected failures are returned as `Either.Left`.
 * Callers must choose a small owner-controlled limit because admitted work
 * blocks the current JavaScript turn until completion.
 *
 * Default algorithm is `"blake3-256"`.
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
