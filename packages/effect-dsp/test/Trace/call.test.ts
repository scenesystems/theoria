/**
 * Per-invocation call observation contracts.
 */
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
  Result,
  Schema
} from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Response from "effect/ai/Response"

import { trackCall } from "../../src/internal/trace/call.js"

const Calls = Schema.Array(Trace.Call)
type Calls = typeof Calls.Type

class ProviderFailure extends Data.TaggedError("ProviderFailure")<{
  readonly code: string
}> {}

class ProviderDefect extends Data.TaggedError("ProviderDefect")<{
  readonly detail: string
}> {}

const earlyUsage = new Response.Usage({
  inputTokens: { total: 17, uncached: 14, cacheRead: 3 },
  outputTokens: { total: 12, text: 5, reasoning: 7 }
})

const fallbackUsage = new Response.Usage({
  inputTokens: { total: 90, uncached: 90, cacheRead: 0 },
  outputTokens: { total: 50, text: 40, reasoning: 10 }
})

const concurrentUsage = new Response.Usage({
  inputTokens: { total: 3, uncached: 1, cacheRead: 2 },
  outputTokens: { total: 18, text: 11, reasoning: 7 }
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
            Trace.observeUsage(earlyUsage).pipe(Effect.andThen(Effect.fail(failure))),
            () => fallbackUsage
          )
        )
      )
      const exit = scoped[0]
      const observed = Option.getOrThrow(Arr.head(scoped[1]))
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isSuccess(exit)) return
      const cause = exit.cause
      const observedFailure = Option.getOrThrow(Cause.findErrorOption(cause))

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
      const exit = scoped[0]
      const observed = Option.getOrThrow(Arr.head(scoped[1]))
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isSuccess(exit)) return
      const cause = exit.cause
      const observedDefect = Result.getOrThrow(Cause.findDefect(cause))

      expect(observed.outcome).toBe("failure")
      expect(Option.isNone(observed.usage)).toBe(true)
      expect(observedDefect).toBe(defect)
    }))

  it.effect("retains early usage when an in-flight call is interrupted", () =>
    Effect.gen(function*() {
      const usageObserved = yield* Deferred.make<void>()
      const scoped = yield* Trace.withCalls(
        Effect.gen(function*() {
          const fiber = yield* Effect.forkChild(
            trackCall(
              "generateText",
              Trace.observeUsage(earlyUsage).pipe(
                Effect.andThen(Deferred.succeed(usageObserved, undefined)),
                Effect.andThen(Effect.never)
              ),
              () => fallbackUsage
            )
          )

          yield* Deferred.await(usageObserved)

          yield* Fiber.interrupt(fiber)
          return yield* Fiber.await(fiber)
        })
      )
      const exit = scoped[0]
      const observed = Option.getOrThrow(Arr.head(scoped[1]))
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isSuccess(exit)) return
      const cause = exit.cause

      expect(Cause.hasInterrupts(cause)).toBe(true)
      expect(observed.outcome).toBe("interrupted")
      expect(Option.contains(observed.usage, earlyUsage)).toBe(true)
    }))

  it.effect("keeps the latest cumulative observation ahead of fallback and appends once", () =>
    Effect.gen(function*() {
      const nativeResponse = new LanguageModel.GenerateTextResponse(Arr.make(
        Response.makePart("text", { text: "Paris" }),
        Response.makePart("finish", { reason: "stop", usage: fallbackUsage })
      ))
      const scoped = yield* Trace.withCalls(
        trackCall(
          "generateObject",
          Trace.observeUsage(concurrentUsage).pipe(
            Effect.andThen(Trace.observeUsage(earlyUsage)),
            Effect.as(nativeResponse)
          ),
          (response) => response.usage
        )
      )
      const [response, selected] = scoped[0]
      const calls = scoped[1]
      const observed = Option.getOrThrow(Arr.head(calls))

      expect(response).toBe(nativeResponse)
      expect(response.text).toBe("Paris")
      expect(response.usage).toBe(fallbackUsage)
      expect(selected).toBe(earlyUsage)
      expect(Arr.length(calls)).toBe(1)
      expect(Option.contains(observed.usage, earlyUsage)).toBe(true)
      expect(Number.isGreaterThanOrEqualTo(observed.durationMs, 0)).toBe(true)
      expect(Number.isGreaterThanOrEqualTo(observed.timestamp, 0)).toBe(true)
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
                Effect.andThen(Deferred.succeed(firstObserved, undefined)),
                Effect.andThen(Deferred.await(secondObserved)),
                Effect.as(fallbackUsage)
              ),
              (usage) => usage
            ),
            trackCall(
              "generateText",
              Deferred.await(firstObserved).pipe(
                Effect.andThen(Trace.observeUsage(concurrentUsage)),
                Effect.andThen(Deferred.succeed(secondObserved, undefined)),
                Effect.as(fallbackUsage)
              ),
              (usage) => usage
            )
          ),
          { concurrency: "unbounded", discard: true }
        )
      )
      const calls = scoped[1]
      const objectCall = Option.getOrThrow(callByOperation(calls, "generateObject"))
      const textCall = Option.getOrThrow(callByOperation(calls, "generateText"))

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
      const calls = scoped[1]
      const outerCall = Option.getOrThrow(callByOperation(calls, "generateObject"))
      const innerCall = Option.getOrThrow(callByOperation(calls, "generateText"))

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
      const observed = Option.getOrThrow(Arr.head(calls))

      expect(Arr.length(calls)).toBe(1)
      expect(observed.outcome).toBe("success")
      expect(observed.usage).toEqual(Option.some(fallbackUsage))
    }))
})
