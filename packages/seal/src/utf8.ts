/**
 * UTF-8 encoding, CSPRNG key generation, and constant-time byte comparison.
 *
 * Thin wrappers over `@noble/ciphers` utilities so callers never need to
 * reach into Noble directly. All functions are pure (no Effect overhead)
 * except `generateKey`, which returns an `Effect` to keep key material
 * creation explicit in the program trace.
 *
 * @since 0.1.0
 * @category encoding
 */

import {
  bytesToUtf8 as _bytesToUtf8,
  equalBytes as _equalBytes,
  randomBytes as _randomBytes,
  utf8ToBytes as _utf8ToBytes
} from "@noble/ciphers/utils.js"
import { Effect } from "effect"

/**
 * Convert a UTF-8 string to bytes.
 *
 * @since 0.1.0
 * @category encoding
 */
export const utf8ToBytes = (str: string): Uint8Array => _utf8ToBytes(str)

/**
 * Convert bytes to a UTF-8 string.
 *
 * @since 0.1.0
 * @category encoding
 */
export const utf8FromBytes = (bytes: Uint8Array): string => _bytesToUtf8(bytes)

/**
 * Constant-time byte array equality comparison.
 *
 * Prevents timing side-channel attacks when comparing
 * secrets, keys, or authentication tags.
 *
 * @since 0.1.0
 * @category comparison
 */
export const equalBytes = (a: Uint8Array, b: Uint8Array): boolean => _equalBytes(a, b)

/**
 * Generate a cryptographic random key of the specified length.
 *
 * Uses the platform CSPRNG (`crypto.getRandomValues`) via
 * `@noble/ciphers`. All AEAD algorithms in this package
 * require 32-byte keys.
 *
 * @since 0.1.0
 * @category keys
 */
export const generateKey = (length: number = 32): Effect.Effect<Uint8Array> => Effect.sync(() => _randomBytes(length))
