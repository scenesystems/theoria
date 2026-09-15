import { describe, expect, it } from "@effect/vitest"
import * as Bytes from "@scenesystems/sign/Bytes"
import { Array as Arr, Effect, Schema, Tuple } from "effect"

describe("Bytes.fromString", () => {
  it.effect("preserves Unicode scalars, BOM, combining marks, and NUL without normalization", () =>
    Effect.gen(function*() {
      expect(yield* Schema.encode(Schema.Uint8Array)(Bytes.fromString("Aé🔑e\u0301\0"))).toEqual(
        Arr.make(0x41, 0xc3, 0xa9, 0xf0, 0x9f, 0x94, 0x91, 0x65, 0xcc, 0x81, 0x00)
      )
      expect(yield* Schema.encode(Schema.Uint8Array)(Bytes.fromString("\ufeffA"))).toEqual(
        Arr.make(0xef, 0xbb, 0xbf, 0x41)
      )
      expect(yield* Schema.encode(Schema.Uint8Array)(Bytes.fromString("🔑"))).toEqual(
        Arr.make(0xf0, 0x9f, 0x94, 0x91)
      )
      expect(yield* Schema.encode(Schema.Uint8Array)(Bytes.fromString(""))).toEqual(Arr.empty())
    }))

  it.effect("replaces lone UTF-16 surrogates and returns a fresh byte array", () =>
    Effect.gen(function*() {
      expect(yield* Schema.encode(Schema.Uint8Array)(Bytes.fromString("\ud800"))).toEqual(
        Arr.make(0xef, 0xbf, 0xbd)
      )
      expect(yield* Schema.encode(Schema.Uint8Array)(Bytes.fromString("\udc00"))).toEqual(
        Arr.make(0xef, 0xbf, 0xbd)
      )

      const first = Bytes.fromString("fresh")
      const second = Bytes.fromString("fresh")
      expect(first).not.toBe(second)
    }))
})

describe("Bytes.equal", () => {
  it.effect("compares contents and lengths in both directions, including empty and single-bit differences", () =>
    Effect.forEach(
      Arr.make(
        Tuple.make(Arr.make(1, 2, 3), Arr.make(1, 2, 3), true),
        Tuple.make(Arr.make(1, 2, 3), Arr.make(1, 2, 4), false),
        Tuple.make(Arr.make(1, 2, 3), Arr.make(0, 2, 3), false),
        Tuple.make(Arr.make(1, 2, 3), Arr.make(1, 2), false),
        Tuple.make(Arr.empty<number>(), Arr.empty<number>(), true),
        Tuple.make(Arr.empty<number>(), Arr.of(0), false),
        Tuple.make(Arr.of(0xff), Arr.of(0xfe), false)
      ),
      ([left, right, expected]) =>
        Effect.gen(function*() {
          const a = yield* Schema.decode(Schema.Uint8Array)(left)
          const b = yield* Schema.decode(Schema.Uint8Array)(right)
          expect(Bytes.equal(a, b)).toBe(expected)
          expect(Bytes.equal(b, a)).toBe(expected)
        })
    ))
})
