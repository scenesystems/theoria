/**
 * Module.predict contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Response from "@effect/ai/Response"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, HashMap, Layer, Option, Ref, Schedule, TestClock } from "effect"
import { ModuleParams } from "effect-dsp/contracts"
import { Demo } from "effect-dsp/Example"
import * as Module from "effect-dsp/Module"
import { MockLanguageModel } from "effect-dsp/test"
import * as Trace from "effect-dsp/Trace"
import { conciseFactsQaSignature } from "../helpers/qa-signatures.js"

const emptyUsage = new Response.Usage({
  inputTokens: undefined,
  outputTokens: undefined,
  totalTokens: undefined,
  reasoningTokens: undefined,
  cachedInputTokens: undefined
})

const malformedStructuredResponse = Arr.make(
  Response.textPart({ text: "{\"answer\":\"Par", metadata: {} }),
  Response.finishPart({
    reason: "stop",
    usage: emptyUsage,
    metadata: {}
  })
)

describe("Module.predict", () => {
  it("exposes deterministic parse policy defaults", () => {
    const policy = Module.PredictPolicy.make()

    expect(policy.parse.maxRetries).toBe(Module.DEFAULT_PARSE_MAX_RETRIES)
    expect(policy.parse.retrySchedule).toBe(Module.defaultParseRetrySchedule)
    expect(policy.parse.feedbackTemplate).toBe(Module.defaultParseFeedbackTemplate)
  })

  it.effect("creates a branded module with forward/ref/signature/name contracts", () =>
    Effect.gen(function*() {
      const qa = yield* conciseFactsQaSignature
      const module = yield* Module.predict("qa", qa)

      expect(module._tag).toBe("Module")
      expect(module.name).toBe("qa")
      expect(module.signature).toEqual(qa)
      expect(HashMap.size(module.subModules)).toBe(0)
      expect(typeof module.forward).toBe("function")
    }))

  it.effect("uses structured path when outputStrategy is auto and demos are empty", () =>
    Effect.gen(function*() {
      const qa = yield* conciseFactsQaSignature
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
      expect(calls[0]?.method).toBe("generateObject")
    }))

  it.effect("uses text path when outputStrategy is auto and demos are present", () =>
    Effect.gen(function*() {
      const qa = yield* conciseFactsQaSignature
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
            demos: [
              new Demo({
                input: { question: "What is the capital of France?" },
                output: { answer: "Paris" }
              })
            ]
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
      expect(calls[0]?.method).toBe("generateText")
    }))

  it.effect("records trace entries with prompt and response metadata when tracing is enabled", () =>
    Effect.gen(function*() {
      const qa = yield* conciseFactsQaSignature
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ answer: "Paris" })
      )
      const module = yield* Module.predict("qa", qa)

      const traced = yield* Trace.withTracing(
        module.forward({ question: "What is the capital of France?" }).pipe(
          Effect.provide(Layer.succeed(LanguageModel.LanguageModel, mock.service))
        )
      )

      const result = traced[0]
      const entries = traced[1]
      const entry = Arr.head(entries)

      expect(result).toEqual({ answer: "Paris" })
      expect(entries).toHaveLength(1)

      yield* Option.match(entry, {
        onSome: (traceEntry) =>
          Effect.sync(() => {
            expect(traceEntry.moduleName).toBe("qa")
            expect(traceEntry.signatureDescription).toBe("Answer questions with concise facts")
            expect(traceEntry.prompt.length > 0).toBe(true)
            expect(traceEntry.rawResponse.length > 0).toBe(true)
            expect(traceEntry.durationMs >= 0).toBe(true)
            expect(traceEntry.timestamp >= 0).toBe(true)
            expect(Option.isNone(traceEntry.score)).toBe(true)
          }),
        onNone: () => Effect.die("Expected trace entry")
      })
    }))

  it.effect("retries parse failures in text mode before succeeding", () =>
    Effect.gen(function*() {
      const qa = yield* conciseFactsQaSignature
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          "malformed output",
          "[[ ## answer ## ]]\nParis"
        ])
      )
      const module = yield* Module.predict("qa", qa)

      yield* Ref.update(
        module.params,
        (params) =>
          new ModuleParams({
            instructions: params.instructions,
            outputStrategy: "auto",
            demos: [
              new Demo({
                input: { question: "What is the capital of France?" },
                output: { answer: "Paris" }
              })
            ]
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
      expect(calls[0]?.method).toBe("generateText")
      expect(calls[1]?.method).toBe("generateText")
    }))

  it.effect("retries malformed structured output before succeeding", () =>
    Effect.gen(function*() {
      const qa = yield* conciseFactsQaSignature
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          malformedStructuredResponse,
          { answer: "Paris" }
        ])
      )

      const module = yield* Module.predict("qa", qa, {
        policy: {
          parse: {
            maxRetries: 1,
            retrySchedule: (maxRetries) =>
              Schedule.intersect(
                Schedule.spaced("1 second"),
                Schedule.recurs(maxRetries)
              )
          }
        }
      })

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
      expect(callsBeforeRetry[0]?.method).toBe("generateObject")

      yield* TestClock.adjust("1 second")

      const result = yield* Effect.fromFiber(resultFiber)
      const callsAfterRetry = yield* Ref.get(mock.calls)

      expect(result).toEqual({ answer: "Paris" })
      expect(callsAfterRetry).toHaveLength(2)
      expect(callsAfterRetry[1]?.method).toBe("generateObject")
    }))

  it.effect("applies parse policy overrides from predict options", () =>
    Effect.gen(function*() {
      const qa = yield* conciseFactsQaSignature
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence([
          "malformed output",
          "[[ ## answer ## ]]\nParis"
        ])
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
            demos: [
              new Demo({
                input: { question: "What is the capital of France?" },
                output: { answer: "Paris" }
              })
            ]
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
      expect(callsAfterRetry[1]?.prompt).toContain("CUSTOM_PARSE_FEEDBACK")
    }))
})
