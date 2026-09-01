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

/**
 * Convert a UTF-8 string to bytes.
 *
 * @param str - JavaScript string to encode as UTF-8.
 * @returns Newly allocated UTF-8 bytes.
 *
 * @since 0.1.0
 * @category encoding
 */
export const utf8ToBytes = (str: string): Uint8Array => _utf8ToBytes(str)

/**
 * Encode bytes to lowercase hex string.
 *
 * @param bytes - Bytes to encode.
 * @returns Two lowercase hexadecimal characters per input byte.
 *
 * @since 0.1.0
 * @category encoding
 */
export const toHex = (bytes: Uint8Array): string => _bytesToHex(bytes)

/**
 * Constant-time byte array equality comparison.
 *
 * @remarks
 * Prevents timing side-channel attacks when comparing
 * secrets, signatures, or authentication material.
 * Inputs of different lengths return `false`; length is not hidden.
 *
 * @param a - First byte sequence.
 * @param b - Second byte sequence.
 * @returns Whether length and contents are equal.
 *
 * @since 0.1.0
 * @category comparison
 */
export const equalBytes = (a: Uint8Array, b: Uint8Array): boolean => _equalBytes(a, b)
