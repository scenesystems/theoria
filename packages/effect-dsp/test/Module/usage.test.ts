/**
 * Usage evidence through public module execution and native AI responses.
 */
import { describe, expect, it } from "@effect/vitest"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, Match, Option, Ref, Schedule, Schema, String as Str } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Response from "effect/ai/Response"

const usage = new Response.Usage({
  inputTokens: { uncached: 14, total: 17, cacheRead: 3, cacheWrite: undefined },
  outputTokens: { total: 12, text: 5, reasoning: 7 }
})

const earlierUsage = new Response.Usage({
  inputTokens: { uncached: 10, total: 10, cacheRead: 0, cacheWrite: undefined },
  outputTokens: { total: 4, text: 2, reasoning: 2 }
})

const response = (text: string, tokens: Response.Usage) =>
  Arr.make(
    Response.TextPart.make({ text, metadata: {} }),
    Response.FinishPart.make({ reason: "stop", usage: tokens, metadata: {} })
  )

const signature = Signature.make(
  "Answer a question",
  { question: Schema.String },
  { answer: Schema.String }
)

describe("Module usage evidence", () => {
  it.effect("retains all counters in successful calls, entries and aggregates", () =>
    Effect.gen(function*() {
      const module = yield* Module.predict("usage", yield* signature)
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed(response("{\"answer\":\"Paris\"}", usage))
      )
      const [[[output, entries], calls], aggregate] = yield* Trace.withUsageTracking(
        Trace.withCalls(Trace.withTracing(module.forward({ question: "Capital of France?" })))
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      const entry = Option.getOrThrow(Arr.head(entries))
      const call = Option.getOrThrow(Arr.head(calls))

      expect(output.answer).toBe("Paris")
      expect(entry.usage).toEqual(usage)
      expect(call.usage).toEqual(Option.some(usage))
      expect(call.outcome).toBe("success")
      expect(aggregate.tokens).toEqual(usage)
      expect(aggregate.callCount).toBe(1)
    }))

  it.effect("counts every text parse attempt but retains only the successful module entry", () =>
    Effect.gen(function*() {
      const module = yield* Module.predict(
        "retry-usage",
        yield* signature,
        new Module.PredictOptions({
          policy: new Module.PredictPolicyOverrides({
            parse: new Module.ParsePolicyOverrides({ maxRetries: 1, retrySchedule: Schedule.recurs })
          })
        })
      )
      yield* Ref.update(module.params, (params) =>
        new ModuleParameters({
          instructions: params.instructions,
          demos: params.demos,
          outputStrategy: "text",
          temperature: params.temperature,
          maxTokens: params.maxTokens
        }))
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fromFunction((prompt) =>
        Match.value(prompt).pipe(
          Match.when(Str.includes("Parse feedback:"), () =>
            Trace.observeUsage(usage).pipe(Effect.as(response("[[ ## answer ## ]]\nParis", earlierUsage)))),
          Match.orElse(() =>
            Trace.observeUsage(earlierUsage).pipe(Effect.as(response("malformed", usage)))
          )
        )
      ))
      const [[[output, entries], calls], aggregate] = yield* Trace.withUsageTracking(
        Trace.withCalls(Trace.withTracing(module.forward({ question: "Capital of France?" })))
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      const entry = Option.getOrThrow(Arr.head(entries))

      expect(output.answer).toBe("Paris")
      expect(Arr.length(entries)).toBe(1)
      expect(entry.usage).toEqual(usage)
      expect(Arr.map(calls, (call) => call.usage)).toEqual(Arr.make(Option.some(earlierUsage), Option.some(usage)))
      expect(aggregate.callCount).toBe(2)
      expect(aggregate.tokens).toEqual(
        new Response.Usage({
          inputTokens: { uncached: 24, total: 27, cacheRead: 3, cacheWrite: undefined },
          outputTokens: { total: 16, text: 7, reasoning: 9 }
        })
      )
    }))

  it.effect("retains usage when text parsing exhausts its retry budget", () =>
    Effect.gen(function*() {
      const module = yield* Module.predict(
        "exhausted-usage",
        yield* signature,
        new Module.PredictOptions({
          policy: new Module.PredictPolicyOverrides({
            parse: new Module.ParsePolicyOverrides({ maxRetries: 1, retrySchedule: Schedule.recurs })
          })
        })
      )
      yield* Ref.update(module.params, (params) =>
        new ModuleParameters({
          instructions: params.instructions,
          demos: params.demos,
          outputStrategy: "text",
          temperature: params.temperature,
          maxTokens: params.maxTokens
        }))
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed(response("malformed", usage)))
      const [[failure, entries], aggregate] = yield* Trace.withUsageTracking(
        Trace.withTracing(Effect.flip(module.forward({ question: "Capital of France?" })))
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))

      expect(failure._tag).toBe("ParseOutputError")
      expect(Arr.length(entries)).toBe(0)
      expect(aggregate.callCount).toBe(2)
      expect(aggregate.tokens.inputTokens.total).toBe(34)
      expect(aggregate.tokens.inputTokens.cacheRead).toBe(6)
    }))

  it.effect("records provider failure without inventing a token report", () =>
    Effect.gen(function*() {
      const module = yield* Module.predict("failed-usage", yield* signature)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fail("offline"))
      const [[failure, calls], aggregate] = yield* Trace.withUsageTracking(
        Trace.withCalls(Effect.flip(module.forward({ question: "Capital of France?" })))
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      const call = Option.getOrThrow(Arr.head(calls))

      expect(failure._tag).toBe("AiError")
      expect(call.outcome).toBe("failure")
      expect(call.usage).toEqual(Option.none())
      expect(aggregate.callCount).toBe(1)
      expect(Option.fromNullishOr(aggregate.tokens.inputTokens.total)).toEqual(Option.none())
    }))
})
