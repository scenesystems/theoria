/**
 * Preparing message bytes and comparing cryptographic byte sequences.
 * Use Effect's Encoding module directly for hex and base64 codecs.
 *
 * @since 0.5.0
 * @module
 */
import { equalBytes } from "@noble/curves/utils.js"
import { Either, Encoding } from "effect"

/**
 * Encodes a string as fresh UTF-8 bytes without normalization. Lone UTF-16
 * surrogates become U+FFFD; a BOM remains part of the message. No framing or
 * domain separation is added. The base64 intermediate uses Effect's UTF-8 codec.
 * @since 0.5.0
 * @category conversions
 */
export const fromString = (self: string): Uint8Array =>
  Either.getOrThrow(Encoding.decodeBase64(Encoding.encodeBase64(self)))

/**
 * Compares equal-length arrays without data-dependent early exit. Different
 * lengths return false immediately, so length is observable. This is a byte
 * comparison, not a guarantee of constant-time execution by the JS runtime.
 * @since 0.5.0
 * @category comparison
 */
export const equal = (self: Uint8Array, that: Uint8Array): boolean => equalBytes(self, that)
