/**
 * Parse retry schedule contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Cause, Effect, Exit, Fiber, Option, Ref, TestClock } from "effect"
import { defaultParseRetrySchedule } from "../../src/Module/predict/policy.js"

describe("internal/retry", () => {
  it.effect("retries exactly maxRetries times before succeeding", () =>
    Effect.gen(function*() {
      const attempts = yield* Ref.make(0)

      const resultFiber = yield* Effect.fork(
        Effect.gen(function*() {
          const nextAttempt = yield* Ref.updateAndGet(attempts, (count) => count + 1)

          return yield* Effect.if(nextAttempt < 4, {
            onTrue: () => Effect.fail("retry"),
            onFalse: () => Effect.succeed("ok")
          })
        }).pipe(
          Effect.retry(defaultParseRetrySchedule(3))
        )
      )

      yield* TestClock.adjust("2 seconds")

      const result = yield* Fiber.join(resultFiber)

      const totalAttempts = yield* Ref.get(attempts)

      expect(result).toBe("ok")
      expect(totalAttempts).toBe(4)
    }))

  it.effect("fails after maxRetries and preserves retry attempt count", () =>
    Effect.gen(function*() {
      const attempts = yield* Ref.make(0)

      const exitFiber = yield* Effect.fork(
        Effect.exit(
          Effect.gen(function*() {
            yield* Ref.update(attempts, (count) => count + 1)
            return yield* Effect.fail("retry")
          }).pipe(
            Effect.retry(defaultParseRetrySchedule(2))
          )
        )
      )

      yield* TestClock.adjust("2 seconds")

      const exit = yield* Fiber.join(exitFiber)
      const failure = Exit.match(exit, {
        onSuccess: () => Option.none<string>(),
        onFailure: Cause.failureOption
      })
      const totalAttempts = yield* Ref.get(attempts)

      expect(failure).toEqual(Option.some("retry"))
      expect(totalAttempts).toBe(3)
    }))
})
