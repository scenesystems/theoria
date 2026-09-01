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

import { Effect } from "effect"
import { encodeUtf8, toBase64Url, toHex } from "./encoding.js"
import { hashBytes } from "./internal/digest-bytes.js"
import { canonicalizeSegments, encodeCanonicalSegments } from "./internal/jcs.js"
import type { DigestAlgorithm } from "./schemas/DigestAlgorithm.js"
import type { CanonicalizationError, InvalidUnicode } from "./schemas/errors.js"

/**
 * Produces a 32-byte digest without text encoding or canonicalization.
 *
 * @remarks
 * Use this when the caller already owns the exact preimage bytes.
 *
 * @param algorithm - Digest algorithm applied to `bytes`.
 * @param bytes - Exact preimage bytes.
 * @returns A newly allocated 32-byte digest.
 *
 * @since 0.1.0
 * @category digest
 */
export const digestBytes = (
  algorithm: DigestAlgorithm,
  bytes: Uint8Array
): Effect.Effect<Uint8Array> => hashBytes(algorithm, bytes)

/**
 * Produces a digest from the strict UTF-8 encoding of text.
 *
 * @remarks
 * Strictly encodes well-formed Unicode without normalization, then hashes.
 * Malformed UTF-16 fails with its offending code-unit index.
 *
 * @param algorithm - Digest algorithm applied to the encoded text.
 * @param text - Text to encode without normalization or replacement.
 * @returns A 32-byte digest, or `InvalidUnicode` for an unpaired surrogate.
 *
 * @since 0.1.0
 * @category digest
 */
export const digestUtf8 = (
  algorithm: DigestAlgorithm,
  text: string
): Effect.Effect<Uint8Array, InvalidUnicode> => Effect.flatMap(encodeUtf8(text), (bytes) => hashBytes(algorithm, bytes))

/**
 * Produces the transport-safe unpadded base64url form of a byte digest.
 *
 * @remarks
 * Returns a 43-character string for 256-bit digests.
 *
 * @param algorithm - Digest algorithm applied to `bytes`.
 * @param bytes - Exact preimage bytes.
 * @returns The 43-character unpadded base64url digest.
 *
 * @since 0.1.0
 * @category digest
 */
export const digestBytesBase64Url = (
  algorithm: DigestAlgorithm,
  bytes: Uint8Array
): Effect.Effect<string> => Effect.map(hashBytes(algorithm, bytes), toBase64Url)

/**
 * Produces an unpadded base64url digest from strictly encoded text.
 *
 * @remarks
 * Strictly encodes well-formed Unicode without normalization, then hashes and
 * encodes the digest. Malformed UTF-16 fails with its offending code-unit index.
 *
 * @param algorithm - Digest algorithm applied to the encoded text.
 * @param text - Text to encode without normalization or replacement.
 * @returns A 43-character digest, or `InvalidUnicode` for malformed UTF-16.
 *
 * @since 0.1.0
 * @category digest
 */
export const digestUtf8Base64Url = (
  algorithm: DigestAlgorithm,
  text: string
): Effect.Effect<string, InvalidUnicode> => Effect.map(digestUtf8(algorithm, text), toBase64Url)

/**
 * Produces the lowercase hexadecimal form of a byte digest.
 *
 * @remarks
 * Returns a 64-character string for 256-bit digests.
 *
 * @param algorithm - Digest algorithm applied to `bytes`.
 * @param bytes - Exact preimage bytes.
 * @returns The 64-character lowercase hexadecimal digest.
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
 * @remarks
 * Composes strict, stack-safe {@link canonicalize} with UTF-8 encoding to
 * produce the exact canonical bytes ready for hashing. Malformed Unicode in
 * values or keys fails through `CanonicalizationError`; replacement text is
 * never emitted.
 *
 * @param value - Value in the strict canonical plain-data domain.
 * @returns Exact canonical UTF-8 bytes, or a canonicalization failure.
 *
 * @since 0.1.0
 * @category canonicalization
 */
export const canonicalJsonBytes = (
  value: unknown
): Effect.Effect<Uint8Array, CanonicalizationError> =>
  Effect.flatMap(canonicalizeSegments(value), encodeCanonicalSegments)

/**
 * Produces a raw digest whose identity is independent of object insertion order.
 *
 * @remarks
 * Equivalent to `canonicalJsonBytes(value)` followed by `digestBytes(algorithm, bytes)`.
 *
 * @param algorithm - Digest algorithm applied to the canonical bytes.
 * @param value - Value in the strict canonical plain-data domain.
 * @returns A 32-byte digest, or a canonicalization failure.
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
 * Produces an unpadded base64url digest with canonical structured-data identity.
 *
 * @param algorithm - Digest algorithm applied to the canonical bytes.
 * @param value - Value in the strict canonical plain-data domain.
 * @returns A 43-character digest, or a canonicalization failure.
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
 * Produces a lowercase hexadecimal digest with canonical structured-data identity.
 *
 * @param algorithm - Digest algorithm applied to the canonical bytes.
 * @param value - Value in the strict canonical plain-data domain.
 * @returns A 64-character digest, or a canonicalization failure.
 *
 * @since 0.2.0
 * @category digest
 */
export const digestCanonicalJsonHex = (
  algorithm: DigestAlgorithm,
  value: unknown
): Effect.Effect<string, CanonicalizationError> =>
  Effect.flatMap(canonicalJsonBytes(value), (bytes) => digestBytesHex(algorithm, bytes))
