/**
 * RFC 8785 JCS canonicalization contract tests.
 *
 * ### Key sorting (RFC 8785 §3.2.2)
 * - Lexicographic by UTF-16 code units
 * - Recursive sorting of nested objects
 * - Unicode key ordering
 *
 * ### Value handling
 * - null preserved as literal
 * - Array order preserved (not sorted)
 * - Empty object/array edge cases
 * - Boolean values
 *
 * ### Number serialization (RFC 8785 §3.2.2.3)
 * - ES2015 canonical representation
 * - Integer, fractional, negative, zero
 *
 * ### Rejection of non-JSON-safe values
 * - undefined → UnsupportedValue
 * - function → UnsupportedValue
 * - Symbol → UnsupportedValue
 */

import { describe, expect, it } from "@effect/vitest"
import * as CanonicalJson from "@scenesystems/digest/CanonicalJson"
import * as Utf8 from "@scenesystems/digest/Utf8"
import { Effect, Exit, Number as N, String as Str } from "effect"
import { oracleUtf8 } from "../helpers/bytes.js"
import { keySortingVectors, numberVectors, valueTypeVectors } from "../helpers/vectors/canonicalJson.js"

describe("CanonicalJson.encode — RFC 8785 key sorting", () => {
  it.effect("sorts object keys lexicographically by UTF-16 code units", () =>
    Effect.gen(function*() {
      const result = yield* CanonicalJson.encode(keySortingVectors.reverseKeys.input)
      expect(result).toBe(keySortingVectors.reverseKeys.expected)
    }))

  it.effect("sorts multiple keys", () =>
    Effect.gen(function*() {
      const result = yield* CanonicalJson.encode(keySortingVectors.multiKey.input)
      expect(result).toBe(keySortingVectors.multiKey.expected)
    }))

  it.effect("handles nested objects with recursive sorting", () =>
    Effect.gen(function*() {
      const result = yield* CanonicalJson.encode(keySortingVectors.nested.input)
      expect(result).toBe(keySortingVectors.nested.expected)
    }))

  it.effect("sorts unicode keys by UTF-16 code units", () =>
    Effect.gen(function*() {
      const result = yield* CanonicalJson.encode(keySortingVectors.unicodeKeys.input)
      expect(result).toBe(keySortingVectors.unicodeKeys.expected)
    }))
})

describe("CanonicalJson.encode — value types", () => {
  it.effect("preserves null as literal", () =>
    Effect.gen(function*() {
      const result = yield* CanonicalJson.encode(valueTypeVectors.nullValue.input)
      expect(result).toBe(valueTypeVectors.nullValue.expected)
    }))

  it.effect("empty object serializes to '{}'", () =>
    Effect.gen(function*() {
      const result = yield* CanonicalJson.encode(valueTypeVectors.emptyObject.input)
      expect(result).toBe(valueTypeVectors.emptyObject.expected)
    }))

  it.effect("empty array serializes to '[]'", () =>
    Effect.gen(function*() {
      const result = yield* CanonicalJson.encode(valueTypeVectors.emptyArray.input)
      expect(result).toBe(valueTypeVectors.emptyArray.expected)
    }))

  it.effect("preserves array element order (not sorted)", () =>
    Effect.gen(function*() {
      const result = yield* CanonicalJson.encode(valueTypeVectors.arrayOrder.input)
      expect(result).toBe(valueTypeVectors.arrayOrder.expected)
    }))

  it.effect("handles boolean values", () =>
    Effect.gen(function*() {
      const result = yield* CanonicalJson.encode(valueTypeVectors.booleans.input)
      expect(result).toBe(valueTypeVectors.booleans.expected)
    }))

  it.effect("handles string values", () =>
    Effect.gen(function*() {
      const result = yield* CanonicalJson.encode(valueTypeVectors.stringValue.input)
      expect(result).toBe(valueTypeVectors.stringValue.expected)
    }))
})

describe("CanonicalJson.encode — ES2015 number serialization", () => {
  it.effect("integer — no decimal point", () =>
    Effect.gen(function*() {
      const result = yield* CanonicalJson.encode(numberVectors.integer.input)
      expect(result).toBe(numberVectors.integer.expected)
    }))

  it.effect("negative integer", () =>
    Effect.gen(function*() {
      const result = yield* CanonicalJson.encode(numberVectors.negativeInteger.input)
      expect(result).toBe(numberVectors.negativeInteger.expected)
    }))

  it.effect("zero", () =>
    Effect.gen(function*() {
      const result = yield* CanonicalJson.encode(numberVectors.zero.input)
      expect(result).toBe(numberVectors.zero.expected)
    }))

  it.effect("fractional — shortest representation", () =>
    Effect.gen(function*() {
      const result = yield* CanonicalJson.encode(numberVectors.fractional.input)
      expect(result).toBe(numberVectors.fractional.expected)
    }))
})

describe("CanonicalJson.encode — rejection of non-JSON-safe values", () => {
  it.effect("rejects undefined with UnsupportedValue", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(CanonicalJson.encode({ key: undefined }))
      expect(exit).toStrictEqual(
        Exit.fail(new CanonicalJson.UnsupportedValue({ reason: "undefined" }))
      )
    }))

  it.effect("rejects function with UnsupportedValue", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(CanonicalJson.encode({ key: () => 1 }))
      expect(exit).toStrictEqual(
        Exit.fail(new CanonicalJson.UnsupportedValue({ reason: "function" }))
      )
    }))

  it.effect("rejects Symbol with UnsupportedValue", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(CanonicalJson.encode({ key: Symbol("test") }))
      expect(exit).toStrictEqual(
        Exit.fail(new CanonicalJson.UnsupportedValue({ reason: "symbol" }))
      )
    }))
})

describe("CanonicalJson.encodeBytes", () => {
  it.effect("keeps an astral scalar intact across the canonical byte segment boundary", () =>
    Effect.gen(function*() {
      const value = Str.concat(Str.repeat(N.subtract(N.multiply(32, 1024), 2))("a"), "😀")
      const canonical = yield* CanonicalJson.encode(value)
      const bytes = yield* CanonicalJson.encodeBytes(value)

      expect(bytes).toStrictEqual(yield* oracleUtf8(canonical))
    }))

  it.effect("matches canonical text followed by strict UTF-8 encoding", () =>
    Effect.gen(function*() {
      const value = { z: "😀", a: 1 }
      const canonical = yield* CanonicalJson.encode(value)
      const expected = yield* Utf8.encode(canonical)

      expect(yield* CanonicalJson.encodeBytes(value)).toStrictEqual(expected)
    }))

  it.effect("is deterministic and invariant to record insertion order", () =>
    Effect.gen(function*() {
      const first = yield* CanonicalJson.encodeBytes({ a: 1, b: 2 })
      const second = yield* CanonicalJson.encodeBytes({ b: 2, a: 1 })
      expect(second).toStrictEqual(first)
    }))
})
