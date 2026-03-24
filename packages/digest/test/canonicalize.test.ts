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
 * - undefined → FingerprintUnsupportedValue
 * - function → FingerprintUnsupportedValue
 * - Symbol → FingerprintUnsupportedValue
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import { canonicalize } from "../src/canonicalize.js"
import { FingerprintUnsupportedValue } from "../src/schemas/errors.js"
import { keySortingVectors, numberVectors, valueTypeVectors } from "./helpers/vectors/jcs.vectors.js"

describe("canonicalize — RFC 8785 key sorting", () => {
  it.effect("sorts object keys lexicographically by UTF-16 code units", () =>
    Effect.gen(function*() {
      const result = yield* canonicalize(keySortingVectors.reverseKeys.input)
      expect(result).toBe(keySortingVectors.reverseKeys.expected)
    }))

  it.effect("sorts multiple keys", () =>
    Effect.gen(function*() {
      const result = yield* canonicalize(keySortingVectors.multiKey.input)
      expect(result).toBe(keySortingVectors.multiKey.expected)
    }))

  it.effect("handles nested objects with recursive sorting", () =>
    Effect.gen(function*() {
      const result = yield* canonicalize(keySortingVectors.nested.input)
      expect(result).toBe(keySortingVectors.nested.expected)
    }))

  it.effect("sorts unicode keys by UTF-16 code units", () =>
    Effect.gen(function*() {
      const result = yield* canonicalize(keySortingVectors.unicodeKeys.input)
      expect(result).toBe(keySortingVectors.unicodeKeys.expected)
    }))
})

describe("canonicalize — value types", () => {
  it.effect("preserves null as literal", () =>
    Effect.gen(function*() {
      const result = yield* canonicalize(valueTypeVectors.nullValue.input)
      expect(result).toBe(valueTypeVectors.nullValue.expected)
    }))

  it.effect("empty object serializes to '{}'", () =>
    Effect.gen(function*() {
      const result = yield* canonicalize(valueTypeVectors.emptyObject.input)
      expect(result).toBe(valueTypeVectors.emptyObject.expected)
    }))

  it.effect("empty array serializes to '[]'", () =>
    Effect.gen(function*() {
      const result = yield* canonicalize(valueTypeVectors.emptyArray.input)
      expect(result).toBe(valueTypeVectors.emptyArray.expected)
    }))

  it.effect("preserves array element order (not sorted)", () =>
    Effect.gen(function*() {
      const result = yield* canonicalize(valueTypeVectors.arrayOrder.input)
      expect(result).toBe(valueTypeVectors.arrayOrder.expected)
    }))

  it.effect("handles boolean values", () =>
    Effect.gen(function*() {
      const result = yield* canonicalize(valueTypeVectors.booleans.input)
      expect(result).toBe(valueTypeVectors.booleans.expected)
    }))

  it.effect("handles string values", () =>
    Effect.gen(function*() {
      const result = yield* canonicalize(valueTypeVectors.stringValue.input)
      expect(result).toBe(valueTypeVectors.stringValue.expected)
    }))
})

describe("canonicalize — ES2015 number serialization", () => {
  it.effect("integer — no decimal point", () =>
    Effect.gen(function*() {
      const result = yield* canonicalize(numberVectors.integer.input)
      expect(result).toBe(numberVectors.integer.expected)
    }))

  it.effect("negative integer", () =>
    Effect.gen(function*() {
      const result = yield* canonicalize(numberVectors.negativeInteger.input)
      expect(result).toBe(numberVectors.negativeInteger.expected)
    }))

  it.effect("zero", () =>
    Effect.gen(function*() {
      const result = yield* canonicalize(numberVectors.zero.input)
      expect(result).toBe(numberVectors.zero.expected)
    }))

  it.effect("fractional — shortest representation", () =>
    Effect.gen(function*() {
      const result = yield* canonicalize(numberVectors.fractional.input)
      expect(result).toBe(numberVectors.fractional.expected)
    }))
})

describe("canonicalize — rejection of non-JSON-safe values", () => {
  it.effect("rejects undefined with FingerprintUnsupportedValue", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(canonicalize({ key: undefined }))
      expect(exit).toStrictEqual(
        Exit.fail(
          new FingerprintUnsupportedValue({ valueType: "undefined", reason: "undefined is not representable in JSON" })
        )
      )
    }))

  it.effect("rejects function with FingerprintUnsupportedValue", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(canonicalize({ key: () => 1 }))
      expect(exit).toStrictEqual(
        Exit.fail(new FingerprintUnsupportedValue({ valueType: "function", reason: "functions are not serializable" }))
      )
    }))

  it.effect("rejects Symbol with FingerprintUnsupportedValue", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(canonicalize({ key: Symbol("test") }))
      expect(exit).toStrictEqual(
        Exit.fail(new FingerprintUnsupportedValue({ valueType: "symbol", reason: "symbols are not serializable" }))
      )
    }))
})
