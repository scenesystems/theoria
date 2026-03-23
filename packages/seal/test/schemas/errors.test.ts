/**
 * Schema.TaggedError tests for seal errors.
 *
 * ### DecryptionFailed
 * - Yieldable in Effect.gen
 * - Catchable via Effect.catchTag
 * - Carries algorithm and reason fields
 * - Correct _tag discrimination
 *
 * ### InvalidKey
 * - Yieldable in Effect.gen
 * - Catchable via Effect.catchTag
 * - Carries expected and received fields
 * - Correct _tag discrimination
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import { DecryptionFailed, InvalidKey } from "../../src/schemas/errors.js"

describe("DecryptionFailed — Schema.TaggedError", () => {
  it.effect("is yieldable in Effect.gen", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        Effect.gen(function*() {
          return yield* new DecryptionFailed({
            algorithm: "xchacha20-poly1305",
            reason: "authentication failed"
          })
        })
      )
      expect(Exit.isFailure(exit)).toBe(true)
    }))

  it.effect("is catchable via Effect.catchTag", () =>
    Effect.gen(function*() {
      const result = yield* Effect.gen(function*() {
        return yield* new DecryptionFailed({
          algorithm: "aes-256-gcm",
          reason: "tampered"
        })
      }).pipe(
        Effect.catchTag("DecryptionFailed", (e) => Effect.succeed(`caught:${e.algorithm}:${e.reason}`))
      )
      expect(result).toBe("caught:aes-256-gcm:tampered")
    }))

  it.effect("carries algorithm and reason fields", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        Effect.gen(function*() {
          return yield* new DecryptionFailed({
            algorithm: "aes-256-gcm-siv",
            reason: "wrong key"
          })
        })
      )
      expect(exit).toStrictEqual(
        Exit.fail(
          new DecryptionFailed({
            algorithm: "aes-256-gcm-siv",
            reason: "wrong key"
          })
        )
      )
    }))

  it.effect("has correct _tag discrimination", () =>
    Effect.gen(function*() {
      const err = new DecryptionFailed({
        algorithm: "xchacha20-poly1305",
        reason: "test"
      })
      expect(err._tag).toBe("DecryptionFailed")
    }))
})

describe("InvalidKey — Schema.TaggedError", () => {
  it.effect("is yieldable in Effect.gen", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        Effect.gen(function*() {
          return yield* new InvalidKey({ expected: 32, received: 16 })
        })
      )
      expect(Exit.isFailure(exit)).toBe(true)
    }))

  it.effect("is catchable via Effect.catchTag", () =>
    Effect.gen(function*() {
      const result = yield* Effect.gen(function*() {
        return yield* new InvalidKey({ expected: 32, received: 64 })
      }).pipe(
        Effect.catchTag("InvalidKey", (e) => Effect.succeed(`caught:${e.expected}:${e.received}`))
      )
      expect(result).toBe("caught:32:64")
    }))

  it.effect("carries expected and received fields", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        Effect.gen(function*() {
          return yield* new InvalidKey({ expected: 32, received: 0 })
        })
      )
      expect(exit).toStrictEqual(
        Exit.fail(new InvalidKey({ expected: 32, received: 0 }))
      )
    }))

  it.effect("has correct _tag discrimination", () =>
    Effect.gen(function*() {
      const err = new InvalidKey({ expected: 32, received: 16 })
      expect(err._tag).toBe("InvalidKey")
    }))
})
