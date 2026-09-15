/**
 * Per-invocation call observation contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Response from "@effect/ai/Response"
import { describe, expect, it } from "@effect/vitest"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import {
  Array as Arr,
  Cause,
  Data,
  Deferred,
  Effect,
  Equal,
  Exit,
  Fiber,
  Number,
  Option,
  Ref,
  Schema,
  Tuple
} from "effect"

import { trackCall } from "../../src/Trace/call.js"

const Calls = Schema.Array(Trace.Call)
type Calls = typeof Calls.Type

class ProviderFailure extends Data.TaggedError("ProviderFailure")<{
  readonly code: string
}> {}

class ProviderDefect extends Data.TaggedError("ProviderDefect")<{
  readonly detail: string
}> {}

const earlyUsage = new Response.Usage({
  inputTokens: 17,
  outputTokens: 5,
  totalTokens: 29,
  reasoningTokens: 7,
  cachedInputTokens: 3
})

const fallbackUsage = new Response.Usage({
  inputTokens: 90,
  outputTokens: 40,
  totalTokens: 140,
  reasoningTokens: 10,
  cachedInputTokens: 0
})

const concurrentUsage = new Response.Usage({
  inputTokens: 3,
  outputTokens: 11,
  totalTokens: 21,
  reasoningTokens: 7,
  cachedInputTokens: 2
})

const callByOperation = (
  calls: Calls,
  operation: Trace.Call["operation"]
) => Arr.findFirst(calls, (call) => Equal.equals(call.operation, operation))

describe("Trace calls", () => {
  it.effect("preserves a typed failure cause while retaining early usage", () =>
    Effect.gen(function*() {
      const failure = new ProviderFailure({ code: "provider-failure" })
      const scoped = yield* Trace.withCalls(
        Effect.exit(
          trackCall(
            "generateObject",
            Trace.observeUsage(earlyUsage).pipe(Effect.zipRight(Effect.fail(failure))),
            () => fallbackUsage
          )
        )
      )
      const exit = Tuple.getFirst(scoped)
      const observed = yield* Arr.head(Tuple.getSecond(scoped))
      const cause = yield* Exit.causeOption(exit)
      const observedFailure = yield* Cause.failureOption(cause)

      expect(observed.outcome).toBe("failure")
      expect(Option.contains(observed.usage, earlyUsage)).toBe(true)
      expect(Equal.equals(cause, Cause.fail(failure))).toBe(true)
      expect(observedFailure).toBe(failure)
    }))

  it.effect("preserves defects and records their terminal call", () =>
    Effect.gen(function*() {
      const defect = new ProviderDefect({ detail: "provider invariant" })
      const scoped = yield* Trace.withCalls(
        Effect.exit(trackCall("generateText", Effect.die(defect), () => fallbackUsage))
      )
      const exit = Tuple.getFirst(scoped)
      const observed = yield* Arr.head(Tuple.getSecond(scoped))
      const cause = yield* Exit.causeOption(exit)
      const observedDefect = yield* Cause.dieOption(cause)

      expect(observed.outcome).toBe("failure")
      expect(Option.isNone(observed.usage)).toBe(true)
      expect(Cause.isDie(cause)).toBe(true)
      expect(observedDefect).toBe(defect)
    }))

  it.effect("retains early usage when an in-flight call is interrupted", () =>
    Effect.gen(function*() {
      const usageObserved = yield* Deferred.make<void>()
      const scoped = yield* Trace.withCalls(
        Effect.gen(function*() {
          const fiber = yield* Effect.fork(
            trackCall(
              "generateText",
              Trace.observeUsage(earlyUsage).pipe(
                Effect.zipRight(Deferred.succeed(usageObserved, undefined)),
                Effect.zipRight(Effect.never)
              ),
              () => fallbackUsage
            )
          )

          yield* Deferred.await(usageObserved)

          return yield* Fiber.interrupt(fiber)
        })
      )
      const exit = Tuple.getFirst(scoped)
      const observed = yield* Arr.head(Tuple.getSecond(scoped))
      const cause = yield* Exit.causeOption(exit)

      expect(Cause.isInterrupted(cause)).toBe(true)
      expect(observed.outcome).toBe("interrupted")
      expect(Option.contains(observed.usage, earlyUsage)).toBe(true)
    }))

  it.effect("keeps the latest cumulative observation ahead of fallback and appends once", () =>
    Effect.gen(function*() {
      const nativeResponse = new LanguageModel.GenerateTextResponse(Arr.make(
        Response.textPart({ text: "Paris" }),
        Response.finishPart({ reason: "stop", usage: fallbackUsage })
      ))
      const scoped = yield* Trace.withCalls(
        trackCall(
          "generateObject",
          Trace.observeUsage(concurrentUsage).pipe(
            Effect.zipRight(Trace.observeUsage(earlyUsage)),
            Effect.as(nativeResponse)
          ),
          (response) => response.usage
        )
      )
      const [response, selected] = Tuple.getFirst(scoped)
      const calls = Tuple.getSecond(scoped)
      const observed = yield* Arr.head(calls)

      expect(response).toBe(nativeResponse)
      expect(response.text).toBe("Paris")
      expect(response.usage).toBe(fallbackUsage)
      expect(selected).toBe(earlyUsage)
      expect(Arr.length(calls)).toBe(1)
      expect(Option.contains(observed.usage, earlyUsage)).toBe(true)
      expect(Number.greaterThanOrEqualTo(observed.durationMs, 0)).toBe(true)
      expect(Number.greaterThanOrEqualTo(observed.timestamp, 0)).toBe(true)
    }))

  it.effect("keeps interleaved concurrent usage observations call-local", () =>
    Effect.gen(function*() {
      const firstObserved = yield* Deferred.make<void>()
      const secondObserved = yield* Deferred.make<void>()
      const scoped = yield* Trace.withCalls(
        Effect.all(
          Arr.make(
            trackCall(
              "generateObject",
              Trace.observeUsage(earlyUsage).pipe(
                Effect.zipRight(Deferred.succeed(firstObserved, undefined)),
                Effect.zipRight(Deferred.await(secondObserved)),
                Effect.as(fallbackUsage)
              ),
              (usage) => usage
            ),
            trackCall(
              "generateText",
              Deferred.await(firstObserved).pipe(
                Effect.zipRight(Trace.observeUsage(concurrentUsage)),
                Effect.zipRight(Deferred.succeed(secondObserved, undefined)),
                Effect.as(fallbackUsage)
              ),
              (usage) => usage
            )
          ),
          { concurrency: "unbounded", discard: true }
        )
      )
      const calls = Tuple.getSecond(scoped)
      const objectCall = yield* callByOperation(calls, "generateObject")
      const textCall = yield* callByOperation(calls, "generateText")

      expect(Arr.length(calls)).toBe(2)
      expect(Option.contains(objectCall.usage, earlyUsage)).toBe(true)
      expect(Option.contains(textCall.usage, concurrentUsage)).toBe(true)
      expect(Option.contains(objectCall.usage, concurrentUsage)).toBe(false)
      expect(Option.contains(textCall.usage, earlyUsage)).toBe(false)
    }))

  it.effect("keeps nested invocation usage observations call-local", () =>
    Effect.gen(function*() {
      const scoped = yield* Trace.withCalls(
        trackCall(
          "generateObject",
          Effect.gen(function*() {
            yield* Trace.observeUsage(earlyUsage)

            const [response] = yield* trackCall(
              "generateText",
              Trace.observeUsage(concurrentUsage).pipe(Effect.as(fallbackUsage)),
              (usage) => usage
            )

            return response
          }),
          (usage) => usage
        )
      )
      const calls = Tuple.getSecond(scoped)
      const outerCall = yield* callByOperation(calls, "generateObject")
      const innerCall = yield* callByOperation(calls, "generateText")

      expect(Arr.length(calls)).toBe(2)
      expect(Option.contains(outerCall.usage, earlyUsage)).toBe(true)
      expect(Option.contains(innerCall.usage, concurrentUsage)).toBe(true)
      expect(Option.contains(outerCall.usage, concurrentUsage)).toBe(false)
      expect(Option.contains(innerCall.usage, earlyUsage)).toBe(false)
    }))

  it.effect("allows an enclosing onExit finalizer to inspect completed calls", () =>
    Effect.gen(function*() {
      const seen = yield* Ref.make<Calls>(Arr.empty())
      yield* Trace.withCalls(
        trackCall("generateText", Effect.succeed(fallbackUsage), (responseUsage) => responseUsage).pipe(
          Effect.onExit(() => Trace.getCalls.pipe(Effect.flatMap((calls) => Ref.set(seen, calls))))
        )
      )
      const calls = yield* Ref.get(seen)
      const observed = yield* Arr.head(calls)

      expect(Arr.length(calls)).toBe(1)
      expect(observed.outcome).toBe("success")
      expect(observed.usage).toEqual(Option.some(fallbackUsage))
    }))
})
