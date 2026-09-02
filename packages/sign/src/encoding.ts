/**
 * UTF-8 encoding, hex encoding, and constant-time byte comparison.
 *
 * @since 0.1.0
 * @category encoding
 */

import { equalBytes as _equalBytes } from "@noble/curves/utils.js"
import { bytesToHex as _bytesToHex, utf8ToBytes as _utf8ToBytes } from "@noble/hashes/utils.js"

/**
 * Encodes a JavaScript string as UTF-8 bytes.
 *
 * @param str - JavaScript string to encode as UTF-8.
 * @returns Newly allocated UTF-8 bytes.
 *
 * @since 0.1.0
 * @category encoding
 */
export const utf8ToBytes = (str: string): Uint8Array => _utf8ToBytes(str)

/**
 * Encodes bytes as lowercase hexadecimal.
 *
 * @param bytes - Bytes to encode.
 * @returns Two lowercase hexadecimal characters per input byte.
 *
 * @since 0.1.0
 * @category encoding
 */
export const toHex = (bytes: Uint8Array): string => _bytesToHex(bytes)

/**
 * Compares equal-length byte arrays without a data-dependent early exit.
 *
 * @remarks
 * Inputs of different lengths return `false` before content comparison, so
 * length remains observable.
 *
 * @param a - First byte sequence.
 * @param b - Second byte sequence.
 * @returns Whether length and contents are equal.
 *
 * @since 0.1.0
 * @category comparison
 */
export const equalBytes = (a: Uint8Array, b: Uint8Array): boolean => _equalBytes(a, b)
