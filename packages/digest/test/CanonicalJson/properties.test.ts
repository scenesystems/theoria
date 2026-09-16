/** Generated laws supplement independent RFC 8785 known-answer vectors. */

import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as B, Effect, FastCheck as fc, Record, Schema, String as Str, Tuple } from "effect"

import * as CanonicalJson from "../../src/CanonicalJson.js"

const wellFormedString = fc.fullUnicodeString({ maxLength: 64 })
const finiteNumber = fc.double({ noNaN: true, noDefaultInfinity: true })
const admittedValue = fc.anything({
  key: wellFormedString,
  values: [fc.constant(null), fc.boolean(), finiteNumber, wellFormedString],
  maxDepth: 5,
  maxKeys: 8,
  withNullPrototype: true
})
const distinctKeys = fc.uniqueArray(wellFormedString, { maxLength: 10 })
const distinctEntries = fc.uniqueArray(fc.tuple(wellFormedString, admittedValue), {
  selector: ([key]) => key,
  maxLength: 10
})
const distinctIntegers = fc.uniqueArray(fc.integer(), { minLength: 2, maxLength: 16 })
const JsonString = Schema.parseJson(Schema.String)
const JsonUnknown = Schema.parseJson(Schema.Unknown)

describe("canonicalize — generated data laws", () => {
  it.effect.prop("is invariant to record insertion order", [distinctEntries], ([entries]) =>
    Effect.gen(function*() {
      const forward = yield* CanonicalJson.encode(Record.fromEntries(entries))
      const reverse = yield* CanonicalJson.encode(Record.fromEntries(Arr.reverse(entries)))
      expect(reverse).toBe(forward)
    }), { fastCheck: { numRuns: 200, seed: 8785 } })

  it.effect.prop(
    "sorts generated object keys by UTF-16 code units",
    [distinctKeys],
    ([keys]) =>
      Effect.gen(function*() {
        const encodedKeys = yield* Effect.forEach(Arr.sort(keys, Str.Order), (key) => Schema.encode(JsonString)(key))
        const expected = Str.concat(Str.concat("{", Arr.join(Arr.map(encodedKeys, Str.concat(":null")), ",")), "}")
        expect(yield* CanonicalJson.encode(Record.fromEntries(Arr.map(keys, (key) => Tuple.make(key, null))))).toBe(
          expected
        )
      }),
    { fastCheck: { numRuns: 200, seed: 8785 } }
  )

  it.effect.prop(
    "preserves JSON values and is idempotent after decoding",
    [admittedValue],
    ([value]) =>
      Effect.gen(function*() {
        const first = yield* CanonicalJson.encode(value)
        const decoded = yield* Schema.decodeUnknown(JsonUnknown)(first)
        const sourceJson = yield* Schema.encode(JsonUnknown)(value)
        const expectedValue = yield* Schema.decodeUnknown(JsonUnknown)(sourceJson)
        expect(decoded).toStrictEqual(expectedValue)
        expect(yield* CanonicalJson.encode(decoded)).toBe(first)
      }),
    { fastCheck: { numRuns: 200, seed: 8785 } }
  )

  it.effect.prop("preserves significant array order", [distinctIntegers], ([values]) =>
    Effect.gen(function*() {
      const forward = yield* CanonicalJson.encode(values)
      const reverse = yield* CanonicalJson.encode(Arr.reverse(values))
      expect(reverse).not.toBe(forward)
    }), { fastCheck: { numRuns: 200, seed: 8785 } })

  it.effect.prop(
    "does not retain malformed values or keys in diagnostics",
    [fc.stringMatching(/^[A-Za-z0-9]{1,24}$/), fc.boolean()],
    ([token, injectHigh]) =>
      Effect.gen(function*() {
        const secret = Str.concat(Str.concat("SECRET_", token), "_END")
        const malformed = Str.concat(secret, B.match(injectHigh, { onTrue: () => "\ud800", onFalse: () => "\udc00" }))
        yield* Effect.forEach(Arr.make(malformed, Record.singleton(malformed, true)), (input) =>
          Effect.gen(function*() {
            const error = yield* Effect.flip(CanonicalJson.encode(input))
            const diagnostic = yield* Schema.encode(Schema.parseJson(CanonicalJson.Error))(error)
            expect(diagnostic).not.toContain(secret)
            expect(Str.length(diagnostic)).toBeLessThanOrEqual(128)
          }))
      }),
    { fastCheck: { numRuns: 100, seed: 8785 } }
  )
})
