/**
 * Strict UTF-8, base64url, and hexadecimal encoding.
 *
 * @remarks
 * All 256-bit digests encode to 43 base64url characters without padding or 64
 * hexadecimal characters.
 *
 * Base64url uses the RFC 4648 section 5 alphabet without padding. Raw-byte
 * encoders are pure. Strict text encoding rejects malformed UTF-16, and byte
 * decoders report malformed wire input through `Either.Left`.
 *
 * @see {@link blake3Hash}
 * @see {@link sha256}
 * @see {@link Digest256}
 *
 * @since 0.1.0
 * @category encoding
 * @module
 */

import { Effect, type Either, Encoding, Option } from "effect"

import { encodeUtf8Unchecked, unicodeFault } from "./internal/unicode.js"
import type { InvalidUnicode } from "./schemas/errors.js"

/**
 * Encodes well-formed Unicode text as UTF-8 without normalization or replacement.
 *
 * @remarks
 * Malformed UTF-16 fails with the offending code-unit index relative to the
 * input text. Valid text is preserved exactly without Unicode normalization.
 *
 * @param text - Text to encode without normalization or replacement.
 * @returns UTF-8 bytes, or `InvalidUnicode` at the first unpaired surrogate.
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
 * Encodes bytes with the RFC 4648 section 5 alphabet and omits padding.
 *
 * @param bytes - Bytes to encode.
 * @returns The unpadded base64url representation.
 *
 * @since 0.1.0
 * @category encoding
 */
export const toBase64Url = (bytes: Uint8Array): string => Encoding.encodeBase64Url(bytes)

/**
 * Decodes an unpadded RFC 4648 section 5 representation.
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
 * Encodes each byte as two lowercase hexadecimal characters.
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
