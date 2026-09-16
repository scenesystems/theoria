/**
 * Algorithm-tagged content identities. Schema encoding defines a value's wire
 * representation; CanonicalJson defines its deterministic byte preimage; Digest
 * owns cryptographic hashing. This module owns the resulting identity model.
 *
 * @since 0.7.0
 * @module
 */

import { Effect, Either, Encoding, type ParseResult, Schema } from "effect"
import * as CanonicalJson from "./CanonicalJson.js"
import * as Digest from "./Digest.js"
import { canonicalizeWithByteLimit, canonicalizeWithByteLimitEither } from "./internal/canonicalJson/traversal.js"
import { makeHasher } from "./internal/digest.js"
import { encodeUtf8Unchecked } from "./internal/unicode.js"

/**
 * Canonical unpadded base64url encoding of 32 digest bytes. Decoding validates
 * representation, not whether the digest actually matches any content.
 *
 * @since 0.7.0
 * @category models
 */
export const Value = Schema.String.pipe(
  // The final base64 sextet contains four data bits and two zero pad bits.
  Schema.pattern(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/),
  Schema.brand("@scenesystems/digest/ContentDigest/Value")
).annotations({ identifier: "@scenesystems/digest/ContentDigest/Value" })

/**
 * A validated canonical 256-bit digest encoding.
 * @since 0.7.0
 * @category models
 */
export type Value = typeof Value.Type

/**
 * A digest and the algorithm needed to verify it. The encoded form is an object
 * with `algorithm` and `digest` fields; the runtime class supports structural
 * equality and hashing. Construction validates typed input; use Schema decoding
 * to admit external data. Neither construction nor decoding verifies content.
 *
 * @since 0.7.0
 * @category models
 */
export class ContentDigest extends Schema.Class<ContentDigest>("@scenesystems/digest/ContentDigest")({
  algorithm: Digest.Algorithm,
  digest: Value
}) {}

/**
 * A content identity paired with its exact canonical UTF-8 preimage byte count.
 * The encoded form nests the `ContentDigest` object, not its tagged string.
 *
 * @since 0.7.0
 * @category models
 */
export class Result extends Schema.Class<Result>("@scenesystems/digest/ContentDigest/Result")({
  digest: ContentDigest,
  canonicalByteLength: Schema.NonNegativeInt
}) {}

/**
 * Converts an identity to the stable `<algorithm>:<base64url>` string used by
 * cache and protocol boundaries. This does not hash or serialize the preimage.
 *
 * @since 0.7.0
 * @category conversions
 */
export const toString = (self: ContentDigest): string => `${self.algorithm}:${self.digest}`

const fromHash = (algorithm: Digest.Algorithm, bytes: Uint8Array): ContentDigest =>
  new ContentDigest({ algorithm, digest: Value.make(Encoding.encodeBase64Url(bytes)) })

/**
 * Hashes an exact byte preimage into an algorithm-tagged identity. Synchronous
 * and pure; no canonicalization or text encoding is performed.
 *
 * @since 0.7.0
 * @category constructors
 */
export const fromBytes = (algorithm: Digest.Algorithm, bytes: Uint8Array): ContentDigest =>
  fromHash(algorithm, Digest.hash(algorithm, bytes))

/**
 * Admits JSON-visible data and hashes its RFC 8785 UTF-8 encoding. Inherits
 * CanonicalJson's cooperative traversal, stable-input requirement, and failures.
 *
 * @since 0.7.0
 * @category constructors
 */
export const fromUnknown = (
  algorithm: Digest.Algorithm,
  value: unknown
): Effect.Effect<ContentDigest, CanonicalJson.Error> =>
  Effect.map(CanonicalJson.encodeBytes(value), (bytes) => fromBytes(algorithm, bytes))

/**
 * Hashes the Schema-encoded representation, not the runtime value. Delegates
 * encoding exactly once per execution to `Schema.encode`, preserving `R`,
 * ParseError, defects, and interruption. Synchronous Schema transforms are not
 * made cooperative. Defaults to BLAKE3-256.
 *
 * @since 0.7.0
 * @category constructors
 */
export const fromSchema = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  value: A,
  algorithm: Digest.Algorithm = "blake3-256"
): Effect.Effect<ContentDigest, CanonicalJson.Error | ParseResult.ParseError, R> =>
  Effect.flatMap(Effect.suspend(() => Schema.encode(schema)(value)), (encoded) => fromUnknown(algorithm, encoded))

const isByteLimit = Schema.is(Schema.NonNegativeInt)

/**
 * Encodes once and incrementally hashes canonical segments under an inclusive
 * non-negative safe-integer byte limit. Returns the identity and exact admitted
 * byte count. Rejects the first segment that would cross the limit without
 * materializing the full oversized preimage; it does not inspect exactly
 * `maximumBytes + 1` bytes. The limit does not bound Schema work, input traversal,
 * record key collection/sorting, or work inside an emitted segment.
 *
 * Preserves Schema requirements and failures. Traversal yields between bounded
 * batches; synchronous Schema transforms and record sorting remain synchronous.
 * Each execution owns and releases its incremental hasher, including on failure
 * and interruption. Invalid limits fail before Schema encoding starts.
 *
 * @since 0.7.0
 * @category constructors
 */
export const fromSchemaWithByteLimit = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  value: A,
  maximumBytes: number,
  algorithm: Digest.Algorithm = "blake3-256"
): Effect.Effect<Result, CanonicalJson.ByteLimitError | CanonicalJson.Error | ParseResult.ParseError, R> =>
  isByteLimit(maximumBytes)
    ? Effect.flatMap(
      Effect.suspend(() => Schema.encode(schema)(value)),
      (encoded) =>
        Effect.acquireUseRelease(
          Effect.sync(() => makeHasher(algorithm)),
          (hasher) =>
            Effect.map(
              canonicalizeWithByteLimit(encoded, maximumBytes, (segment) => {
                hasher.update(encodeUtf8Unchecked(segment))
              }),
              (canonicalByteLength) => new Result({ digest: fromHash(algorithm, hasher.digest()), canonicalByteLength })
            ),
          (hasher) => Effect.sync(() => hasher.destroy())
        )
    )
    : Effect.fail(new CanonicalJson.InvalidByteLimit({}))

/**
 * Synchronous bounded identity construction through `Schema.encodeEither`, with
 * the same encoded-preimage and inclusive segment-counting law. Blocks the
 * current JavaScript turn for encoding, traversal, sorting, and hashing. Use an
 * owner-controlled limit for small context-free values; no Effect runtime starts.
 * Invalid limits fail before encoding. Defaults to BLAKE3-256.
 *
 * @since 0.7.0
 * @category constructors
 */
export const fromSchemaWithByteLimitEither = <A, I>(
  schema: Schema.Schema<A, I>,
  value: A,
  maximumBytes: number,
  algorithm: Digest.Algorithm = "blake3-256"
): Either.Either<Result, CanonicalJson.ByteLimitError | CanonicalJson.Error | ParseResult.ParseError> =>
  isByteLimit(maximumBytes)
    ? Either.flatMap(Schema.encodeEither(schema)(value), (encoded) => {
      const hasher = makeHasher(algorithm)
      const result = Either.map(
        canonicalizeWithByteLimitEither(encoded, maximumBytes, (segment) => {
          hasher.update(encodeUtf8Unchecked(segment))
        }),
        (canonicalByteLength) => new Result({ digest: fromHash(algorithm, hasher.digest()), canonicalByteLength })
      )
      hasher.destroy()
      return result
    })
    : Either.left(new CanonicalJson.InvalidByteLimit({}))
