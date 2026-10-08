/**
 * Error recovery: Schema.TaggedError yieldability and discrimination.
 */
import { describe, expect, it } from "@effect/vitest"
import { ParseOutputError, SignatureError } from "@scenesystems/effect-dsp/DspError"
import { TooManyErrors } from "@scenesystems/effect-dsp/TeacherTrace"
import { Effect, Exit, Option } from "effect"

describe("Errors", () => {
  describe("Schema.TaggedError yieldability", () => {
    it.effect("SignatureError is yieldable", () =>
      Effect.gen(function*() {
        const exit = yield* Effect.exit(
          new SignatureError({ reason: "empty fields" })
        )
        expect(Exit.isFailure(exit)).toBe(true)
      }))

    it.effect("ParseOutputError is yieldable", () =>
      Effect.gen(function*() {
        const exit = yield* Effect.exit(
          new ParseOutputError({
            message: "bad json",
            moduleName: "qa",
            rawOutput: Option.none(),
            retryCount: Option.none(),
            fieldDiagnostics: []
          })
        )
        expect(Exit.isFailure(exit)).toBe(true)
      }))

    it.effect("TooManyErrors is yieldable", () =>
      Effect.gen(function*() {
        const exit = yield* Effect.exit(
          new TooManyErrors({ count: 1, limit: 1 })
        )
        expect(Exit.isFailure(exit)).toBe(true)
      }))
  })

  describe("catchTag discrimination", () => {
    it.effect("can catch SignatureError by tag", () =>
      Effect.gen(function*() {
        const result = yield* new SignatureError({ reason: "test" }).pipe(
          Effect.catchTag("SignatureError", (error) => Effect.succeed(error.reason))
        )
        expect(result).toBe("test")
      }))

    it.effect("can catch TooManyErrors by tag", () =>
      Effect.gen(function*() {
        const result = yield* new TooManyErrors({ count: 3, limit: 3 }).pipe(
          Effect.catchTag("TooManyErrors", (error) => Effect.succeed(error.count))
        )
        expect(result).toBe(3)
      }))
  })
})
