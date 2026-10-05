import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Data, DateTime, Effect, Equal, Exit, Hash, MutableRef, Number as N, Schema, Tuple } from "effect"
import * as fc from "fast-check"

import * as CanonicalJson from "@scenesystems/digest/CanonicalJson"
import * as Utf8 from "@scenesystems/digest/Utf8"

const Rejections = Schema.Array(
  Schema.Tuple([Schema.String, Schema.Unknown, CanonicalJson.UnsupportedValue.fields.reason])
)
const unsupportedValues = Schema.decodeSync(Rejections)(Arr.make(
  Tuple.make("undefined", undefined, "undefined"),
  Tuple.make("NaN", NaN, "nan"),
  Tuple.make("positive infinity", Infinity, "non-finite-number"),
  Tuple.make("negative infinity", -Infinity, "non-finite-number"),
  Tuple.make("bigint", 1n, "bigint"),
  Tuple.make("function", () => 1, "function"),
  Tuple.make("symbol", Schema.decodeSync(Schema.Symbol)(Symbol.for("value")), "symbol"),
  Tuple.make("Date", DateTime.toDateUtc(DateTime.makeUnsafe("2026-01-01T00:00:00.000Z")), "date"),
  Tuple.make("RegExp", /value/u, "regexp"),
  Tuple.make("sparse array", Arr.allocate(2), "sparse-array"),
  Tuple.make("bytes", Schema.decodeSync(Schema.Uint8Array)(Uint8Array.of(1)), "typed-array"),
  Tuple.make(
    "Map",
    Schema.decodeSync(Schema.toCodecIso(Schema.ReadonlyMap(Schema.String, Schema.Finite)))([["value", 1]]),
    "map"
  ),
  Tuple.make("Set", Schema.decodeSync(Schema.toCodecIso(Schema.ReadonlySet(Schema.Finite)))(Arr.make(1)), "set")
))

class DataRecord extends Data.Class<{ readonly value: unknown }> {}
class CompositeData extends Data.Class<{ readonly z: ReadonlyArray<number>; readonly a: boolean }> {}

const views: ReadonlyArray<readonly [string, fc.Arbitrary<ArrayBufferView>]> = Arr.make(
  Tuple.make("Int8Array", fc.int8Array({ maxLength: 8 })),
  Tuple.make("Uint8Array", fc.uint8Array({ maxLength: 8 })),
  Tuple.make("Uint8ClampedArray", fc.uint8ClampedArray({ maxLength: 8 })),
  Tuple.make("Int16Array", fc.int16Array({ maxLength: 8 })),
  Tuple.make("Uint16Array", fc.uint16Array({ maxLength: 8 })),
  Tuple.make("Int32Array", fc.int32Array({ maxLength: 8 })),
  Tuple.make("Uint32Array", fc.uint32Array({ maxLength: 8 })),
  Tuple.make("Float32Array", fc.float32Array({ maxLength: 8 })),
  Tuple.make("Float64Array", fc.float64Array({ maxLength: 8 })),
  Tuple.make("BigInt64Array", fc.bigInt64Array({ maxLength: 8 })),
  Tuple.make("BigUint64Array", fc.bigUint64Array({ maxLength: 8 })),
  Tuple.make("DataView", fc.uint8Array({ maxLength: 8 }).map((bytes) => new DataView(bytes.buffer)))
)

