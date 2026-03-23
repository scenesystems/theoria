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
import { toBase64Url, toHex } from "./encoding.js"
import { utf8ToBytes } from "./internal/bytes.js"
import type { FingerprintUnsupportedValue } from "./schemas/errors.js"

const hashBytes = (algorithm: "blake3-256" | "sha256", bytes: Uint8Array): Effect.Effect<Uint8Array> =>
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
  algorithm: "blake3-256" | "sha256",
  bytes: Uint8Array
): Effect.Effect<Uint8Array> => hashBytes(algorithm, bytes)

/**
 * Hash a UTF-8 string using the specified algorithm.
 *
 * Converts the string to bytes via UTF-8 encoding, then hashes.
 * Equivalent to `digestBytes(algorithm, utf8ToBytes(text))`.
 *
 * @since 0.1.0
 * @category digest
 */
export const digestUtf8 = (
  algorithm: "blake3-256" | "sha256",
  text: string
): Effect.Effect<Uint8Array> => hashBytes(algorithm, utf8ToBytes(text))

/**
 * Hash raw bytes and encode the digest as base64url (no padding).
 *
 * Returns a 43-character string for 256-bit digests.
 *
 * @since 0.1.0
 * @category digest
 */
export const digestBytesBase64Url = (
  algorithm: "blake3-256" | "sha256",
  bytes: Uint8Array
): Effect.Effect<string> => Effect.flatMap(hashBytes(algorithm, bytes), toBase64Url)

/**
 * Hash a UTF-8 string and encode the digest as base64url (no padding).
 *
 * Equivalent to `digestBytesBase64Url(algorithm, utf8ToBytes(text))`.
 *
 * @since 0.1.0
 * @category digest
 */
export const digestUtf8Base64Url = (
  algorithm: "blake3-256" | "sha256",
  text: string
): Effect.Effect<string> => Effect.flatMap(hashBytes(algorithm, utf8ToBytes(text)), toBase64Url)

/**
 * Hash raw bytes and encode the digest as lowercase hex.
 *
 * Returns a 64-character string for 256-bit digests.
 *
 * @since 0.1.0
 * @category digest
 */
export const digestBytesHex = (
  algorithm: "blake3-256" | "sha256",
  bytes: Uint8Array
): Effect.Effect<string> => Effect.flatMap(hashBytes(algorithm, bytes), toHex)

/**
 * Canonicalize a structured value to UTF-8 bytes via RFC 8785 JCS.
 *
 * Composes {@link canonicalize} (string output) with UTF-8 encoding
 * to produce the raw bytes ready for hashing.
 *
 * @since 0.1.0
 * @category canonicalization
 */
export const canonicalJsonBytes = (
  value: unknown
): Effect.Effect<Uint8Array, FingerprintUnsupportedValue> => Effect.map(canonicalize(value), utf8ToBytes)
