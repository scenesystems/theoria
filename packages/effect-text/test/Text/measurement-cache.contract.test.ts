import { describe, expect, it } from "@effect/vitest"
import { Context, Deferred, Effect, Exit, Fiber, Layer, Match, Number, Option, Ref, Scope, String } from "effect"

import { Contracts, Errors, Text } from "../../src/index.js"

/**
 * A measurer whose every measurement waits at `gate`, so a lookup can be held
 * open while other fibers arrive at the same key; measurements are counted
 * once past the gate, so a measurement stopped at the gate counts for none.
 */
const makeGatedMeasurer = Effect.gen(function*() {
  const gate = yield* Deferred.make<void>()
  const measurements = yield* Ref.make(0)
  const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
    measure: (_font, text: string) =>
      Deferred.await(gate).pipe(
        Effect.zipRight(Ref.update(measurements, Number.increment)),
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
      Text.MeasurementCacheLive.pipe(Layer.provide(gated.measurerLayer)),
      scope
    )
    return { ...gated, cache: Context.get(context, Contracts.MeasurementCache) }
  })

/** The gated measurer behind a measurement cache owned by the test's scope. */
const makeGatedContext = Effect.flatMap(Effect.scope, makeGatedCache)

const font = { family: "Mono", size: 10 }

/** Interrupts `fiber` from another fiber and reports whether that interrupt has taken effect after a few turns. */
const interruptedSoon = (fiber: Fiber.RuntimeFiber<number, Errors.MeasurementFailed>) =>
  Effect.gen(function*() {
    const interrupting = yield* Effect.fork(Fiber.interrupt(fiber))
    yield* Effect.yieldNow()
    yield* Effect.yieldNow()
    yield* Effect.yieldNow()
    return { interrupting, taken: Option.isSome(yield* Fiber.poll(interrupting)) }
  })

describe("Text measurement cache contracts", () => {
  it.scoped("a lookup begun is finished and shared even when the fiber that began it is interrupted", () =>
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

  it.scoped("a reader cancelled while the measurement is still pending is done at once; the others are answered", () =>
    Effect.gen(function*() {
      const { cache, gate, measurements } = yield* makeGatedContext
      const first = yield* Effect.fork(cache.measure(font, "abcd"))
      yield* Effect.yieldNow()
      const second = yield* Effect.fork(cache.measure(font, "abcd"))
      yield* Effect.yieldNow()

      // The measurement is not the reader's to wait out: its interrupt takes effect while the gate is still shut.
      const cancelled = yield* interruptedSoon(second)
      expect(cancelled.taken).toBe(true)
      expect(Exit.isInterrupted(yield* Fiber.join(cancelled.interrupting))).toBe(true)
      expect(yield* Ref.get(measurements)).toBe(0)

      yield* Deferred.succeed(gate, undefined)
      expect(yield* Fiber.join(first)).toBe(20)
      expect(yield* cache.measure(font, "abcd")).toBe(20)
      expect(yield* Ref.get(measurements)).toBe(1)
    }))

  it.scoped("closing the scope that owns the cache stops a measurement still pending", () =>
    Effect.gen(function*() {
      const owner = yield* Scope.make()
      const { cache, gate, measurements } = yield* makeGatedCache(owner)
      const reading = yield* Effect.fork(cache.measure(font, "abcd"))
      yield* Effect.yieldNow()

      yield* Scope.close(owner, Exit.void)
      expect(Exit.isInterrupted(yield* Fiber.await(reading))).toBe(true)
      // The measurement was stopped at the gate: opening it afterwards measures nothing.
      yield* Deferred.succeed(gate, undefined)
      yield* Effect.yieldNow()
      expect(yield* Ref.get(measurements)).toBe(0)
    }))

  it.scoped("a measurement that failed is not the answer for the next read", () =>
    Effect.gen(function*() {
      const attempts = yield* Ref.make(0)
      const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
        measure: (_font, text: string) =>
          Ref.updateAndGet(attempts, Number.increment).pipe(
            Effect.flatMap((attempt) =>
              Match.value(attempt).pipe(
                Match.when(1, () =>
                  Effect.fail(
                    new Errors.MeasurementFailed({
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
      const context = yield* Layer.build(Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer)))
      const cache = Context.get(context, Contracts.MeasurementCache)

      expect(Exit.isFailure(yield* Effect.exit(cache.measure(font, "abcd")))).toBe(true)
      expect(yield* cache.measure(font, "abcd")).toBe(20)
      expect(yield* Ref.get(attempts)).toBe(2)
    }))
})
