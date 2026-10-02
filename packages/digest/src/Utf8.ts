/**
 * Strict UTF-8 encoding and Unicode scalar construction, without normalization
 * or replacement of malformed UTF-16. Byte-to-text decoding belongs to Effect.
 *
 * @since 0.7.0
 * @module
 */

import { Array, Boolean, Match, Number, Option, Predicate, Result, Schema } from "effect"
import { Base64 } from "effect/encoding"

import { encodeUtf8Unchecked, unicodeFault } from "./internal/utf8.js"

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
    kind: Schema.Literals(["lone-high-surrogate", "lone-low-surrogate"]),
    codeUnitIndex: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))
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
  Schema.check(Schema.isBetween({ minimum: 0, maximum: 0x10ffff })),
  Schema.check(Schema.makeFilter(Predicate.not(Number.between({ minimum: 0xd800, maximum: 0xdfff })))),
  Schema.brand("@scenesystems/digest/Utf8/Scalar")
).annotate({ identifier: "@scenesystems/digest/Utf8/Scalar" })

/**
 * A validated Unicode scalar, encoded as a number.
 * @since 0.7.0
 * @category models
 */
export type Scalar = typeof Scalar.Type

// RFC 3629 §3: split a validated scalar into six-bit groups and prefix the
// shortest UTF-8 form. Fixed power-of-two divisors keep every intermediate exact.
const scalarBytes = (scalar: Scalar) => {
  const highBits = (divisor: number) =>
    Number.divideUnsafe(Number.subtract(scalar, Number.remainder(scalar, divisor)), divisor)
  const continuation = (divisor: number) => Number.sum(0x80, Number.remainder(highBits(divisor), 64))
  return Match.value(scalar).pipe(
    Match.when(Number.isLessThanOrEqualTo(0x7f), () => Array.of(scalar)),
    Match.when(Number.isLessThanOrEqualTo(0x7ff), () => Array.make(Number.sum(0xc0, highBits(64)), continuation(1))),
    Match.when(
      Number.isLessThanOrEqualTo(0xffff),
      () => Array.make(Number.sum(0xe0, highBits(4096)), continuation(64), continuation(1))
    ),
    Match.orElse(() =>
      Array.make(Number.sum(0xf0, highBits(262144)), continuation(4096), continuation(64), continuation(1))
    )
  )
}

/**
 * Validates a numeric scalar and constructs exactly that character.
 * U+FEFF is text, not a byte-order signature. Supplementary scalars occupy two
 * UTF-16 code units. No truncation, coercion, or normalization occurs.
 *
 * @since 0.7.0
 * @category constructors
 */
export const fromScalar = (value: number): Result.Result<string, Schema.SchemaError> =>
  Result.flatMap(
    Schema.decodeResult(Scalar)(value),
    (scalar) =>
      Boolean.match(Number.Equivalence(scalar, 0xfeff), {
        // The text codec consumes an initial BOM; a scalar's text identity must survive.
        onTrue: () => Result.succeed("\ufeff"),
        onFalse: () =>
          Schema.decodeResult(Schema.Uint8Array)(Uint8Array.from(scalarBytes(scalar))).pipe(
            Result.map((bytes) => Result.getOrThrow(Base64.decodeString(Base64.encode(bytes))))
          )
      })
  )

/**
 * Encodes well-formed text exactly, including a leading U+FEFF. Returns the
 * first malformed surrogate as a typed failure instead of replacing it.
 *
 * @since 0.7.0
 * @category encoding
 */
export const encode = (text: string): Result.Result<Uint8Array, InvalidUnicode> =>
  Option.match(unicodeFault(text), {
    onNone: () => Result.succeed(encodeUtf8Unchecked(text)),
    onSome: Result.fail
  })
