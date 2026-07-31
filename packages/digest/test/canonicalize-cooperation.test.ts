import { expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Exit, Fiber, MutableList, MutableRef, Record as Rec, Scheduler } from "effect"

import { canonicalize } from "../src/canonicalize.js"
import { canonicalJsonBytes } from "../src/convenience.js"
import { canonicalizeSegments, canonicalizeWithByteLimit, encodeCanonicalSegments } from "../src/internal/jcs.js"
import { CanonicalByteLimitExceeded, type CanonicalizationError } from "../src/schemas/errors.js"

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

it.effect("bounded sink segments preserve canonical text, UTF-8 bytes, and the exact final byte count", () =>
  Effect.gen(function*() {
    const value = { z: LONG_TEXT, a: ["é", "😀", "\n"] }
    const delivered = MutableList.empty<string>()
    const canonicalByteLength = yield* canonicalizeWithByteLimit(
      value,
      Number.MAX_SAFE_INTEGER,
      (segment) => void MutableList.append(delivered, segment)
    )
    const segments = Chunk.fromIterable(delivered)
    const text = yield* canonicalize(value)
    const bytes = yield* canonicalJsonBytes(value)
    const deliveredBytes = yield* encodeCanonicalSegments(segments)

    expect(Chunk.size(segments)).toBeGreaterThan(1)
    expect(Chunk.join(segments, "")).toBe(text)
    expect(deliveredBytes).toStrictEqual(bytes)
    expect(canonicalByteLength).toBe(bytes.byteLength)
  }))

it.effect("bounded sink flushes the final pending segment only on traversal success", () =>
  Effect.gen(function*() {
    const successful = MutableList.empty<string>()
    const failed = MutableList.empty<string>()
    const canonicalByteLength = yield* canonicalizeWithByteLimit(
      "value",
      7,
      (segment) => void MutableList.append(successful, segment)
    )
    const failure = yield* Effect.exit(
      canonicalizeWithByteLimit(
        "a".repeat(32 * 1024 + 1),
        32 * 1024,
        (segment) => void MutableList.append(failed, segment)
      )
    )

    expect(Chunk.fromIterable(successful)).toStrictEqual(Chunk.make("\"value\""))
    expect(canonicalByteLength).toBe(7)
    expect(failure).toStrictEqual(Exit.fail(new CanonicalByteLimitExceeded({})))
    expect(MutableList.length(failed)).toBe(0)
  }))

it.effect("bounded sink remains interruptible after incremental segment delivery", () =>
  Effect.gen(function*() {
    const delivered = MutableRef.make(0)
    const fiber = yield* Effect.fork(
      canonicalizeWithByteLimit(
        LONG_TEXT,
        Number.MAX_SAFE_INTEGER,
        () => void MutableRef.increment(delivered)
      )
    )
    yield* Effect.iterate(0, {
      while: (attempt) => attempt < 256 && MutableRef.get(delivered) === 0,
      body: (attempt) => Effect.as(Effect.yieldNow(), attempt + 1)
    })
    const exit = yield* Fiber.interrupt(fiber)

    expect(MutableRef.get(delivered)).toBeGreaterThan(0)
    expect(Exit.isInterrupted(exit)).toBe(true)
  }))

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
