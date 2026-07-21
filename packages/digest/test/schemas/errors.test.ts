/**
 * Error model contract tests.
 *
 * ### InvalidKeyLength
 * - Yieldable in Effect.gen
 * - Catchable via Effect.catchTag
 * - Carries expected and actual fields
 *
 * ### CanonicalizationError
 * - InvalidUnicode, UnsupportedValue, and CyclicValue are closed Schema errors
 * - Every member is yieldable, catchable, and Schema-serializable
 * - Literal diagnostics and code-unit indices reject values outside the contract
 */

import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Exit, Schema } from "effect"
import {
  CanonicalizationError,
  CyclicValue,
  InvalidKeyLength,
  InvalidUnicode,
  UnsupportedValue
} from "../../src/schemas/errors.js"

const unsupportedReasons = [
  "undefined",
  "nan",
  "non-finite-number",
  "bigint",
  "function",
  "symbol",
  "date",
  "regexp",
  "typed-array",
  "map",
  "set",
  "weak-collection",
  "promise",
  "unsupported-prototype",
  "accessor-property",
  "symbol-property",
  "non-enumerable-property",
  "sparse-array",
  "array-extra-property",
  "reflection-failure"
]

describe("InvalidKeyLength — Schema.TaggedError", () => {
  it.effect("is yieldable in Effect.gen", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        Effect.gen(function*() {
          return yield* new InvalidKeyLength({ expected: 32, actual: 16 })
        })
      )
      expect(Exit.isFailure(exit)).toBe(true)
    }))

  it.effect("is catchable via Effect.catchTag", () =>
    Effect.gen(function*() {
      const result = yield* Effect.gen(function*() {
        return yield* new InvalidKeyLength({ expected: 32, actual: 16 })
      }).pipe(
        Effect.catchTag("InvalidKeyLength", (e) => Effect.succeed(`caught:${e.expected}:${e.actual}`))
      )
      expect(result).toBe("caught:32:16")
    }))

  it.effect("carries expected and actual fields", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        Effect.gen(function*() {
          return yield* new InvalidKeyLength({ expected: 32, actual: 64 })
        })
      )
      expect(exit).toStrictEqual(
        Exit.fail(new InvalidKeyLength({ expected: 32, actual: 64 }))
      )
    }))
})

describe("InvalidUnicode — Schema.TaggedError", () => {
  it.effect("is yieldable in Effect.gen", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        new InvalidUnicode({
          kind: "lone-high-surrogate",
          codeUnitIndex: 3
        })
      )
      expect(exit).toStrictEqual(Exit.fail(
        new InvalidUnicode({
          kind: "lone-high-surrogate",
          codeUnitIndex: 3
        })
      ))
    }))

  it.effect("is catchable via Effect.catchTag", () =>
    Effect.gen(function*() {
      const result = yield* new InvalidUnicode({
        kind: "lone-low-surrogate",
        codeUnitIndex: 5
      }).pipe(
        Effect.catchTag("InvalidUnicode", (error) => Effect.succeed(`${error.kind}:${error.codeUnitIndex}`))
      )
      expect(result).toBe("lone-low-surrogate:5")
    }))

  it.effect("round-trips only bounded fields through Schema", () =>
    Effect.gen(function*() {
      const error = new InvalidUnicode({ kind: "lone-high-surrogate", codeUnitIndex: 8 })
      const encoded = yield* Schema.encode(InvalidUnicode)(error)
      const decoded = yield* Schema.decodeUnknown(InvalidUnicode)(encoded)

      expect(encoded).toStrictEqual({
        _tag: "InvalidUnicode",
        kind: "lone-high-surrogate",
        codeUnitIndex: 8
      })
      expect(decoded.kind).toBe("lone-high-surrogate")
      expect(decoded.codeUnitIndex).toBe(8)
    }))

  it.effect("rejects foreign kinds and unsafe code-unit indices", () =>
    Effect.gen(function*() {
      const invalidInputs = [
        { _tag: "InvalidUnicode", kind: "mismatched-surrogate", codeUnitIndex: 0 },
        { _tag: "InvalidUnicode", kind: "lone-high-surrogate", codeUnitIndex: -1 },
        { _tag: "InvalidUnicode", kind: "lone-low-surrogate", codeUnitIndex: 0.5 },
        { _tag: "InvalidUnicode", kind: "lone-low-surrogate", codeUnitIndex: Number.MAX_SAFE_INTEGER + 1 }
      ]
      const exits = yield* Effect.forEach(invalidInputs, (input) =>
        Effect.exit(Schema.decodeUnknown(InvalidUnicode)(input)))

      expect(Arr.every(exits, Exit.isFailure)).toBe(true)
    }))
})

