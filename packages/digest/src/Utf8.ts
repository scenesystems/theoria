/**
 * Strict UTF-8 encoding and Unicode scalar construction, without normalization
 * or replacement of malformed UTF-16. Byte-to-text decoding belongs to Effect.
 *
 * @since 0.7.0
 * @module
 */

import { Either, Number as N, Option, type ParseResult, Predicate, Schema } from "effect"

import { encodeUtf8Unchecked, unicodeFault } from "./internal/unicode.js"

/**
 * The first unpaired surrogate, with a zero-based UTF-16 code-unit index.
 * Diagnostics never retain rejected text. Stream indices are absolute in the
 * logical concatenation; canonical JSON indices are relative to the faulty key
 * or string value. The wire tag is stable.
 *
 * @since 0.7.0
 * @category errors
 */
export class InvalidUnicode extends Schema.TaggedError<InvalidUnicode>()(
  "InvalidUnicode",
  {
    kind: Schema.Literal("lone-high-surrogate", "lone-low-surrogate"),
    codeUnitIndex: Schema.NonNegativeInt
  },
  { identifier: "@scenesystems/digest/Utf8/InvalidUnicode" }
) {}

/**
 * An integral Unicode scalar in U+0000..U+10FFFF excluding surrogates.
 * Controls, unassigned code points, and noncharacters are valid; restrictions
 * imposed by protocols such as XML belong to those protocols.
 *
 * @since 0.7.0
 * @category models
 */
export const Scalar = Schema.Int.pipe(
  Schema.between(0, 0x10ffff),
  Schema.filter(Predicate.not(N.between({ minimum: 0xd800, maximum: 0xdfff }))),
  Schema.brand("@scenesystems/digest/Utf8/Scalar")
).annotations({ identifier: "@scenesystems/digest/Utf8/Scalar" })

/**
 * A validated Unicode scalar, encoded as a number.
 * @since 0.7.0
 * @category models
 */
export type Scalar = typeof Scalar.Type

/**
 * Validates a numeric scalar and constructs exactly that character.
 * U+FEFF is text, not a byte-order signature. Supplementary scalars occupy two
 * UTF-16 code units. No truncation, coercion, or normalization occurs.
 *
 * @since 0.7.0
 * @category constructors
 */
export const fromScalar = (value: number): Either.Either<string, ParseResult.ParseError> =>
  Either.map(Schema.decodeUnknownEither(Scalar)(value), (scalar) => String.fromCodePoint(scalar))

/**
 * Encodes well-formed text exactly, including a leading U+FEFF. Returns the
 * first malformed surrogate as a typed failure instead of replacing it.
 *
 * @since 0.7.0
 * @category encoding
 */
export const encode = (text: string): Either.Either<Uint8Array, InvalidUnicode> =>
  Option.match(unicodeFault(text), {
    onNone: () => Either.right(encodeUtf8Unchecked(text)),
    onSome: Either.left
  })
