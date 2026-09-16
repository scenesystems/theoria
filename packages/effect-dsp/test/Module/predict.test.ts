/**
 * Module.predict contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { ModuleParams } from "@scenesystems/effect-dsp/contracts"
import { Demo } from "@scenesystems/effect-dsp/Example"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Effect, Layer, Option, Ref, Schedule, Schema, TestClock } from "effect"

const makeQaSignature = () =>
  Signature.make(
    "Answer questions with concise facts",
    {
      question: Signature.describe(Schema.String, "The question to answer")
    },
    {
      answer: Signature.describe(Schema.String, "A concise factual answer")
    }
  )

describe("Module.predict", () => {
  it.effect("renders schema-encoded structured inputs without replacing them with placeholders", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Render facts", {
        facts: Schema.Struct({ count: Schema.NumberFromString, countries: Schema.Array(Schema.String) }),
        empty: Schema.Null
      }, { answer: Schema.String })
      const module = yield* Module.predict("encoded-input", signature)
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed({ answer: "France" }))
      const [result, entries] = yield* Trace.withTracing(module.forward({
        facts: { count: 17, countries: Arr.make("France", "Japan") },
        empty: null
      })).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      const call = yield* Ref.get(mock.calls).pipe(Effect.flatMap(Arr.head))
      const entry = yield* Arr.head(entries)
      expect(result.answer).toBe("France")
      expect(call.prompt).toContain("[[ ## facts ## ]]\n{\"count\":\"17\",\"countries\":[\"France\",\"Japan\"]}")
      expect(call.prompt).toContain("[[ ## empty ## ]]\nnull")
      expect(entry.prompt).toBe(call.prompt)
      expect(entry.input).toEqual({ facts: { count: "17", countries: Arr.make("France", "Japan") }, empty: null })
    }))

  it.effect("stops after the default three parse retries and carries diagnostic feedback", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(MockLanguageModel.fixed("malformed output"))
      const module = yield* Module.predict("qa", qa)
      yield* Ref.update(module.params, (params) => new ModuleParams({ ...params, outputStrategy: "text" }))
      const fiber = yield* module.forward({ question: "Capital?" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip,
        Effect.fork
      )
      yield* TestClock.adjust("2 seconds")
      const failure = yield* Effect.fromFiber(fiber)
      const calls = yield* Ref.get(mock.calls)
      const lastCall = yield* Arr.last(calls)

      expect(failure._tag).toBe("ParseOutputError")
      expect(calls).toHaveLength(4)
      expect(lastCall.prompt).toContain("Parse error (2)")
      expect(lastCall.prompt).toContain("Expected marker [[ ## answer ## ]] was not found")
    }))

  it.effect("uses structured path when outputStrategy is auto and demos are empty", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const module = yield* Module.predict("qa", qa)

      const result = yield* module.forward({
        question: "What is the capital of France?"
      }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      const calls = yield* Ref.get(mock.calls)

      expect(result).toEqual({ answer: "Paris" })
      expect(calls).toHaveLength(1)
      expect((yield* Arr.head(calls)).method).toBe("generateObject")
    }))

  it.effect("uses text path when outputStrategy is auto and demos are present", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed("[[ ## answer ## ]]\nParis")
      )
      const module = yield* Module.predict("qa", qa)

      yield* Ref.update(
        module.params,
        (params) =>
          new ModuleParams({
            instructions: params.instructions,
            outputStrategy: "auto",
            demos: Arr.make(
              new Demo({
                input: { question: "What is the capital of France?" },
                output: { answer: "Paris" }
              })
            )
          })
      )

      const result = yield* module.forward({
        question: "What is the capital of Japan?"
      }).pipe(
        Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
      )

      const calls = yield* Ref.get(mock.calls)

      expect(result).toEqual({ answer: "Paris" })
      expect(calls).toHaveLength(1)
      expect((yield* Arr.head(calls)).method).toBe("generateText")
    }))

  it.effect("records trace entries with prompt and response metadata when tracing is enabled", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const module = yield* Module.predict("qa", qa)

      const [result, entries] = yield* Trace.withTracing(
        module.forward({ question: "What is the capital of France?" }).pipe(
          Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
        )
      )
      const entry = yield* Arr.head(entries)

      expect(result).toEqual({ answer: "Paris" })
      expect(entries).toHaveLength(1)
      expect(entry.moduleName).toBe("qa")
      expect(entry.signatureDescription).toBe("Answer questions with concise facts")
      expect(entry.prompt).toContain("What is the capital of France?")
      expect(entry.rawResponse).toBe("{\"answer\":\"Paris\"}")
      expect(entry.durationMs).toBeGreaterThanOrEqual(0)
      expect(entry.timestamp).toBeGreaterThanOrEqual(0)
      expect(entry.score).toEqual(Option.none())
    }))

  it.effect("retries parse failures in text mode before succeeding", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence(Arr.make(
          "malformed output",
          "[[ ## answer ## ]]\nParis"
        ))
      )
      const module = yield* Module.predict("qa", qa)

      yield* Ref.update(
        module.params,
        (params) =>
          new ModuleParams({
            instructions: params.instructions,
            outputStrategy: "auto",
            demos: Arr.make(
              new Demo({
                input: { question: "What is the capital of France?" },
                output: { answer: "Paris" }
              })
            )
          })
      )

      const resultFiber = yield* Effect.fork(
        module.forward({
          question: "What is the capital of Japan?"
        }).pipe(
          Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
        )
      )

      yield* TestClock.adjust("2 seconds")

      const result = yield* Effect.fromFiber(resultFiber)
      const calls = yield* Ref.get(mock.calls)

      expect(result).toEqual({ answer: "Paris" })
      expect(calls).toHaveLength(2)
      expect(Arr.map(calls, (call) => call.method)).toEqual(Arr.make("generateText", "generateText"))
    }))

  it.effect("applies parse policy overrides from predict options", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence(Arr.make(
          "malformed output",
          "[[ ## answer ## ]]\nParis"
        ))
      )

      const module = yield* Module.predict("qa", qa, {
        policy: {
          parse: {
            maxRetries: 1,
            retrySchedule: (maxRetries) =>
              Schedule.intersect(
                Schedule.spaced("1 second"),
                Schedule.recurs(maxRetries)
              ),
            feedbackTemplate: () => "CUSTOM_PARSE_FEEDBACK"
          }
        }
      })

      yield* Ref.update(
        module.params,
        (params) =>
          new ModuleParams({
            instructions: params.instructions,
            outputStrategy: "auto",
            demos: Arr.make(
              new Demo({
                input: { question: "What is the capital of France?" },
                output: { answer: "Paris" }
              })
            )
          })
      )

      const resultFiber = yield* Effect.fork(
        module.forward({
          question: "What is the capital of Japan?"
        }).pipe(
          Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
        )
      )

      yield* TestClock.adjust("500 millis")

      const callsBeforeRetry = yield* Ref.get(mock.calls)
      expect(callsBeforeRetry).toHaveLength(1)

      yield* TestClock.adjust("1 second")

      const result = yield* Effect.fromFiber(resultFiber)
      const callsAfterRetry = yield* Ref.get(mock.calls)

      expect(result).toEqual({ answer: "Paris" })
      expect(callsAfterRetry).toHaveLength(2)
      expect((yield* Arr.get(callsAfterRetry, 1)).prompt).toContain("CUSTOM_PARSE_FEEDBACK")
    }))
})
