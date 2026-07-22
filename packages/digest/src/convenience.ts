/**
 * Convenience digest functions.
 *
 * Algorithm-parameterized pipelines for common hashing workflows:
 * raw bytes → hash, string → hash, with optional encoding
 * (base64url or hex).
 *
 * These compose the low-level primitives ({@link blake3Hash},
 * {@link sha256}, {@link toBase64Url}, {@link toHex}) into
 * single-call operations parameterized by {@link DigestAlgorithm}.
 *
 * @see {@link digestBytes} — raw byte hashing
 * @see {@link digestUtf8} — string hashing
 * @see {@link digestBytesBase64Url} — hash + base64url
 * @see {@link digestUtf8Base64Url} — hash string + base64url
 * @see {@link digestBytesHex} — hash + hex
 * @see {@link canonicalJsonBytes} — canonicalize to UTF-8 bytes
 *
 * @since 0.1.0
 * @category digest
 */

import { Effect, Match } from "effect"
import { blake3Hash } from "./algorithms/blake3.js"
import { sha256 } from "./algorithms/sha256.js"
import { canonicalize } from "./canonicalize.js"
import { encodeUtf8, toBase64Url, toHex } from "./encoding.js"
import { encodeUtf8Unchecked } from "./internal/unicode.js"
import type { DigestAlgorithm } from "./schemas/DigestAlgorithm.js"
import type { CanonicalizationError, InvalidUnicode } from "./schemas/errors.js"

const hashBytes = (algorithm: DigestAlgorithm, bytes: Uint8Array): Effect.Effect<Uint8Array> =>
  Match.value(algorithm).pipe(
    Match.when("blake3-256", () => blake3Hash(bytes)),
    Match.when("sha256", () => sha256(bytes)),
    Match.exhaustive
  )

/**
 * Hash raw bytes using the specified algorithm.
 *
 * Returns a 32-byte `Uint8Array` digest. Pure deterministic
 * operation — no error channel.
 *
 * @since 0.1.0
 * @category digest
 */
export const digestBytes = (
  algorithm: DigestAlgorithm,
  bytes: Uint8Array
): Effect.Effect<Uint8Array> => hashBytes(algorithm, bytes)

/**
 * Hash a UTF-8 string using the specified algorithm.
 *
 * Strictly encodes well-formed Unicode without normalization, then hashes.
 * Malformed UTF-16 fails with its offending code-unit index.
 *
 * @since 0.1.0
 * @category digest
 */
export const digestUtf8 = (
  algorithm: DigestAlgorithm,
  text: string
): Effect.Effect<Uint8Array, InvalidUnicode> => Effect.flatMap(encodeUtf8(text), (bytes) => hashBytes(algorithm, bytes))

/**
 * Hash raw bytes and encode the digest as base64url (no padding).
 *
 * Returns a 43-character string for 256-bit digests.
 *
 * @since 0.1.0
 * @category digest
 */
export const digestBytesBase64Url = (
  algorithm: DigestAlgorithm,
  bytes: Uint8Array
): Effect.Effect<string> => Effect.map(hashBytes(algorithm, bytes), toBase64Url)

/**
 * Hash a UTF-8 string and encode the digest as base64url (no padding).
 *
 * Strictly encodes well-formed Unicode without normalization, then hashes and
 * encodes the digest. Malformed UTF-16 fails with its offending code-unit index.
 *
 * @since 0.1.0
 * @category digest
 */
export const digestUtf8Base64Url = (
  algorithm: DigestAlgorithm,
  text: string
): Effect.Effect<string, InvalidUnicode> => Effect.map(digestUtf8(algorithm, text), toBase64Url)

/**
 * Hash raw bytes and encode the digest as lowercase hex.
 *
 * Returns a 64-character string for 256-bit digests.
 *
 * @since 0.1.0
 * @category digest
 */
export const digestBytesHex = (
  algorithm: DigestAlgorithm,
  bytes: Uint8Array
): Effect.Effect<string> => Effect.map(hashBytes(algorithm, bytes), toHex)

/**
 * Canonicalize a structured value to UTF-8 bytes via RFC 8785 JCS.
 *
 * Composes strict, stack-safe {@link canonicalize} with UTF-8 encoding to
 * produce the exact canonical bytes ready for hashing. Malformed Unicode in
 * values or keys fails through `CanonicalizationError`; replacement text is
 * never emitted.
 *
 * @since 0.1.0
 * @category canonicalization
 */
export const canonicalJsonBytes = (
  value: unknown
): Effect.Effect<Uint8Array, CanonicalizationError> => Effect.map(canonicalize(value), encodeUtf8Unchecked)

/**
 * Canonicalize structured data via RFC 8785 JCS, then hash the canonical bytes.
 *
 * Equivalent to `canonicalJsonBytes(value)` followed by `digestBytes(algorithm, bytes)`.
 *
 * @since 0.2.0
 * @category digest
 */
export const digestCanonicalJsonBytes = (
  algorithm: DigestAlgorithm,
  value: unknown
): Effect.Effect<Uint8Array, CanonicalizationError> =>
  Effect.flatMap(canonicalJsonBytes(value), (bytes) => digestBytes(algorithm, bytes))

/**
 * Canonicalize structured data via RFC 8785 JCS, hash, and base64url encode.
 *
 * @since 0.2.0
 * @category digest
 */
export const digestCanonicalJsonBase64Url = (
  algorithm: DigestAlgorithm,
  value: unknown
): Effect.Effect<string, CanonicalizationError> =>
  Effect.flatMap(canonicalJsonBytes(value), (bytes) => digestBytesBase64Url(algorithm, bytes))

/**
 * Canonicalize structured data via RFC 8785 JCS, hash, and hex encode.
 *
 * @since 0.2.0
 * @category digest
 */
export const digestCanonicalJsonHex = (
  algorithm: DigestAlgorithm,
  value: unknown
): Effect.Effect<string, CanonicalizationError> =>
  Effect.flatMap(canonicalJsonBytes(value), (bytes) => digestBytesHex(algorithm, bytes))
