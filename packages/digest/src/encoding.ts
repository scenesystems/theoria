/**
 * Base64url encoding and decoding (RFC 4648 §5).
 *
 * Universal digest encoding across the ecosystem. All 256-bit
 * digests encode to base64url strings with no padding.
 *
 * Wraps `base64urlnopad` from `@scure/base` — audited by Cure53,
 * zero-dependency, RFC 4648-compliant.
 *
 * URL-safe alphabet: `A-Z a-z 0-9 - _` (no `+` `/` `=`).
 *
 * @see {@link blake3Hash} — produces `Uint8Array` that this module encodes
 * @see {@link sha256} — produces `Uint8Array` that this module encodes
 * @see {@link Digest256} — schema enforcing the encoded output shape
 *
 * @since 0.1.0
 * @category encoding
 */

import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js"
import { base64urlnopad } from "@scure/base"
import { Effect } from "effect"

/**
 * Encode bytes to base64url string (no padding).
 *
 * @since 0.1.0
 * @category encoding
 */
export const toBase64Url = (bytes: Uint8Array): Effect.Effect<string> => Effect.sync(() => base64urlnopad.encode(bytes))

/**
 * Decode base64url string (no padding) to bytes.
 *
 * @since 0.1.0
 * @category encoding
 */
export const fromBase64Url = (str: string): Effect.Effect<Uint8Array> => Effect.sync(() => base64urlnopad.decode(str))

/**
 * Encode bytes to hex string.
 *
 * @since 0.1.0
 * @category encoding
 */
export const toHex = (bytes: Uint8Array): Effect.Effect<string> => Effect.sync(() => bytesToHex(bytes))

/**
 * Decode hex string to bytes.
 *
 * @since 0.1.0
 * @category encoding
 */
export const fromHex = (hex: string): Effect.Effect<Uint8Array> => Effect.sync(() => hexToBytes(hex))
