/**
 * Usage evidence through public module execution and native AI responses.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Response from "@effect/ai/Response"
import { describe, expect, it } from "@effect/vitest"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, Match, Option, Ref, Schedule, Schema, String as Str, TestClock } from "effect"

const usage = new Response.Usage({
  inputTokens: 17,
  outputTokens: 5,
  totalTokens: 29,
  reasoningTokens: 7,
  cachedInputTokens: 3
})

const earlierUsage = new Response.Usage({
  inputTokens: 10,
  outputTokens: 2,
  totalTokens: 14,
  reasoningTokens: 2,
  cachedInputTokens: 0
})

const response = (text: string, tokens: Response.Usage) =>
  Arr.make(
    Response.textPart({ text }),
    Response.finishPart({ reason: "stop", usage: tokens })
  )

const signature = Signature.make(
  "Answer a question",
  { question: Schema.String },
  { answer: Schema.String }
)

describe("Module usage evidence", () => {
  it.effect("round-trips both prediction strategies with wire values, selected usage and clock metadata", () =>
    Effect.forEach(Schema.Literal("structured", "text").literals, (outputStrategy) =>
      Effect.gen(function*() {
        yield* TestClock.setTime(1_700_000_000_000)
        const numeric = yield* Signature.make("Answer numeric questions", {
          question: Schema.NumberFromString
        }, { answer: Schema.NumberFromString })
        const module = yield* Module.predict(Str.concat("usage-", outputStrategy), numeric)
        yield* Ref.update(module.params, (params) => new ModuleParameters({ ...params, outputStrategy }))
        const text = Match.value(outputStrategy).pipe(
          Match.when("structured", () => "{\"answer\":\"23\"}"),
          Match.orElse(() => "[[ ## answer ## ]]\n23")
        )
        const mock = yield* MockLanguageModel.make(MockLanguageModel.fromFunction(() =>
          TestClock.adjust(17).pipe(
            Effect.zipRight(Trace.observeUsage(usage)),
            Effect.as(response(text, earlierUsage))
          )
        ))
        const [[[output, entries], calls], aggregate] = yield* Trace.withUsageTracking(
          Trace.withCalls(Trace.withTracing(module.forward({ question: 31 })))
        ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
        const entry = yield* Arr.head(entries)
        const call = yield* Arr.head(calls)
        const codec = Schema.parseJson(Trace.Entry)
        const persisted = yield* Schema.encode(codec)(entry)
        const restored = yield* Schema.decode(codec)(persisted)

        expect(output.answer).toBe(23)
        expect(entries).toHaveLength(1)
        expect(calls).toHaveLength(1)
        expect(entry.moduleName).toBe(Str.concat("usage-", outputStrategy))
        expect(entry.signatureDescription).toBe("Answer numeric questions")
        expect(entry.input).toBe("{\"question\":\"31\"}")
        expect(entry.output).toBe("{\"answer\":\"23\"}")
        expect(entry.prompt).toContain("[[ ## question ## ]]\n31")
        expect(entry.rawResponse).toBe(text)
        expect(entry.usage).toEqual(usage)
        expect(entry.outcome).toBe("completed")
        expect(entry.score).toEqual(Option.none())
        expect(entry.durationMs).toBe(17)
        expect(entry.timestamp).toBe(1_700_000_000_017)
        expect(restored).toEqual(entry)
        expect(call.usage).toEqual(Option.some(usage))
        expect(call.outcome).toBe("success")
        expect(aggregate.tokens).toEqual(usage)
        expect(aggregate.callCount).toBe(1)
      })))

  it.effect("keeps payload projection failures after successful calls with or without collection", () =>
    Effect.forEach(
      Arr.make(
        {
          carrier: "input",
          input: Schema.String.annotations({ equivalence: () => () => false }),
          output: Schema.String
        },
        {
          carrier: "output",
          input: Schema.String,
          output: Schema.String.annotations({ equivalence: () => () => false })
        }
      ),
      ({ carrier, input, output }) =>
        Effect.gen(function*() {
          const contract = yield* Signature.make("Reject trace equivalence", { question: input }, { answer: output })
          const module = yield* Module.predict(Str.concat("projection-", carrier), contract)
          const mock = yield* MockLanguageModel.make(
            MockLanguageModel.succeed(response("{\"answer\":\"Paris\"}", usage))
          )
          const operation = module.forward({ question: "Capital?" }).pipe(
            Effect.provideService(LanguageModel.LanguageModel, mock.service),
            Effect.flip
          )
          const outside = yield* operation
          const [[inside, entries], calls] = yield* Trace.withCalls(Trace.withTracing(operation))
          const call = yield* Arr.head(calls)

          expect(outside._tag).toBe("TraceError")
          expect(outside.message).toBe(Arr.join(Arr.make("Trace ", carrier, " payload failed schema projection"), ""))
          expect(inside).toEqual(outside)
          expect(entries).toHaveLength(0)
          expect(calls).toHaveLength(1)
          expect(call.outcome).toBe("success")
          expect(call.usage).toEqual(Option.some(usage))
          expect(yield* Ref.get(mock.calls)).toHaveLength(2)
        })
    ))

  it.effect("counts every text parse attempt but retains only the successful module entry", () =>
    Effect.gen(function*() {
      const module = yield* Module.predict("retry-usage", yield* signature, {
        policy: { parse: { maxRetries: 1, retrySchedule: Schedule.recurs } }
      })
      yield* Ref.update(module.params, (params) => new ModuleParameters({ ...params, outputStrategy: "text" }))
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
      const entry = yield* Arr.head(entries)

      expect(output.answer).toBe("Paris")
      expect(Arr.length(entries)).toBe(1)
      expect(entry.usage).toEqual(usage)
      expect(Arr.map(calls, (call) => call.usage)).toEqual(Arr.make(Option.some(earlierUsage), Option.some(usage)))
      expect(aggregate.callCount).toBe(2)
      expect(aggregate.tokens).toEqual(
        new Response.Usage({
          inputTokens: 27,
          outputTokens: 7,
          totalTokens: 43,
          reasoningTokens: 9,
          cachedInputTokens: 3
        })
      )
    }))

  it.effect("retains usage when text parsing exhausts its retry budget", () =>
    Effect.gen(function*() {
      const module = yield* Module.predict("exhausted-usage", yield* signature, {
        policy: { parse: { maxRetries: 1, retrySchedule: Schedule.recurs } }
      })
      yield* Ref.update(module.params, (params) => new ModuleParameters({ ...params, outputStrategy: "text" }))
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed(response("malformed", usage)))
      const [[failure, entries], aggregate] = yield* Trace.withUsageTracking(
        Trace.withTracing(Effect.flip(module.forward({ question: "Capital of France?" })))
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))

      expect(failure._tag).toBe("ParseOutputError")
      expect(Arr.isEmptyReadonlyArray(entries)).toBe(true)
      expect(aggregate.callCount).toBe(2)
      expect(aggregate.tokens.totalTokens).toBe(58)
      expect(aggregate.tokens.cachedInputTokens).toBe(6)
    }))

  it.effect("records provider failure without inventing a token report", () =>
    Effect.gen(function*() {
      const module = yield* Module.predict("failed-usage", yield* signature)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fail("offline"))
      const [[failure, calls], aggregate] = yield* Trace.withUsageTracking(
        Trace.withCalls(Effect.flip(module.forward({ question: "Capital of France?" })))
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      const call = yield* Arr.head(calls)

      expect(failure._tag).toBe("UnknownError")
      expect(call.outcome).toBe("failure")
      expect(call.usage).toEqual(Option.none())
      expect(aggregate.callCount).toBe(1)
      expect(Option.fromNullable(aggregate.tokens.totalTokens)).toEqual(Option.none())
    }))
})
