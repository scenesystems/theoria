/**
 * Module.predict contracts.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import { describe, expect, it } from "@effect/vitest"
import { Demonstration } from "@scenesystems/effect-dsp/Demonstration"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import { decode } from "@scenesystems/effect-dsp/Payload"
import * as Signature from "@scenesystems/effect-dsp/Signature"
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
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ answer: "France" }))
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
      expect(yield* decode(Schema.encodedSchema(signature.inputSchema), entry.input)).toEqual({
        facts: { count: "17", countries: Arr.make("France", "Japan") },
        empty: null
      })
    }))

  it.effect("preserves structured demonstrations and distinguishes omitted optional input from present text", () =>
    Effect.gen(function*() {
      const signature = yield* Signature.make("Render optional facts", {
        question: Schema.String,
        context: Schema.optional(Schema.String)
      }, { facts: Schema.Struct({ count: Schema.NumberFromString }) })
      const module = yield* Module.predict("demo-input", signature)
      yield* Ref.update(module.params, (params) =>
        new ModuleParameters({
          ...params,
          outputStrategy: "structured",
          demos: Arr.make(
            new Demonstration({
              input: { question: "example question" },
              output: { facts: { count: "3" } }
            })
          )
        }))
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed({ facts: { count: "7" } }))
      const [withoutContext, withContext] = yield* Effect.all(Arr.make(
        module.forward({ question: "without context" }),
        module.forward({ question: "with context", context: "literal context" })
      )).pipe(Effect.provideService(LanguageModel.LanguageModel, mock.service))
      const calls = yield* Ref.get(mock.calls)
      const absent = yield* Arr.head(calls)
      const present = yield* Arr.get(calls, 1)
      expect(withoutContext).toEqual({ facts: { count: 7 } })
      expect(withContext).toEqual({ facts: { count: 7 } })
      expect(absent.prompt).toContain("[[ ## facts ## ]]\n{\"count\":\"3\"}")
      expect(absent.prompt).not.toContain("[[ ## context ## ]]")
      expect(present.prompt).toContain("[[ ## context ## ]]\nliteral context")
    }))

  it.effect("stops after the default three parse retries and carries diagnostic feedback", () =>
    Effect.gen(function*() {
      const qa = yield* makeQaSignature()
      const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed("malformed output"))
      const module = yield* Module.predict("qa", qa)
      yield* Ref.update(module.params, (params) => new ModuleParameters({ ...params, outputStrategy: "text" }))
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
        MockLanguageModel.succeed({ answer: "Paris" })
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
        MockLanguageModel.succeed("[[ ## answer ## ]]\nParis")
      )
      const module = yield* Module.predict("qa", qa)

      yield* Ref.update(
        module.params,
        (params) =>
          new ModuleParameters({
            instructions: params.instructions,
            outputStrategy: "auto",
            demos: Arr.make(
              new Demonstration({
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
        MockLanguageModel.succeed({ answer: "Paris" })
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
          new ModuleParameters({
            instructions: params.instructions,
            outputStrategy: "auto",
            demos: Arr.make(
              new Demonstration({
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
          new ModuleParameters({
            instructions: params.instructions,
            outputStrategy: "auto",
            demos: Arr.make(
              new Demonstration({
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
