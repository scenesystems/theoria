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

import {
  Array as Arr,
  Boolean as B,
  Effect,
  type Either,
  Encoding,
  Match,
  Number as N,
  Option,
  type ParseResult,
  Predicate,
  Schema,
  Stream,
  String as Str
} from "effect"

import { encodeUtf8Unchecked, unicodeFault } from "./internal/unicode.js"
import type { InvalidUnicode } from "./schemas/errors.js"

/**
 * An integral Unicode scalar from U+0000 through U+10FFFF, excluding surrogates.
 * Controls, unassigned code points, and noncharacters are valid scalars; protocol
 * restrictions such as XML character admission are separate refinements.
 *
 * @since 0.6.0
 * @category schemas
 */
export const UnicodeScalar = Schema.Int.pipe(
  Schema.between(0, 0x10ffff),
  Schema.filter(Predicate.not(N.between({ minimum: 0xd800, maximum: 0xdfff }))),
  Schema.brand("UnicodeScalar")
)

/**
 * A validated Unicode scalar with its numeric encoded representation.
 * @since 0.6.0
 * @category schemas
 */
export type UnicodeScalar = typeof UnicodeScalar.Type

// RFC 3629 §3: split the admitted scalar into six-bit groups, then prefix
// the shortest one-, two-, three-, or four-octet form. All divisors are fixed,
// positive powers of two, and every intermediate is an exactly represented int.
const scalarBytes = (scalar: UnicodeScalar) => {
  const highBits = (divisor: number) => N.unsafeDivide(N.subtract(scalar, N.remainder(scalar, divisor)), divisor)
  const continuation = (divisor: number) => N.sum(0x80, N.remainder(highBits(divisor), 64))
  return Match.value(scalar).pipe(
    Match.when(N.lessThanOrEqualTo(0x7f), () => Arr.of(scalar)),
    Match.when(N.lessThanOrEqualTo(0x7ff), () => Arr.make(N.sum(0xc0, highBits(64)), continuation(1))),
    Match.when(
      N.lessThanOrEqualTo(0xffff),
      () => Arr.make(N.sum(0xe0, highBits(4096)), continuation(64), continuation(1))
    ),
    Match.orElse(() => Arr.make(N.sum(0xf0, highBits(262144)), continuation(4096), continuation(64), continuation(1)))
  )
}

/**
 * Constructs exactly one Unicode scalar as a string without normalization.
 *
 * Schema validates the number before construction; invalid values fail with
 * `ParseError`. Effect decodes the scalar's RFC 3629 UTF-8 representation.
 * U+FEFF is preserved as text, not consumed as a byte-order signature. A
 * supplementary scalar occupies two UTF-16 code units in the returned string.
 * This operation does not parse entities or enforce XML's character grammar.
 *
 * @example
 * ```ts
 * import { fromUnicodeScalar } from "@scenesystems/digest"
 * const character = fromUnicodeScalar(0x1f600) // Effect succeeds with "😀"
 * ```
 *
 * @since 0.6.0
 * @category encoding
 */
export const fromUnicodeScalar = (value: number): Effect.Effect<string, ParseResult.ParseError> =>
  Effect.flatMap(Schema.decodeUnknown(UnicodeScalar)(value), (scalar) =>
    B.match(N.Equivalence(scalar, 0xfeff), {
      // Stream.decodeText consumes an initial BOM. Here the input is one scalar,
      // never a stream signature, so its text identity must survive construction.
      onTrue: () => Effect.succeed("\ufeff"),
      onFalse: () =>
        Schema.decode(Schema.Uint8Array)(scalarBytes(scalar)).pipe(
          Effect.flatMap((bytes) => Stream.make(bytes).pipe(Stream.decodeText(), Stream.runFold("", Str.concat)))
        )
    }))

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
