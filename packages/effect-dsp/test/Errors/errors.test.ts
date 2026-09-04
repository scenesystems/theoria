/**
 * Error model: Schema.TaggedError yieldability and discrimination.
 */
import { describe, expect, it } from "@effect/vitest"
import { BootstrapFailed, ParseOutputError, SignatureError } from "@scenesystems/effect-dsp/Errors"
import { Effect, Exit, Option } from "effect"

describe("Errors", () => {
  describe("Schema.TaggedError yieldability", () => {
    it.effect("SignatureError is yieldable", () =>
      Effect.gen(function*() {
        const exit = yield* Effect.exit(
          Effect.gen(function*() {
            return yield* new SignatureError({ reason: "empty fields" })
          })
        )
        expect(Exit.isFailure(exit)).toBe(true)
      }))

    it.effect("ParseOutputError is yieldable", () =>
      Effect.gen(function*() {
        const exit = yield* Effect.exit(
          Effect.gen(function*() {
            return yield* new ParseOutputError({
              message: "bad json",
              moduleName: "qa",
              rawOutput: Option.none(),
              retryCount: Option.none()
            })
          })
        )
        expect(Exit.isFailure(exit)).toBe(true)
      }))

    it.effect("BootstrapFailed is yieldable", () =>
      Effect.gen(function*() {
        const exit = yield* Effect.exit(
          Effect.gen(function*() {
            return yield* new BootstrapFailed({
              message: "no demos",
              roundsAttempted: 5,
              totalTraces: 0,
              threshold: 1,
              acceptedTraces: 0,
              rejectedTraces: 0,
              evaluatedExamples: 0,
              bestScoreSeen: false,
              bestScore: 0,
              averageScore: 0
            })
          })
        )
        expect(Exit.isFailure(exit)).toBe(true)
      }))
  })

  describe("catchTag discrimination", () => {
    it.effect("can catch SignatureError by tag", () =>
      Effect.gen(function*() {
        const result = yield* Effect.gen(function*() {
          return yield* new SignatureError({ reason: "test" })
        }).pipe(
          Effect.catchTag("SignatureError", (error) => Effect.succeed(error.reason))
        )
        expect(result).toBe("test")
      }))

    it.effect("can catch BootstrapFailed by tag", () =>
      Effect.gen(function*() {
        const result = yield* Effect.gen(function*() {
          return yield* new BootstrapFailed({
            message: "no demos",
            roundsAttempted: 3,
            totalTraces: 0,
            threshold: 1,
            acceptedTraces: 0,
            rejectedTraces: 1,
            evaluatedExamples: 1,
            bestScoreSeen: true,
            bestScore: 0,
            averageScore: 0
          })
        }).pipe(
          Effect.catchTag("BootstrapFailed", (error) => Effect.succeed(error.roundsAttempted))
        )
        expect(result).toBe(3)
      }))
  })
})