describe("CanonicalJson.encode — admission", () => {
  it.effect("rejects inherited array indices without reading their getters", () =>
    Effect.gen(function*() {
      const reads = MutableRef.make(0)
      class InheritedIndex extends Array<number> {
        get 0() {
          MutableRef.update(reads, N.increment)
          return 7
        }
      }
      const value = new InheritedIndex(1)
      const expected = Exit.fail(new CanonicalJson.UnsupportedValue({ reason: "sparse-array" }))
      expect(yield* Effect.exit(CanonicalJson.encode(value))).toStrictEqual(expected)
      expect(yield* Effect.exit(CanonicalJson.encode({ nested: value }))).toStrictEqual(expected)
      expect(MutableRef.get(reads)).toBe(0)
      expect(yield* CanonicalJson.encode(Arr.make(7))).toBe("[7]")
      expect(yield* Effect.exit(CanonicalJson.encode(Arr.make(undefined)))).toStrictEqual(
        Exit.fail(new CanonicalJson.UnsupportedValue({ reason: "undefined" }))
      )
      expect(yield* CanonicalJson.encode(Arr.empty())).toBe("[]")
    }))

  it.effect.each(views)(
    "rejects generated %s before inspecting elements",
    ([, arbitrary]) =>
      Effect.forEach(fc.sample(arbitrary, { seed: 8785, numRuns: 30 }), (value) =>
        Effect.gen(function*() {
          expect(yield* Effect.exit(CanonicalJson.encode(value))).toStrictEqual(
            Exit.fail(new CanonicalJson.UnsupportedValue({ reason: "typed-array" }))
          )
          expect(yield* Effect.exit(CanonicalJson.encode({ nested: value }))).toStrictEqual(
            Exit.fail(new CanonicalJson.UnsupportedValue({ reason: "typed-array" }))
          )
        }))
  )

  it.effect("classifies views without consulting a spoofed or hostile toStringTag", () =>
    Effect.gen(function*() {
      const reads = MutableRef.make(0)
      class HostileView extends DataView<ArrayBuffer> {
        override get [Symbol.toStringTag]() {
          MutableRef.update(reads, N.increment)
          return "Object"
        }
      }
      const view = new HostileView(Uint8Array.of(1).buffer)
      expect(yield* Effect.exit(CanonicalJson.encode(view))).toStrictEqual(
        Exit.fail(new CanonicalJson.UnsupportedValue({ reason: "typed-array" }))
      )
      const record = {
        value: 1,
        get [Symbol.toStringTag]() {
          MutableRef.update(reads, N.increment)
          return "Uint8Array"
        }
      }
      expect(yield* CanonicalJson.encode(record)).toBe("{\"value\":1}")
      expect(MutableRef.get(reads)).toBe(0)
    }))

  it.effect("never reads hostile Hash or Equal hooks, even on distinct ancestor objects", () =>
    Effect.gen(function*() {
      const reads = MutableRef.make(0)
      const hooks = {
        get [Hash.symbol]() {
          MutableRef.update(reads, N.increment)
          return () => 0
        },
        get [Equal.symbol]() {
          MutableRef.update(reads, N.increment)
          return () => true
        }
      }
      class Hostile extends Data.Class<{ readonly child: unknown }> {
        get [Hash.symbol]() {
          return hooks[Hash.symbol]
        }
        get [Equal.symbol]() {
          return hooks[Equal.symbol]
        }
      }
      expect(yield* CanonicalJson.encode(new Hostile({ child: new Hostile({ child: 1 }) })))
        .toBe("{\"child\":{\"child\":1}}")
      const cycle = {
        get child(): unknown {
          return cycle
        },
        get [Hash.symbol]() {
          return hooks[Hash.symbol]
        },
        get [Equal.symbol]() {
          return hooks[Equal.symbol]
        }
      }
      expect(yield* Effect.exit(CanonicalJson.encode(cycle))).toStrictEqual(Exit.fail(new CanonicalJson.CyclicValue()))
      expect(MutableRef.get(reads)).toBe(0)
    }))

  it.effect.each(unsupportedValues)("rejects unencoded %s", ([, value, reason]) =>
    Effect.gen(function*() {
      expect(yield* Effect.exit(CanonicalJson.encode(value))).toStrictEqual(
        Exit.fail(new CanonicalJson.UnsupportedValue({ reason }))
      )
    }))

  it.effect("canonicalizes Effect data records and arrays by their JSON fields", () =>
    Effect.gen(function*() {
      const value = new CompositeData({ z: Arr.make(3, 1), a: true })
      expect(yield* CanonicalJson.encode(value)).toBe("{\"a\":true,\"z\":[3,1]}")
    }))

  it.effect("keeps first child failure independent of record insertion order", () =>
    Effect.gen(function*() {
      const first = yield* Effect.exit(CanonicalJson.encode({ z: undefined, a: NaN }))
      const second = yield* Effect.exit(CanonicalJson.encode({ a: NaN, z: undefined }))
      const expected = Exit.fail(new CanonicalJson.UnsupportedValue({ reason: "nan" }))
      expect(first).toStrictEqual(expected)
      expect(second).toStrictEqual(expected)
    }))

  it.effect("reads JSON-visible fields once in canonical order and stops on the first failure", () =>
    Effect.gen(function*() {
      const reads = MutableRef.make(Arr.empty<string>())
      const value = {
        get z(): number {
          MutableRef.update(reads, Arr.append("z"))
          return 2
        },
        get a(): number {
          MutableRef.update(reads, Arr.append("a"))
          return 1
        }
      }
      expect(yield* CanonicalJson.encode(value)).toBe("{\"a\":1,\"z\":2}")
      expect(MutableRef.get(reads)).toStrictEqual(["a", "z"])
      MutableRef.set(reads, [])
      expect(
        yield* Effect.exit(CanonicalJson.encode({
          a: undefined,
          get z() {
            MutableRef.update(reads, Arr.append("z"))
            return 2
          }
        }))
      ).toStrictEqual(Exit.fail(new CanonicalJson.UnsupportedValue({ reason: "undefined" })))
      expect(MutableRef.get(reads)).toStrictEqual([])
    }))

  it.effect("rejects malformed nested values and keys with bounded diagnostics", () =>
    Effect.gen(function*() {
      expect(yield* Effect.exit(CanonicalJson.encode({ nested: Arr.make("ok", "\ud800") }))).toStrictEqual(
        Exit.fail(new Utf8.InvalidUnicode({ kind: "lone-high-surrogate", codeUnitIndex: 0 }))
      )
      expect(yield* Effect.exit(CanonicalJson.encode({ ["a\udc00"]: true }))).toStrictEqual(
        Exit.fail(new Utf8.InvalidUnicode({ kind: "lone-low-surrogate", codeUnitIndex: 1 }))
      )
    }))

  it.effect("preserves Unicode without normalization and sorts keys by UTF-16 code units", () =>
    Effect.gen(function*() {
      expect(yield* CanonicalJson.encode("😀é é")).toBe("\"😀é é\"")
      expect(yield* CanonicalJson.encode({ ["\ue000"]: "bmp", ["😀"]: "astral" })).toBe(
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
      expect(yield* Effect.exit(CanonicalJson.encode(cycle))).toStrictEqual(Exit.fail(new CanonicalJson.CyclicValue()))
    })
  })

  it.effect("admits both shared acyclic references and structurally equal siblings", () =>
    Effect.gen(function*() {
      const shared = new DataRecord({ value: 1 })
      const expected = "{\"left\":{\"value\":1},\"right\":{\"value\":1}}"
      expect(yield* CanonicalJson.encode({ left: shared, right: shared })).toBe(expected)
      expect(yield* CanonicalJson.encode({ left: new DataRecord({ value: 1 }), right: new DataRecord({ value: 1 }) }))
        .toBe(
          expected
        )
    }))
})
