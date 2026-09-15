import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Data, DateTime, Effect, Exit, Schema, Tuple } from "effect"

import { canonicalize, CyclicValue, InvalidUnicode, UnsupportedValue } from "../src/index.js"

const Rejections = Schema.Array(Schema.Tuple(Schema.String, Schema.Unknown, UnsupportedValue.fields.reason))
const unsupportedValues = Schema.decodeUnknownSync(Rejections)(Arr.make(
  Tuple.make("undefined", undefined, "undefined"),
  Tuple.make("NaN", NaN, "nan"),
  Tuple.make("positive infinity", Infinity, "non-finite-number"),
  Tuple.make("negative infinity", -Infinity, "non-finite-number"),
  Tuple.make("bigint", 1n, "bigint"),
  Tuple.make("function", () => 1, "function"),
  Tuple.make("symbol", Schema.decodeSync(Schema.Symbol)("value"), "symbol"),
  Tuple.make("Date", DateTime.toDateUtc(DateTime.unsafeMake("2026-01-01T00:00:00.000Z")), "date"),
  Tuple.make("RegExp", /value/u, "regexp"),
  Tuple.make("sparse array", Arr.allocate(2), "sparse-array"),
  Tuple.make("bytes", Schema.decodeSync(Schema.Uint8Array)(Arr.make(1)), "typed-array"),
  Tuple.make("Map", Schema.decodeSync(Schema.Map({ key: Schema.String, value: Schema.Number }))([["value", 1]]), "map"),
  Tuple.make("Set", Schema.decodeSync(Schema.Set(Schema.Number))(Arr.make(1)), "set")
))

describe("canonicalize — encoded data", () => {
  it.effect.each(unsupportedValues)("rejects unencoded %s", ([, value, reason]) =>
    Effect.gen(function*() {
      expect(yield* Effect.exit(canonicalize(value))).toStrictEqual(Exit.fail(new UnsupportedValue({ reason })))
    }))

  it.effect("canonicalizes Effect data records and arrays by their JSON fields", () =>
    Effect.gen(function*() {
      const value = Data.struct({ z: Data.array(Arr.make(3, 1)), a: true })
      expect(yield* canonicalize(value)).toBe("{\"a\":true,\"z\":[3,1]}")
    }))

  it.effect("keeps first child failure independent of record insertion order", () =>
    Effect.gen(function*() {
      const first = yield* Effect.exit(canonicalize({ z: undefined, a: NaN }))
      const second = yield* Effect.exit(canonicalize({ a: NaN, z: undefined }))
      const expected = Exit.fail(new UnsupportedValue({ reason: "nan" }))
      expect(first).toStrictEqual(expected)
      expect(second).toStrictEqual(expected)
    }))

  it.effect("rejects malformed nested values and keys with bounded diagnostics", () =>
    Effect.gen(function*() {
      expect(yield* Effect.exit(canonicalize({ nested: Arr.make("ok", "\ud800") }))).toStrictEqual(
        Exit.fail(new InvalidUnicode({ kind: "lone-high-surrogate", codeUnitIndex: 0 }))
      )
      expect(yield* Effect.exit(canonicalize({ ["a\udc00"]: true }))).toStrictEqual(
        Exit.fail(new InvalidUnicode({ kind: "lone-low-surrogate", codeUnitIndex: 1 }))
      )
    }))

  it.effect("preserves Unicode without normalization and sorts keys by UTF-16 code units", () =>
    Effect.gen(function*() {
      expect(yield* canonicalize("😀é é")).toBe("\"😀é é\"")
      expect(yield* canonicalize({ ["\ue000"]: "bmp", ["😀"]: "astral" })).toBe(
        "{\"😀\":\"astral\",\"\":\"bmp\"}"
      )
    }))

  it.effect("fails a cyclic graph with a payload-free error", () => {
    const cycle = {
      get self(): unknown {
        return cycle
      }
    }
    return Effect.gen(function*() {
      expect(yield* Effect.exit(canonicalize(cycle))).toStrictEqual(Exit.fail(new CyclicValue()))
    })
  })

  it.effect("admits both shared acyclic references and structurally equal siblings", () =>
    Effect.gen(function*() {
      const shared = Data.struct({ value: 1 })
      const expected = "{\"left\":{\"value\":1},\"right\":{\"value\":1}}"
      expect(yield* canonicalize({ left: shared, right: shared })).toBe(expected)
      expect(yield* canonicalize({ left: Data.struct({ value: 1 }), right: Data.struct({ value: 1 }) })).toBe(expected)
    }))
})
