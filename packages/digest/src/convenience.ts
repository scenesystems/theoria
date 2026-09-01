/**
 * One-shot hashing for bytes, strict text, and canonical structured data.
 *
 * Callers select BLAKE3-256 or SHA-256 and may receive raw digest bytes,
 * unpadded base64url, or lowercase hexadecimal output.
 *
 * @see {@link digestBytes}
 * @see {@link digestUtf8}
 * @see {@link canonicalJsonBytes}
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
 * Hashes an exact byte preimage without text encoding or canonicalization.
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
 * Hashes the strict UTF-8 encoding of text without Unicode normalization.
 *
 * @remarks
 * An unpaired UTF-16 surrogate fails with its code-unit index.
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
 * Hashes bytes and encodes the 32-byte digest as unpadded base64url.
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
 * Hashes strict UTF-8 text and encodes the digest as unpadded base64url.
 *
 * @remarks
 * Text is not normalized. An unpaired UTF-16 surrogate fails with its
 * code-unit index.
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
 * Hashes bytes and encodes the 32-byte digest as lowercase hexadecimal.
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
 * Encodes admitted structured data as its exact RFC 8785 UTF-8 byte sequence.
 *
 * @remarks
 * Malformed Unicode in values or keys fails through `CanonicalizationError`;
 * replacement text is never emitted.
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
 * Hashes canonical JSON bytes so object insertion order does not affect the digest.
 *
 * @remarks
 * This is equivalent to passing the output of `canonicalJsonBytes` to
 * `digestBytes`.
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
 * Hashes canonical JSON bytes and returns an unpadded base64url digest.
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
 * Hashes canonical JSON bytes and returns a lowercase hexadecimal digest.
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
