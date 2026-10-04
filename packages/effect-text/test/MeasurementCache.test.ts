import { describe, expect, it } from "@effect/vitest"
import { Array, Context, Deferred, Effect, Exit, Fiber, Layer, Match, Number, Ref, Scope, String } from "effect"

import { MeasurementCache, TextMeasurer } from "../src/index.js"

/**
 * A measurer whose every measurement waits at `gate`, so a lookup can be held
 * open while other fibers arrive at the same key; measurements are counted
 * once past the gate, so a measurement stopped at the gate counts for none.
 */
const makeGatedMeasurer = Effect.gen(function*() {
  const gate = yield* Deferred.make<void>()
  const measurements = yield* Ref.make(0)
  const measurerLayer = Layer.succeed(TextMeasurer.TextMeasurer, {
    measure: (_font, text: string) =>
      Deferred.await(gate).pipe(
        Effect.andThen(Ref.update(measurements, Number.increment)),
        Effect.as(Number.multiply(String.length(text), 5))
      )
  })
  return { gate, measurements, measurerLayer }
})

/** The gated measurer behind a measurement cache owned by `scope`. */
const makeGatedCache = (scope: Scope.Scope) =>
  Effect.gen(function*() {
    const gated = yield* makeGatedMeasurer
    const context = yield* Layer.buildWithScope(
      MeasurementCache.layer.pipe(Layer.provide(gated.measurerLayer)),
      scope
    )
    return { ...gated, cache: Context.get(context, MeasurementCache.MeasurementCache) }
  })

/** The gated measurer behind a measurement cache owned by the test's scope. */
const makeGatedContext = Effect.flatMap(Effect.scope, makeGatedCache)

const font = { family: "Mono", size: 10 }

/** Interrupts `fiber` and reports when that interrupt has taken effect. */
const interruptedSoon = (fiber: Fiber.Fiber<number, TextMeasurer.Failed>) =>
  Effect.gen(function*() {
    yield* Fiber.interrupt(fiber)
    return true
  })

