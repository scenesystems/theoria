/**
 * Error model contract tests.
 *
 * ### InvalidKeyLength
 * - Yieldable in Effect.gen
 * - Catchable via Effect.catchTag
 * - Carries expected and actual fields
 *
 * ### FingerprintUnsupportedValue
 * - Yieldable in Effect.gen
 * - Catchable via Effect.catchTag
 * - Carries valueType and reason fields
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import { FingerprintUnsupportedValue, InvalidKeyLength } from "../../src/schemas/errors.js"

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

describe("FingerprintUnsupportedValue — Schema.TaggedError", () => {
  it.effect("is yieldable in Effect.gen", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        Effect.gen(function*() {
          return yield* new FingerprintUnsupportedValue({ valueType: "undefined", reason: "not JSON" })
        })
      )
      expect(Exit.isFailure(exit)).toBe(true)
    }))

  it.effect("is catchable via Effect.catchTag", () =>
    Effect.gen(function*() {
      const result = yield* Effect.gen(function*() {
        return yield* new FingerprintUnsupportedValue({ valueType: "symbol", reason: "not serializable" })
      }).pipe(
        Effect.catchTag("FingerprintUnsupportedValue", (e) => Effect.succeed(`caught:${e.valueType}`))
      )
      expect(result).toBe("caught:symbol")
    }))

  it.effect("carries valueType and reason fields", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        Effect.gen(function*() {
          return yield* new FingerprintUnsupportedValue({ valueType: "bigint", reason: "must be pre-encoded" })
        })
      )
      expect(exit).toStrictEqual(
        Exit.fail(new FingerprintUnsupportedValue({ valueType: "bigint", reason: "must be pre-encoded" }))
      )
    }))
})
