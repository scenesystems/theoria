import { describe, expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Effect,
  FastCheck as fc,
  Number as N,
  Option,
  ParseResult,
  Schema,
  String as Str,
  Tuple
} from "effect"
import { encodeUtf8, fromUnicodeScalar, toHex, UnicodeScalar } from "../src/index.js"

const scalar = fc.oneof(
  fc.integer({ min: 0, max: 0xd7ff }),
  fc.integer({ min: 0xe000, max: 0x10ffff })
)

describe("Unicode scalar construction", () => {
  it.effect("constructs exact RFC 3629 boundary and asymmetric scalars without normalization", () =>
    Effect.forEach(
      Arr.make(
        { value: 0, text: "\u0000", hex: "00" },
        { value: 0x7f, text: "\u007f", hex: "7f" },
        { value: 0x80, text: "\u0080", hex: "c280" },
        { value: 0x301, text: "\u0301", hex: "cc81" },
        { value: 0x7ff, text: "\u07ff", hex: "dfbf" },
        { value: 0x800, text: "\u0800", hex: "e0a080" },
        { value: 0x2262, text: "\u2262", hex: "e289a2" },
        { value: 0xd7ff, text: "\ud7ff", hex: "ed9fbf" },
        { value: 0xe000, text: "\ue000", hex: "ee8080" },
        { value: 0xfeff, text: "\ufeff", hex: "efbbbf" },
        { value: 0xffff, text: "\uffff", hex: "efbfbf" },
        { value: 0x10000, text: "\u{10000}", hex: "f0908080" },
        { value: 0x233b4, text: "\u{233b4}", hex: "f0a38eb4" },
        { value: 0x10ffff, text: "\u{10ffff}", hex: "f48fbfbf" }
      ),
      (vector) =>
        Effect.gen(function*() {
          const text = yield* fromUnicodeScalar(vector.value)
          expect(text).toBe(vector.text)
          expect(toHex(yield* encodeUtf8(text))).toBe(vector.hex)
        })
    ))

  it.effect("rejects surrogate code points, non-integers, non-finite numbers, and out-of-range input", () =>
    Effect.forEach(
      Arr.make(-1, 0.5, 0xd800, 0xdbff, 0xdc00, 0xdfff, 0x110000, N.unsafeDivide(0, 0), N.unsafeDivide(1, 0)),
      (value) =>
        Effect.gen(function*() {
          expect(yield* Effect.flip(fromUnicodeScalar(value))).toBeInstanceOf(ParseResult.ParseError)
          expect(yield* Effect.flip(Schema.decodeUnknown(UnicodeScalar)(value))).toBeInstanceOf(ParseResult.ParseError)
        })
    ))

  it.effect("keeps the scalar schema numeric rather than coercing encoded text", () =>
    Effect.gen(function*() {
      expect(yield* Effect.flip(Schema.decodeUnknown(UnicodeScalar)("65"))).toBeInstanceOf(ParseResult.ParseError)
      const value = yield* Schema.decodeUnknown(UnicodeScalar)(0x233b4)
      expect(yield* Schema.encode(UnicodeScalar)(value)).toBe(0x233b4)
    }))

  it.effect.prop(
    "constructs exactly one scalar with the original numeric identity",
    Tuple.make(scalar),
    ([value]) =>
      Effect.gen(function*() {
        const text = yield* fromUnicodeScalar(value)
        expect(Arr.length(Arr.fromIterable(text))).toBe(1)
        expect(Str.codePointAt(text, 0)).toEqual(Option.some(value))
      }),
    { fastCheck: { numRuns: 2000 } }
  )

  it.effect.prop(
    "rejects the entire surrogate interval",
    Tuple.make(fc.integer({ min: 0xd800, max: 0xdfff })),
    ([value]) =>
      Effect.gen(function*() {
        expect(yield* Effect.flip(fromUnicodeScalar(value))).toBeInstanceOf(ParseResult.ParseError)
      }),
    { fastCheck: { numRuns: 200 } }
  )

  it.effect("preserves U+FEFF on every execution, independently of surrounding text", () =>
    Effect.gen(function*() {
      const construct = fromUnicodeScalar(0xfeff)
      expect(yield* construct).toBe("\ufeff")
      expect(yield* construct).toBe("\ufeff")
      expect(Str.concat("x", yield* construct)).toBe("x\ufeff")
    }))
})
