/**
 * Base64url and hex encoding (RFC 4648 §5).
 *
 * Universal digest encoding across the ecosystem. All 256-bit
 * digests encode to base64url strings with no padding.
 *
 * Uses Effect `Encoding` module for base64url and hex — native
 * Effect, no external dependencies for encoding.
 *
 * URL-safe alphabet: `A-Z a-z 0-9 - _` (no `+` `/` `=`).
 *
 * Encode operations are pure (cannot fail). Decode operations
 * return `Either` — left for malformed input, right for bytes.
 *
 * @see {@link blake3Hash} — produces `Uint8Array` that this module encodes
 * @see {@link sha256} — produces `Uint8Array` that this module encodes
 * @see {@link Digest256} — schema enforcing the encoded output shape
 *
 * @since 0.1.0
 * @category encoding
 */

import { utf8ToBytes as _utf8ToBytes } from "@noble/hashes/utils.js"
import { Effect, type Either, Encoding, Option } from "effect"

import { encodeUtf8Unchecked, unicodeFault } from "./internal/unicode.js"
import type { InvalidUnicode } from "./schemas/errors.js"

/**
 * Convert a UTF-8 string to bytes.
 *
 * @since 0.1.0
 * @category encoding
 */
export const utf8ToBytes = (str: string): Uint8Array => _utf8ToBytes(str)

/**
 * Strictly encode well-formed Unicode text as UTF-8 bytes.
 *
 * Malformed UTF-16 fails with the offending code-unit index relative to the
 * input text. Valid text is preserved exactly without Unicode normalization.
 *
 * @example
 * ```ts
 * import { encodeUtf8 } from "@scenesystems/digest"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   return yield* encodeUtf8("hello 😀")
 * })
 * ```
 *
 * @since 0.3.0
 * @category encoding
 */
export const encodeUtf8 = (text: string): Effect.Effect<Uint8Array, InvalidUnicode> =>
  Effect.suspend(() =>
    Option.match(unicodeFault(text), {
      onNone: () => Effect.sync(() => encodeUtf8Unchecked(text)),
      onSome: Effect.fail
    })
  )

/**
 * Encode bytes to base64url string (no padding).
 *
 * Pure operation — encoding cannot fail.
 *
 * @since 0.1.0
 * @category encoding
 */
export const toBase64Url = (bytes: Uint8Array): string => Encoding.encodeBase64Url(bytes)

/**
 * Decode base64url string (no padding) to bytes.
 *
 * Returns `Either` — left for malformed input.
 *
 * @since 0.1.0
 * @category encoding
 */
export const fromBase64Url = (str: string): Either.Either<Uint8Array, Encoding.DecodeException> =>
  Encoding.decodeBase64Url(str)

/**
 * Encode bytes to lowercase hex string (2 chars per byte).
 *
 * Pure operation — encoding cannot fail.
 *
 * @since 0.1.0
 * @category encoding
 */
export const toHex = (bytes: Uint8Array): string => Encoding.encodeHex(bytes)

/**
 * Decode a lowercase hex string back to raw bytes.
 *
 * Returns `Either` — left for malformed input.
 *
 * @since 0.1.0
 * @category encoding
 */
export const fromHex = (hex: string): Either.Either<Uint8Array, Encoding.DecodeException> => Encoding.decodeHex(hex)
