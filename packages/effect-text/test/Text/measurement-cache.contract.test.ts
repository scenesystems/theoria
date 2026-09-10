import { describe, expect, it } from "@effect/vitest"
import { Deferred, Effect, Exit, Fiber, Layer, Ref } from "effect"

import { Contracts, Errors, Text } from "../../src/index.js"

/**
 * A measurer whose every measurement waits at `gate`, so a lookup can be held
 * open while other fibers arrive at the same key.
 */
const makeGatedContext = Effect.gen(function*() {
  const gate = yield* Deferred.make<void>()
  const measurements = yield* Ref.make(0)
  const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
    measure: (_font, text: string) =>
      Deferred.await(gate).pipe(
        Effect.zipRight(Ref.update(measurements, (count) => count + 1)),
        Effect.as(text.length * 5)
      )
  })
  const cache = yield* Contracts.MeasurementCache.pipe(
    Effect.provide(Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer)))
  )

  return { gate, measurements, cache }
})

const font = { family: "Mono", size: 10 }

describe("Text measurement cache contracts", () => {
  it.effect("a lookup begun is finished and shared even when the fiber that began it is interrupted", () =>
    Effect.gen(function*() {
      const { cache, gate, measurements } = yield* makeGatedContext
      const first = yield* Effect.fork(cache.measure(font, "abcd"))
      yield* Effect.yieldNow()
      const second = yield* Effect.fork(cache.measure(font, "abcd"))
      yield* Effect.yieldNow()

      // The interrupt is asked for while the measurement is still pending; it must not take the pending result with it.
      const interrupting = yield* Effect.fork(Fiber.interrupt(first))
      yield* Effect.yieldNow()
      yield* Deferred.succeed(gate, undefined)

      expect(yield* Fiber.join(second)).toBe(20)
      expect(Exit.isInterrupted(yield* Fiber.join(interrupting))).toBe(true)
      // The result the first fiber began is the cache's now: a third read does not measure again.
      expect(yield* cache.measure(font, "abcd")).toBe(20)
      expect(yield* Ref.get(measurements)).toBe(1)
    }))

  it.effect("a measurement that failed is not the answer for the next read", () =>
    Effect.gen(function*() {
      const attempts = yield* Ref.make(0)
      const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
        measure: (_font, text: string) =>
          Ref.updateAndGet(attempts, (count) => count + 1).pipe(
            Effect.flatMap((attempt) =>
              attempt === 1
                ? Effect.fail(
                  new Errors.MeasurementFailed({
                    fontFamily: font.family,
                    fontSize: font.size,
                    text,
                    reason: "not ready"
                  })
                )
                : Effect.succeed(text.length * 5)
            )
          )
      })
      const cache = yield* Contracts.MeasurementCache.pipe(
        Effect.provide(Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer)))
      )

      expect(Exit.isFailure(yield* Effect.exit(cache.measure(font, "abcd")))).toBe(true)
      expect(yield* cache.measure(font, "abcd")).toBe(20)
      expect(yield* Ref.get(attempts)).toBe(2)
    }))
})
