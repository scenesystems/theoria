/**
 * Base64url and hex encoding (RFC 4648 §5).
 *
 * All 256-bit digests encode to 43 base64url characters without padding or 64
 * hexadecimal characters.
 *
 * URL-safe alphabet: `A-Z a-z 0-9 - _` (no `+` `/` `=`).
 *
 * Raw-byte encode operations are pure. Strict text encoding returns an Effect
 * that rejects malformed UTF-16, while decode operations return `Either` —
 * left for malformed input, right for bytes.
 *
 * @see {@link blake3Hash} — produces `Uint8Array` that this module encodes
 * @see {@link sha256} — produces `Uint8Array` that this module encodes
 * @see {@link Digest256} — schema enforcing the encoded output shape
 *
 * @since 0.1.0
 * @category encoding
 */

import { Effect, type Either, Encoding, Option } from "effect"

import { encodeUtf8Unchecked, unicodeFault } from "./internal/unicode.js"
import type { InvalidUnicode } from "./schemas/errors.js"

/**
 * Strictly encode well-formed Unicode text as UTF-8 bytes.
 *
 * @remarks
 * Malformed UTF-16 fails with the offending code-unit index relative to the
 * input text. Valid text is preserved exactly without Unicode normalization.
 *
 * @param text - Text to encode without normalization or replacement.
 * @returns UTF-8 bytes, or `InvalidUnicode` at the first unpaired surrogate.
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
 * Uses the RFC 4648 §5 alphabet and omits padding.
 *
 * @param bytes - Bytes to encode.
 * @returns The unpadded base64url representation.
 *
 * @since 0.1.0
 * @category encoding
 */
export const toBase64Url = (bytes: Uint8Array): string => Encoding.encodeBase64Url(bytes)

/**
 * Decodes an unpadded RFC 4648 §5 representation.
 *
 * @param str - Encoded input.
 * @returns Decoded bytes, or `DecodeException` for malformed input.
 *
 * @since 0.1.0
 * @category encoding
 */
export const fromBase64Url = (str: string): Either.Either<Uint8Array, Encoding.DecodeException> =>
  Encoding.decodeBase64Url(str)

/**
 * Emits two lowercase hexadecimal characters per byte.
 *
 * @param bytes - Bytes to encode.
 * @returns The lowercase hexadecimal representation.
 *
 * @since 0.1.0
 * @category encoding
 */
export const toHex = (bytes: Uint8Array): string => Encoding.encodeHex(bytes)

/**
 * Decodes hexadecimal text accepted by Effect's strict hex decoder.
 *
 * @param hex - Encoded input.
 * @returns Decoded bytes, or `DecodeException` for malformed input.
 *
 * @since 0.1.0
 * @category encoding
 */
export const fromHex = (hex: string): Either.Either<Uint8Array, Encoding.DecodeException> => Encoding.decodeHex(hex)
