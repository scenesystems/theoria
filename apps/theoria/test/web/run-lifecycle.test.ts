import { describe, expect, it } from "@effect/vitest"
import { Effect, Fiber, Option, Ref, TestClock } from "effect"

import { RunSignal } from "../../app/web/atoms/run/lifecycle.js"

describe("run lifecycle", () => {
  it.effect("preserves remaining active sleep after a mid-sleep pause", () =>
    Effect.gen(function*() {
      const signal = yield* RunSignal.allocate()
      const sleeper = yield* Effect.fork(signal.sleep(100).pipe(Effect.as("done")))

      yield* TestClock.adjust("25 millis")
      yield* signal.pause()
      yield* Effect.yieldNow()
      yield* TestClock.adjust("1 second")

      expect(Option.isNone(yield* Fiber.poll(sleeper))).toBe(true)

      yield* signal.resume()
      yield* Effect.yieldNow()
      yield* TestClock.adjust("74 millis")

      expect(Option.isNone(yield* Fiber.poll(sleeper))).toBe(true)

      yield* TestClock.adjust("1 millis")

      expect(yield* Fiber.join(sleeper)).toBe("done")
    }))

  it.effect("resumes cleanly across repeated pause cycles", () =>
    Effect.gen(function*() {
      const signal = yield* RunSignal.allocate()
      const sleeper = yield* Effect.fork(signal.sleep(100).pipe(Effect.as("done")))

      yield* TestClock.adjust("30 millis")
      yield* signal.pause()
      yield* Effect.yieldNow()
      yield* TestClock.adjust("1 second")

      expect(Option.isNone(yield* Fiber.poll(sleeper))).toBe(true)

      yield* signal.resume()
      yield* Effect.yieldNow()
      yield* TestClock.adjust("30 millis")
      yield* signal.pause()
      yield* Effect.yieldNow()
      yield* TestClock.adjust("1 second")

      expect(Option.isNone(yield* Fiber.poll(sleeper))).toBe(true)

      yield* signal.resume()
      yield* Effect.yieldNow()
      yield* TestClock.adjust("39 millis")

      expect(Option.isNone(yield* Fiber.poll(sleeper))).toBe(true)

      yield* TestClock.adjust("1 millis")

      expect(yield* Fiber.join(sleeper)).toBe("done")
    }))

  it.effect("emits one checkpoint observation per pause request", () =>
    Effect.gen(function*() {
      const checkpointCount = yield* Ref.make(0)
      const signal = yield* RunSignal.allocate({
        onPauseCheckpointReached: Ref.update(checkpointCount, (count) => count + 1).pipe(Effect.asVoid)
      })
      const sleeper = yield* Effect.fork(signal.sleep(100).pipe(Effect.as("done")))

      yield* TestClock.adjust("25 millis")
      yield* signal.pause()
      yield* Effect.yieldNow()

      yield* TestClock.adjust("1 second")

      expect(yield* Ref.get(checkpointCount)).toBe(1)
      expect(Option.isNone(yield* Fiber.poll(sleeper))).toBe(true)

      yield* signal.resume()
      yield* Effect.yieldNow()
      yield* TestClock.adjust("25 millis")
      yield* signal.pause()
      yield* Effect.yieldNow()

      yield* TestClock.adjust("1 second")

      expect(yield* Ref.get(checkpointCount)).toBe(2)

      yield* signal.resume()
      yield* Effect.yieldNow()
      yield* TestClock.adjust("50 millis")

      expect(yield* Fiber.join(sleeper)).toBe("done")
    }))
})
