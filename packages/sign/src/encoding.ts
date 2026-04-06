/**
 * UTF-8 encoding, hex encoding, and constant-time byte comparison.
 *
 * Thin wrappers over `@noble/hashes` and `@noble/curves` utilities so
 * callers never need to reach into Noble directly. All functions are pure
 * and side-effect free — no Effect overhead for encoding operations.
 *
 * @since 0.1.0
 * @category encoding
 */

import { equalBytes as _equalBytes } from "@noble/curves/utils.js"
import { bytesToHex as _bytesToHex, utf8ToBytes as _utf8ToBytes } from "@noble/hashes/utils.js"
import type { Either } from "effect"
import { Encoding } from "effect"

/**
 * Convert a UTF-8 string to bytes.
 *
 * @since 0.1.0
 * @category encoding
 */
export const utf8ToBytes = (str: string): Uint8Array => _utf8ToBytes(str)

/**
 * Encode bytes to lowercase hex string.
 *
 * @since 0.1.0
 * @category encoding
 */
export const toHex = (bytes: Uint8Array): string => _bytesToHex(bytes)

/**
 * Encode bytes to a portable base64url string without padding.
 *
 * Detached signature workflows can carry public keys or raw signatures through
 * JSON-safe channels without introducing a second key-material schema surface.
 *
 * @since 0.2.0
 * @category encoding
 */
export const toBase64Url = (bytes: Uint8Array): string => Encoding.encodeBase64Url(bytes)

/**
 * Decode a base64url string without padding back to bytes.
 *
 * Returns a typed `Either` so malformed transport values fail explicitly at the
 * boundary instead of throwing during detached-signature verification.
 *
 * @since 0.2.0
 * @category encoding
 */
export const fromBase64Url = (encoded: string): Either.Either<Uint8Array, Encoding.DecodeException> =>
  Encoding.decodeBase64Url(encoded)

/**
 * Constant-time byte array equality comparison.
 *
 * Prevents timing side-channel attacks when comparing
 * secrets, signatures, or authentication material.
 *
 * @since 0.1.0
 * @category comparison
 */
export const equalBytes = (a: Uint8Array, b: Uint8Array): boolean => _equalBytes(a, b)
