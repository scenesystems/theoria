/**
 * Lexical trace isolation contracts.
 */
import * as Response from "@effect/ai/Response"
import { describe, expect, it } from "@effect/vitest"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Deferred, Effect, Option, Tuple } from "effect"

const usage = new Response.Usage({
  inputTokens: 1,
  outputTokens: 1,
  totalTokens: 2,
  reasoningTokens: 0,
  cachedInputTokens: 0
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
      const siblingResults = Tuple.getFirst(nested)
      const firstSibling = yield* Arr.get(siblingResults, 0)
      const secondSibling = yield* Arr.get(siblingResults, 1)
      const firstTimestamps = Arr.map(Tuple.getSecond(firstSibling), (observed) => observed.timestamp)
      const secondTimestamps = Arr.map(Tuple.getSecond(secondSibling), (observed) => observed.timestamp)
      const parentTimestamps = Arr.map(Tuple.getSecond(nested), (observed) => observed.timestamp)

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
      const first = yield* Arr.get(scopes, 0)
      const second = yield* Arr.get(scopes, 1)
      const firstCall = yield* Arr.head(Tuple.getSecond(first))
      const secondCall = yield* Arr.head(Tuple.getSecond(second))

      expect(Arr.length(Tuple.getSecond(first))).toBe(1)
      expect(Arr.length(Tuple.getSecond(second))).toBe(1)
      expect(firstCall.timestamp).toBe(11)
      expect(secondCall.timestamp).toBe(22)
    }))
})
