/** Generated laws supplement independent RFC 8785 known-answer vectors. */

import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as B, Effect, Record, Schema, String as Str, Tuple } from "effect"

import * as CanonicalJson from "@scenesystems/digest/CanonicalJson"

const wellFormedString = Schema.String.check(Schema.isPattern(/^(?:[^\uD800-\uDFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF])*$/))
const admittedValue: Schema.Schema<Schema.Json> = Schema.suspend(() =>
  Schema.Union([
    Schema.Null,
    Schema.Boolean,
    Schema.Finite,
    wellFormedString,
    Schema.Array(admittedValue),
    Schema.Record(wellFormedString, admittedValue)
  ])
)
const distinctKeys = Schema.Array(wellFormedString).check(Schema.isUnique())
const admittedRecord = Schema.Record(wellFormedString, admittedValue)
const distinctIntegers = Schema.Array(Schema.Int).check(Schema.isMinLength(2), Schema.isUnique())
const JsonString = Schema.fromJsonString(Schema.String)
const JsonUnknown = Schema.fromJsonString(Schema.Unknown)

describe("CanonicalJson.encode — generated data laws", () => {
  it.effect.prop(
    "spells 200,000 seeded finite numbers exactly like the Schema JSON encoder",
    [Schema.Array(Schema.Finite).check(Schema.isMinLength(1_000), Schema.isMaxLength(1_000))],
    ([value]) =>
      Effect.gen(function*() {
        expect(yield* CanonicalJson.encode(value)).toBe(yield* Schema.encodeEffect(JsonUnknown)(value))
      }),
    { arbitrary: { runs: 200, seed: 8785 } }
  )

  it.effect.prop(
    "escapes generated strings and keys exactly like the Schema JSON encoder",
    [wellFormedString],
    ([value]) =>
      Effect.gen(function*() {
        // Force every control and both punctuation escapes into each generated
        // case; arbitrary Unicode alone rarely exercises the escape path.
        const controls = Str.concat(
          "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f",
          "\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f\"\\"
        )
        const text = Str.concat(Str.concat(value, controls), Str.concat("😀", value))
        const quoted = yield* Schema.encodeEffect(JsonString)(text)
        expect(yield* CanonicalJson.encode(text)).toBe(quoted)
        expect(yield* CanonicalJson.encode(Record.singleton(text, text)))
          .toBe(Arr.join(["{", quoted, ":", quoted, "}"], ""))
      }),
    { arbitrary: { runs: 500, seed: 8785 } }
  )

  it.effect.prop("is invariant to record insertion order", [admittedRecord], ([record]) =>
    Effect.gen(function*() {
      const entries = Record.toEntries(record)
      const forward = yield* CanonicalJson.encode(Record.fromEntries(entries))
      const reverse = yield* CanonicalJson.encode(Record.fromEntries(Arr.reverse(entries)))
      expect(reverse).toBe(forward)
    }), { arbitrary: { runs: 200, seed: 8785 } })

  it.effect.prop(
    "sorts generated object keys by UTF-16 code units",
    [distinctKeys],
    ([keys]) =>
      Effect.gen(function*() {
        const encodedKeys = yield* Effect.forEach(Arr.sort(keys, Str.Order), (key) =>
          Schema.encodeEffect(JsonString)(key))
        const expected = Str.concat(Str.concat("{", Arr.join(Arr.map(encodedKeys, Str.concat(":null")), ",")), "}")
        expect(
          yield* CanonicalJson.encode(Record.fromEntries(Arr.map(keys, (key) =>
            Tuple.make(key, null))))
        ).toBe(
          expected
        )
      }),
    { arbitrary: { runs: 200, seed: 8785 } }
  )

  it.effect.prop(
    "preserves JSON values and is idempotent after decoding",
    [admittedValue],
    ([value]) =>
      Effect.gen(function*() {
        const first = yield* CanonicalJson.encode(value)
        const decoded = yield* Schema.decodeEffect(JsonUnknown)(first)
        const sourceJson = yield* Schema.encodeEffect(JsonUnknown)(value)
        const expectedValue = yield* Schema.decodeEffect(JsonUnknown)(sourceJson)
        expect(decoded).toStrictEqual(expectedValue)
        expect(yield* CanonicalJson.encode(decoded)).toBe(first)
      }),
    { arbitrary: { runs: 200, seed: 8785 } }
  )

  it.effect.prop("preserves significant array order", [distinctIntegers], ([values]) =>
    Effect.gen(function*() {
      const forward = yield* CanonicalJson.encode(values)
      const reverse = yield* CanonicalJson.encode(Arr.reverse(values))
      expect(reverse).not.toBe(forward)
    }), { arbitrary: { runs: 200, seed: 8785 } })

  it.effect.prop(
    "does not retain malformed values or keys in diagnostics",
    [Schema.String, Schema.Boolean],
    ([token, injectHigh]) =>
      Effect.gen(function*() {
        const secret = Str.concat(Str.concat("SECRET_", token), "_END")
        const malformed = Str.concat(secret, B.match(injectHigh, { onTrue: () => "\ud800", onFalse: () => "\udc00" }))
        yield* Effect.forEach(Arr.make(malformed, Record.singleton(malformed, true)), (input) =>
          Effect.gen(function*() {
            const error = yield* Effect.flip(CanonicalJson.encode(input))
            const diagnostic = yield* Schema.encodeEffect(Schema.fromJsonString(CanonicalJson.Error))(error)
            expect(diagnostic).not.toContain(secret)
            expect(Str.length(diagnostic)).toBeLessThanOrEqual(128)
          }))
      }),
    { arbitrary: { runs: 100, seed: 8785 } }
  )
})
