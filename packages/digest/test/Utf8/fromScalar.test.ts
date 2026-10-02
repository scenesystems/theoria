import { describe, expect, it } from "@effect/vitest"
import * as Utf8 from "@scenesystems/digest/Utf8"
import { Array as Arr, Effect, Option, Result, Schema, String as Str, Tuple } from "effect"
import { Hex } from "effect/encoding"

const scalar = Schema.Union([
  Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 0xd7ff })),
  Schema.Int.check(Schema.isBetween({ minimum: 0xe000, maximum: 0x10ffff }))
])

describe("Utf8.fromScalar", () => {
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
        { value: 0xfefe, text: "\ufefe", hex: "efbbbe" },
        { value: 0xfeff, text: "\ufeff", hex: "efbbbf" },
        { value: 0xff00, text: "\uff00", hex: "efbc80" },
        { value: 0xffff, text: "\uffff", hex: "efbfbf" },
        { value: 0x10000, text: "\u{10000}", hex: "f0908080" },
        { value: 0x233b4, text: "\u{233b4}", hex: "f0a38eb4" },
        { value: 0x10ffff, text: "\u{10ffff}", hex: "f48fbfbf" }
      ),
      (vector) =>
        Effect.gen(function*() {
          const result = Utf8.fromScalar(vector.value)
          expect(result).toEqual(Result.succeed(vector.text))
          const text = yield* Effect.fromResult(result)
          expect(Hex.encode(yield* Effect.fromResult(Utf8.encode(text)))).toBe(vector.hex)
        })
    ))

  it.effect("rejects surrogate code points, non-integers, non-finite numbers, and out-of-range input", () =>
    Effect.forEach(
      Arr.make(-1, 0.5, 0xd800, 0xdbff, 0xdc00, 0xdfff, 0x110000, NaN, Infinity),
      (value) =>
        Effect.gen(function*() {
          expect(Result.getFailure(Utf8.fromScalar(value))).toEqual(Option.some(expect.any(Schema.SchemaError)))
          expect(yield* Effect.flip(Schema.decodeEffect(Utf8.Scalar)(value))).toBeInstanceOf(Schema.SchemaError)
        })
    ))

  it.effect("keeps the scalar schema numeric rather than coercing encoded text", () =>
    Effect.gen(function*() {
      expect(yield* Effect.flip(Schema.decodeUnknownEffect(Utf8.Scalar)("65"))).toBeInstanceOf(Schema.SchemaError)
      const value = yield* Schema.decodeEffect(Utf8.Scalar)(0x233b4)
      expect(yield* Schema.encodeEffect(Utf8.Scalar)(value)).toBe(0x233b4)
    }))

  it.effect.prop(
    "constructs exactly one scalar with the original numeric identity",
    Tuple.make(scalar),
    ([value]) =>
      Effect.gen(function*() {
        const text = yield* Effect.fromResult(Utf8.fromScalar(value))
        expect(Arr.length(Arr.fromIterable(text))).toBe(1)
        expect(Str.codePointAt(text, 0)).toEqual(Option.some(value))
      }),
    { arbitrary: { runs: 2000, seed: 3629 } }
  )

  it.effect.prop(
    "rejects the entire surrogate interval",
    Tuple.make(Schema.Int.check(Schema.isBetween({ minimum: 0xd800, maximum: 0xdfff }))),
    ([value]) =>
      Effect.gen(function*() {
        expect(yield* Effect.flip(Effect.fromResult(Utf8.fromScalar(value)))).toBeInstanceOf(Schema.SchemaError)
      }),
    { arbitrary: { runs: 200, seed: 3629 } }
  )

  it.effect("preserves U+FEFF on every execution, independently of surrounding text", () =>
    Effect.gen(function*() {
      const construct = Utf8.fromScalar(0xfeff)
      expect(yield* Effect.fromResult(construct)).toBe("\ufeff")
      expect(yield* Effect.fromResult(construct)).toBe("\ufeff")
      expect(Str.concat("x", yield* Effect.fromResult(construct))).toBe("x\ufeff")
    }))
})