describe("Text measurement cache contracts", () => {
  it.effect("separate provisions of the same layer do not share a measurement generation", () =>
    Effect.gen(function*() {
      const attempts = yield* Ref.make(0)
      const measurer = Layer.succeed(TextMeasurer.TextMeasurer, {
        measure: () => Ref.updateAndGet(attempts, Number.increment)
      })
      const layer = MeasurementCache.layer.pipe(Layer.provide(measurer))
      const readTwice = Effect.gen(function*() {
        const cache = yield* MeasurementCache.MeasurementCache
        return Array.make(yield* cache.measure(font, "alpha"), yield* cache.measure(font, "alpha"))
      }).pipe(Effect.provide(layer))

      expect(yield* readTwice).toEqual(Array.make(1, 1))
      expect(yield* readTwice).toEqual(Array.make(2, 2))
      expect(yield* Ref.get(attempts)).toBe(2)
    }))

  it.effect("a lookup begun is finished and shared even when the fiber that began it is interrupted", () =>
    Effect.gen(function*() {
      const { cache, gate, measurements } = yield* makeGatedContext
      const first = yield* Effect.forkChild(cache.measure(font, "abcd"))
      yield* Effect.yieldNow
      const second = yield* Effect.forkChild(cache.measure(font, "abcd"))
      yield* Effect.yieldNow

      // The interrupt is asked for while the measurement is still pending; it must not take the pending result with it.
      const interrupting = yield* Effect.forkChild(Fiber.interrupt(first))
      yield* Effect.yieldNow
      yield* Deferred.succeed(gate, undefined)

      expect(yield* Fiber.join(second)).toBe(20)
      yield* Fiber.join(interrupting)
      expect(Exit.hasInterrupts(yield* Effect.exit(Fiber.join(first)))).toBe(true)
      // The result the first fiber began is the cache's now: a third read does not measure again.
      expect(yield* cache.measure(font, "abcd")).toBe(20)
      expect(yield* Ref.get(measurements)).toBe(1)
    }))

  it.effect("a reader cancelled while the measurement is still pending is done at once; the others are answered", () =>
    Effect.gen(function*() {
      const { cache, gate, measurements } = yield* makeGatedContext
      const first = yield* Effect.forkChild(cache.measure(font, "abcd"))
      yield* Effect.yieldNow
      const second = yield* Effect.forkChild(cache.measure(font, "abcd"))
      yield* Effect.yieldNow

      // The measurement is not the reader's to wait out: its interrupt takes effect while the gate is still shut.
      const cancelled = yield* interruptedSoon(second)
      expect(cancelled).toBe(true)
      expect(Exit.hasInterrupts(yield* Effect.exit(Fiber.join(second)))).toBe(true)
      expect(yield* Ref.get(measurements)).toBe(0)

      // A later reader must still join the original pending lookup, not start another one.
      const third = yield* Effect.forkChild(cache.measure(font, "abcd"))
      yield* Effect.yieldNow
      yield* Deferred.succeed(gate, undefined)
      expect(yield* Fiber.join(first)).toBe(20)
      expect(yield* Fiber.join(third)).toBe(20)
      expect(yield* cache.measure(font, "abcd")).toBe(20)
      expect(yield* Ref.get(measurements)).toBe(1)
    }))

  it.effect("closing the scope that owns the cache stops a measurement still pending", () =>
    Effect.gen(function*() {
      const owner = yield* Scope.make()
      const { cache, gate, measurements } = yield* makeGatedCache(owner)
      const reading = yield* Effect.forkChild(cache.measure(font, "abcd"))
      yield* Effect.yieldNow

      yield* Scope.close(owner, Exit.void)
      expect(Exit.hasInterrupts(yield* Effect.exit(Fiber.join(reading)))).toBe(true)
      // The measurement was stopped at the gate: opening it afterwards measures nothing.
      yield* Deferred.succeed(gate, undefined)
      yield* Effect.yieldNow
      expect(yield* Ref.get(measurements)).toBe(0)
    }))

  it.effect("a measurement that failed is not the answer for the next read", () =>
    Effect.gen(function*() {
      const attempts = yield* Ref.make(0)
      const measurerLayer = Layer.succeed(TextMeasurer.TextMeasurer, {
        measure: (_font, text: string) =>
          Ref.updateAndGet(attempts, Number.increment).pipe(
            Effect.flatMap((attempt) =>
              Match.value(attempt).pipe(
                Match.when(1, () =>
                  Effect.fail(
                    new TextMeasurer.Failed({
                      fontFamily: font.family,
                      fontSize: font.size,
                      text,
                      reason: "not ready"
                    })
                  )),
                Match.orElse(() => Effect.succeed(Number.multiply(String.length(text), 5)))
              )
            )
          )
      })
      const context = yield* Layer.build(MeasurementCache.layer.pipe(Layer.provide(measurerLayer)))
      const cache = Context.get(context, MeasurementCache.MeasurementCache)

      expect(Exit.isFailure(yield* Effect.exit(cache.measure(font, "abcd")))).toBe(true)
      expect(yield* cache.measure(font, "abcd")).toBe(20)
      expect(yield* Ref.get(attempts)).toBe(2)
    }))

  it.effect("failed readers cannot evict a successful retry of their shared measurement", () =>
    Effect.gen(function*() {
      const gate = yield* Deferred.make<void>()
      const attempts = yield* Ref.make(0)
      const measurerLayer = Layer.succeed(TextMeasurer.TextMeasurer, {
        measure: (_font, text: string) =>
          Ref.updateAndGet(attempts, Number.increment).pipe(
            Effect.flatMap((attempt) =>
              Match.value(attempt).pipe(
                Match.when(1, () =>
                  Deferred.await(gate).pipe(Effect.andThen(Effect.fail(
                    new TextMeasurer.Failed({
                      fontFamily: font.family,
                      fontSize: font.size,
                      text,
                      reason: "not ready"
                    })
                  )))),
                Match.orElse(() => Effect.succeed(Number.multiply(String.length(text), 5)))
              )
            )
          )
      })
      const context = yield* Layer.build(MeasurementCache.layer.pipe(Layer.provide(measurerLayer)))
      const cache = Context.get(context, MeasurementCache.MeasurementCache)
      const readers = yield* Effect.forEach(Array.range(1, 20), () =>
        Effect.forkChild(
          cache.measure(font, "abcd").pipe(
            Effect.catch(() => cache.measure(font, "abcd"))
          )
        ))
      yield* Effect.yieldNow
      yield* Effect.yieldNow
      yield* Deferred.succeed(gate, undefined)

      expect(yield* Effect.forEach(readers, Fiber.join)).toEqual(Array.replicate(20, 20))
      expect(yield* cache.measure(font, "abcd")).toBe(20)
      expect(yield* Ref.get(attempts)).toBe(2)
    }))
})
