/**
 * Algorithm-tagged content identities. Schema encoding defines a value's wire
 * representation; CanonicalJson defines its deterministic byte preimage; Digest
 * owns cryptographic hashing. This module owns the resulting identity model.
 *
 * @since 0.7.0
 * @module
 */

import { Boolean, Effect, Equal, Hash, Result as EffectResult, Schema } from "effect"
import { Base64Url } from "effect/encoding"
import * as CanonicalJson from "./CanonicalJson.js"
import * as Digest from "./Digest.js"
import { canonicalizeWithByteLimit, canonicalizeWithByteLimitResult } from "./internal/canonicalJson/traversal.js"
import { makeHasher } from "./internal/digest.js"
import { encodeUtf8Unchecked } from "./internal/utf8.js"

/**
 * Canonical unpadded base64url encoding of 32 digest bytes. Decoding validates
 * representation, not whether the digest actually matches any content.
 *
 * @since 0.7.0
 * @category models
 */
export const Value = Schema.String.pipe(
  // The final base64 sextet contains four data bits and two zero pad bits.
  Schema.check(Schema.isPattern(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/)),
  Schema.brand("@scenesystems/digest/ContentDigest/Value")
).annotate({ identifier: "@scenesystems/digest/ContentDigest/Value" })

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
}) {
  [Equal.symbol](that: Equal.Equal): boolean {
    return Schema.is(ContentDigest)(that) && this.algorithm === that.algorithm && this.digest === that.digest
  }

  [Hash.symbol](): number {
    return Hash.combine(Hash.string(this.algorithm))(Hash.string(this.digest))
  }
}

/**
 * A content identity paired with its exact canonical UTF-8 preimage byte count.
 * The encoded form nests the `ContentDigest` object, not its tagged string.
 *
 * @since 0.7.0
 * @category models
 */
export class Result extends Schema.Class<Result>("@scenesystems/digest/ContentDigest/Result")({
  digest: ContentDigest,
  canonicalByteLength: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))
}) {
  [Equal.symbol](that: Equal.Equal): boolean {
    return Schema.is(Result)(that) && Equal.equals(this.digest, that.digest) &&
      this.canonicalByteLength === that.canonicalByteLength
  }

  [Hash.symbol](): number {
    return Hash.combine(Hash.hash(this.digest))(Hash.number(this.canonicalByteLength))
  }
}

/**
 * Converts an identity to the stable `<algorithm>:<base64url>` string used by
 * cache and protocol boundaries. This does not hash or serialize the preimage.
 *
 * @since 0.7.0
 * @category conversions
 */
export const toString = (self: ContentDigest): string => `${self.algorithm}:${self.digest}`

const fromHash = (algorithm: Digest.Algorithm, bytes: Uint8Array): ContentDigest =>
  new ContentDigest({ algorithm, digest: Value.make(Base64Url.encode(bytes)) })

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
 * encoding exactly once per execution to `Schema.encodeEffect`, preserving encoding
 * requirements, SchemaError, defects, and interruption. Synchronous Schema transforms are not
 * made cooperative. Defaults to BLAKE3-256.
 *
 * @since 0.7.0
 * @category constructors
 */
export const fromSchema = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  value: A,
  algorithm: Digest.Algorithm = "blake3-256"
): Effect.Effect<ContentDigest, CanonicalJson.Error | Schema.SchemaError, RE> =>
  Effect.flatMap(Effect.suspend(() => Schema.encodeEffect(schema)(value)), (encoded) => fromUnknown(algorithm, encoded))

const isByteLimit = Schema.is(Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)))

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
export const fromSchemaWithByteLimit = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  value: A,
  maximumBytes: number,
  algorithm: Digest.Algorithm = "blake3-256"
): Effect.Effect<Result, CanonicalJson.ByteLimitError | CanonicalJson.Error | Schema.SchemaError, RE> =>
  Boolean.match(isByteLimit(maximumBytes), {
    onTrue: () =>
      Effect.flatMap(
        Effect.suspend(() => Schema.encodeEffect(schema)(value)),
        (encoded) =>
          Effect.acquireUseRelease(
            Effect.sync(() => makeHasher(algorithm)),
            (hasher) =>
              Effect.map(
                canonicalizeWithByteLimit(encoded, maximumBytes, (segment) => {
                  hasher.update(encodeUtf8Unchecked(segment))
                }),
                (canonicalByteLength) =>
                  new Result({ digest: fromHash(algorithm, hasher.digest()), canonicalByteLength })
              ),
            (hasher) => Effect.sync(() => hasher.destroy())
          )
      ),
    onFalse: () => Effect.fail(new CanonicalJson.InvalidByteLimit({}))
  })

/**
 * Synchronous bounded identity construction through `Schema.encodeResult`, with
 * the same encoded-preimage and inclusive segment-counting law. Blocks the
 * current JavaScript turn for encoding, traversal, sorting, and hashing. Use an
 * owner-controlled limit for small values with service-free encoding; decoding
 * requirements are irrelevant to this operation. No Effect runtime starts.
 * Invalid limits fail before encoding. Defaults to BLAKE3-256.
 *
 * @since 0.7.0
 * @category constructors
 */
export const fromSchemaWithByteLimitResult = <A, I, RD>(
  schema: Schema.Codec<A, I, RD>,
  value: A,
  maximumBytes: number,
  algorithm: Digest.Algorithm = "blake3-256"
): EffectResult.Result<Result, CanonicalJson.ByteLimitError | CanonicalJson.Error | Schema.SchemaError> =>
  Boolean.match(isByteLimit(maximumBytes), {
    onTrue: () =>
      EffectResult.flatMap(Schema.encodeResult(schema)(value), (encoded) => {
        const hasher = makeHasher(algorithm)
        const result = EffectResult.map(
          canonicalizeWithByteLimitResult(encoded, maximumBytes, (segment) => {
            hasher.update(encodeUtf8Unchecked(segment))
          }),
          (canonicalByteLength) => new Result({ digest: fromHash(algorithm, hasher.digest()), canonicalByteLength })
        )
        hasher.destroy()
        return result
      }),
    onFalse: () => EffectResult.fail(new CanonicalJson.InvalidByteLimit({}))
  })
