/**
 * UTF-8 conversion, byte comparison, and random-byte generation.
 *
 * @since 0.1.0
 * @category encoding
 * @module
 */

import {
  bytesToUtf8 as _bytesToUtf8,
  equalBytes as _equalBytes,
  randomBytes as _randomBytes,
  utf8ToBytes as _utf8ToBytes
} from "@noble/ciphers/utils.js"
import { Effect } from "effect"

/**
 * Encodes a string as UTF-8 bytes.
 *
 * @param str - String to encode.
 * @returns Newly allocated UTF-8 bytes.
 *
 * @since 0.1.0
 * @category encoding
 */
export const utf8ToBytes = (str: string): Uint8Array => _utf8ToBytes(str)

/**
 * Decodes UTF-8 bytes into a string, replacing malformed sequences.
 *
 * @param bytes - UTF-8 bytes to decode.
 * @returns The decoded string.
 *
 * @since 0.1.0
 * @category encoding
 */
export const utf8FromBytes = (bytes: Uint8Array): string => _bytesToUtf8(bytes)

/**
 * Compares equal-length byte arrays without data-dependent early exit.
 *
 * @remarks
 * Arrays of different lengths return `false` before byte comparison. Length and timing from
 * surrounding caller logic therefore remain observable.
 *
 * @param a - First byte array.
 * @param b - Second byte array.
 * @returns Whether both arrays have the same length and contents.
 *
 * @since 0.1.0
 * @category comparison
 */
export const equalBytes = (a: Uint8Array, b: Uint8Array): boolean => _equalBytes(a, b)

/**
 * Obtains random bytes from the runtime cryptographic random source.
 *
 * @remarks
 * The default produces a key accepted by this package's algorithms. Other lengths are allowed
 * by this utility but rejected when passed to encryption or decryption. The runtime must provide
 * `crypto.getRandomValues`; this operation does not use Effect's seedable `Random` service.
 *
 * @param length - Number of bytes to generate; defaults to 32.
 * @returns Newly allocated random bytes produced when the effect executes.
 *
 * @since 0.1.0
 * @category keys
 */
export const generateKey = (length: number = 32): Effect.Effect<Uint8Array> => Effect.sync(() => _randomBytes(length))
