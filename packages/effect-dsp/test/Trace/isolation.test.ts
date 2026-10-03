/**
 * Lexical trace isolation contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Deferred, Effect, Option } from "effect"
import * as Response from "effect/ai/Response"

const usage = new Response.Usage({
  inputTokens: { total: 1, uncached: 1, cacheRead: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 }
})

const call = (timestamp: number) =>
  new Trace.Call({
    operation: "generateText",
    usage: Option.some(usage),
    outcome: "success",
    durationMs: 1,
    timestamp
  })

describe("Trace isolation", () => {
  it.effect("isolates interleaved concurrent nested siblings while retaining all calls in the parent", () =>
    Effect.gen(function*() {
      const firstReady = yield* Deferred.make<void>()
      const secondReady = yield* Deferred.make<void>()
      const nested = yield* Trace.withCalls(
        Effect.all(
          Arr.make(
            Trace.withCalls(
              Effect.gen(function*() {
                yield* Trace.appendCall(call(1))
                yield* Deferred.succeed(firstReady, undefined)
                yield* Deferred.await(secondReady)
                yield* Trace.appendCall(call(4))
              })
            ),
            Trace.withCalls(
              Effect.gen(function*() {
                yield* Deferred.await(firstReady)
                yield* Trace.appendCall(call(2))
                yield* Deferred.succeed(secondReady, undefined)
                yield* Trace.appendCall(call(3))
              })
            )
          ),
          { concurrency: "unbounded" }
        )
      )
      const siblingResults = nested[0]
      const firstSibling = Option.getOrThrow(Arr.get(siblingResults, 0))
      const secondSibling = Option.getOrThrow(Arr.get(siblingResults, 1))
      const firstTimestamps = Arr.map(firstSibling[1], (observed) => observed.timestamp)
      const secondTimestamps = Arr.map(secondSibling[1], (observed) => observed.timestamp)
      const parentTimestamps = Arr.map(nested[1], (observed) => observed.timestamp)

      expect(firstTimestamps).toEqual(Arr.make(1, 4))
      expect(secondTimestamps).toEqual(Arr.make(2, 3))
      expect(Arr.length(parentTimestamps)).toBe(4)
      expect(Arr.every(Arr.make(1, 2, 3, 4), (timestamp) => Arr.contains(parentTimestamps, timestamp))).toBe(true)
    }))

  it.effect("keeps concurrent top-level scopes independent", () =>
    Effect.gen(function*() {
      const scopes = yield* Effect.forEach(
        Arr.make(11, 22),
        (timestamp) => Trace.withCalls(Trace.appendCall(call(timestamp))),
        { concurrency: "unbounded" }
      )
      const first = Option.getOrThrow(Arr.get(scopes, 0))
      const second = Option.getOrThrow(Arr.get(scopes, 1))
      const firstCall = Option.getOrThrow(Arr.head(first[1]))
      const secondCall = Option.getOrThrow(Arr.head(second[1]))

      expect(Arr.length(first[1])).toBe(1)
      expect(Arr.length(second[1])).toBe(1)
      expect(firstCall.timestamp).toBe(11)
      expect(secondCall.timestamp).toBe(22)
    }))
})
