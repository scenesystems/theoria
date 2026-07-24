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

import { Effect, Number as Num, type ParseResult, Schema } from "effect"
import { canonicalJsonBytes } from "./convenience.js"
import { digest } from "./digest.js"
import { digestBytesTagged } from "./internal/digest-bytes.js"
import type { DigestAlgorithm } from "./schemas/DigestAlgorithm.js"
import { CanonicalByteLimitExceeded, type CanonicalizationError } from "./schemas/errors.js"

const isByteLimit = Schema.is(Schema.NonNegativeInt)
const INVALID_BYTE_LIMIT_MESSAGE = "digestSchemaValueWithByteLimit maximumBytes must be a non-negative safe integer"

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
 * The value is encoded once and canonicalized once. The resulting canonical
 * byte array is measured before hashing; an exact-bound value succeeds, while
 * a value over the limit fails with the fieldless
 * {@link CanonicalByteLimitExceeded} classification before algorithm dispatch.
 * Successful calls hash that same measured byte array and return exactly the
 * algorithm-tagged text produced by {@link digestSchemaValue}.
 *
 * This limit constrains the canonical bytes admitted to hashing. It is not a
 * traversal or allocation guard because canonical bytes must be materialized
 * before their exact length is known. `maximumBytes` must be a non-negative
 * safe integer; an invalid maximum is a caller defect.
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
  string,
  CanonicalByteLimitExceeded | CanonicalizationError | ParseResult.ParseError,
  never
> =>
  !isByteLimit(maximumBytes)
    ? Effect.dieMessage(INVALID_BYTE_LIMIT_MESSAGE)
    : Effect.flatMap(
      Schema.encode(schema)(value),
      (encoded) =>
        Effect.flatMap(canonicalJsonBytes(encoded), (bytes) =>
          Num.greaterThan(bytes.byteLength, maximumBytes)
            ? new CanonicalByteLimitExceeded({})
            : digestBytesTagged(algorithm, bytes))
    )
