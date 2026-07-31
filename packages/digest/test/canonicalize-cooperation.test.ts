import { expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Exit, Fiber, MutableRef, Record as Rec, Scheduler } from "effect"

import { canonicalJsonBytes } from "../src/convenience.js"
import { canonicalizeSegments, encodeCanonicalSegments } from "../src/internal/jcs.js"
import type { CanonicalizationError } from "../src/schemas/errors.js"

const WIDTH = 65_536
const INTERRUPT_WIDTH = 262_144
const LONG_TEXT = "value".repeat(WIDTH)

const wideArray = (): ReadonlyArray<ReadonlyArray<number>> => Arr.makeBy(WIDTH, (index) => [index, index + 0.5])

const wideRecord = (): Readonly<Record<string, number>> =>
  Rec.fromEntries(
    Arr.makeBy(WIDTH, (index): readonly [string, number] => [`key-${String(index).padStart(5, "0")}`, index])
  )

const hostTimerTicksDuring = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<number, E> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const probe = { ticks: 0 }
      const handle = setInterval(() => {
        probe.ticks += 1
      }, 1)
      return { handle, probe }
    }),
    ({ probe }) => Effect.as(effect, probe).pipe(Effect.map(({ ticks }) => ticks)),
    ({ handle }) => Effect.sync(() => clearInterval(handle))
  )

const scheduledTasksDuring = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<number, E> =>
  Effect.suspend(() => {
    const scheduled = MutableRef.make(0)
    const scheduler = Scheduler.make(
      (task, priority, fiber) => {
        MutableRef.update(scheduled, (count) => count + 1)
        Scheduler.defaultScheduler.scheduleTask(task, priority, fiber)
      },
      () => false
    )
    return Effect.map(Effect.withScheduler(effect, scheduler), () => MutableRef.get(scheduled))
  })

it.effect("single-batch canonicalJsonBytes does not schedule terminal no-progress yields", () =>
  Effect.gen(function*() {
    const scheduled = yield* scheduledTasksDuring(canonicalJsonBytes({ value: 1 }))
    expect(scheduled).toBe(0)
  }))

it.effect("multi-batch traversal, segment encoding, and segment copying retain continuing yields", () =>
  Effect.gen(function*() {
    const traversalTasks = yield* scheduledTasksDuring(canonicalizeSegments(Arr.makeBy(1_024, (index) => index)))
    const assemblyTasks = yield* scheduledTasksDuring(
      encodeCanonicalSegments(Chunk.fromIterable(Arr.makeBy(5, (index) => String(index))))
    )
    expect(traversalTasks).toBeGreaterThan(0)
    expect(assemblyTasks).toBe(2)
  }))

it.effect("multi-batch canonical byte assembly remains interruptible", () =>
  Effect.gen(function*() {
    const segments = Chunk.fromIterable(Arr.makeBy(512, (index) => String(index)))
    const fiber = yield* Effect.fork(encodeCanonicalSegments(segments))
    yield* Effect.yieldNow()
    const exit = yield* Fiber.interrupt(fiber)
    expect(Exit.isInterrupted(exit)).toBe(true)
  }))

it.live("canonicalJsonBytes yields to the host timer during a moderately wide traversal", () =>
  Effect.gen(function*() {
    const value = Arr.makeBy(512, (index) => [index, index + 0.5])
    const ticks = yield* hostTimerTicksDuring(canonicalJsonBytes(value))
    expect(ticks).toBeGreaterThan(0)
  }), 30_000)

it.live.each<readonly [string, () => Effect.Effect<Uint8Array, CanonicalizationError>]>(
  [
    ["array", () => canonicalJsonBytes(wideArray())],
    ["record", () => canonicalJsonBytes(wideRecord())],
    ["long string", () => canonicalJsonBytes(LONG_TEXT)],
    ["long record key", () => canonicalJsonBytes({ [LONG_TEXT]: true })]
  ]
)("canonicalJsonBytes yields to the host timer while traversing a wide %s", ([, operation]) =>
  Effect.gen(function*() {
    const ticks = yield* hostTimerTicksDuring(operation())
    expect(ticks).toBeGreaterThan(0)
  }), 30_000)

it.live("canonicalJsonBytes can be interrupted before a wide traversal publishes bytes", () =>
  Effect.gen(function*() {
    const target = Arr.makeBy(INTERRUPT_WIDTH, (index) => [index, index + 0.5])
    const probe = { descriptors: 0 }
    const value = new Proxy(target, {
      getOwnPropertyDescriptor: (proxied, key) => {
        probe.descriptors += 1
        return Reflect.getOwnPropertyDescriptor(proxied, key)
      }
    })
    const fiber = yield* Effect.fork(canonicalJsonBytes(value))
    yield* Effect.sleep(0)
    const exit = yield* Fiber.interrupt(fiber)
    expect(Exit.isInterrupted(exit)).toBe(true)
    expect(probe.descriptors).toBeLessThan(INTERRUPT_WIDTH)
  }), 30_000)

it.live("canonicalJsonBytes assembles canonical UTF-8 segments cooperatively", () =>
  Effect.gen(function*() {
    const segment = "😀".repeat(16 * 1024)
    const segments = Chunk.fromIterable(Arr.makeBy(512, () => segment))
    const ticks = yield* hostTimerTicksDuring(encodeCanonicalSegments(segments))
    expect(ticks).toBeGreaterThan(0)
  }), 30_000)

it.effect("one canonicalJsonBytes Effect is fresh when executed more than once", () => {
  const canonical = canonicalJsonBytes({ z: [3, 2, 1], a: "value" })
  return Effect.gen(function*() {
    const first = yield* canonical
    yield* Effect.yieldNow()
    const second = yield* canonical
    expect(second).toStrictEqual(first)
  })
})