describe("UnsupportedValue — Schema.TaggedError", () => {
  it.effect("is yieldable and catchable via Effect.catchTag", () =>
    Effect.gen(function*() {
      const result = yield* new UnsupportedValue({ reason: "accessor-property" }).pipe(
        Effect.catchTag("UnsupportedValue", (error) => Effect.succeed(error.reason))
      )
      expect(result).toBe("accessor-property")
    }))

  it.effect("admits only the closed reason vocabulary", () =>
    Effect.gen(function*() {
      const decoded = yield* Effect.forEach(unsupportedReasons, (reason) =>
        Schema.decodeUnknown(UnsupportedValue)({ _tag: "UnsupportedValue", reason }))
      const foreign = yield* Effect.exit(
        Schema.decodeUnknown(UnsupportedValue)({ _tag: "UnsupportedValue", reason: "provider-message" })
      )

      expect(Arr.map(decoded, (error) =>
        error.reason)).toStrictEqual(unsupportedReasons)
      expect(Exit.isFailure(foreign)).toBe(true)
    }))

  it.effect("round-trips only the bounded reason field through Schema", () =>
    Effect.gen(function*() {
      const error = new UnsupportedValue({ reason: "reflection-failure" })
      const encoded = yield* Schema.encode(UnsupportedValue)(error)
      const decoded = yield* Schema.decodeUnknown(UnsupportedValue)(encoded)

      expect(encoded).toStrictEqual({ _tag: "UnsupportedValue", reason: "reflection-failure" })
      expect(decoded.reason).toBe("reflection-failure")
    }))
})

describe("CyclicValue — Schema.TaggedError", () => {
  it.effect("is yieldable and catchable via Effect.catchTag", () =>
    Effect.gen(function*() {
      const result = yield* new CyclicValue({}).pipe(
        Effect.catchTag("CyclicValue", (error) => Effect.succeed(error._tag))
      )
      expect(result).toBe("CyclicValue")
    }))

  it.effect("round-trips with no diagnostic payload", () =>
    Effect.gen(function*() {
      const encoded = yield* Schema.encode(CyclicValue)(new CyclicValue({}))
      const decoded = yield* Schema.decodeUnknown(CyclicValue)(encoded)

      expect(encoded).toStrictEqual({ _tag: "CyclicValue" })
      expect(decoded._tag).toBe("CyclicValue")
    }))
})

describe("CanonicalizationError — closed Schema union", () => {
  it.effect("round-trips every union member", () =>
    Effect.gen(function*() {
      const errors = [
        new InvalidUnicode({ kind: "lone-low-surrogate", codeUnitIndex: 1 }),
        new UnsupportedValue({ reason: "symbol-property" }),
        new CyclicValue({})
      ]
      const encoded = yield* Effect.forEach(errors, (error) => Schema.encode(CanonicalizationError)(error))
      const decoded = yield* Effect.forEach(encoded, (value) => Schema.decodeUnknown(CanonicalizationError)(value))

      expect(Arr.map(decoded, (error) => error._tag)).toStrictEqual([
        "InvalidUnicode",
        "UnsupportedValue",
        "CyclicValue"
      ])
    }))

  it.effect("rejects foreign tags", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        Schema.decodeUnknown(CanonicalizationError)({ _tag: "ProviderFailure", reason: "secret" })
      )
      expect(Exit.isFailure(exit)).toBe(true)
    }))
})
