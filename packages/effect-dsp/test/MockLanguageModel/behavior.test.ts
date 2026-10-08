/**
 * Behavioral contracts for the public in-memory language-model test double.
 */
import { describe, expect, it } from "@effect/vitest"
import { Score } from "@scenesystems/effect-dsp/Metric"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"
import { Array as Arr, Chunk, Effect, Number, Order, Ref, Schema, Stream, String } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Prompt from "effect/ai/Prompt"
import * as Response from "effect/ai/Response"
import * as Tool from "effect/ai/Tool"
import * as Toolkit from "effect/ai/Toolkit"

const TextEnvelope = Schema.Struct({ value: Schema.String })

const LookupFacts = Tool.make("LookupFacts", {
  parameters: Schema.Struct({ question: Schema.String }),
  success: Schema.String
})

describe("MockLanguageModel", () => {
  it.effect("normalizes string, Prompt envelope, and iterable inputs for strategies", () =>
    Effect.gen(function*() {
      const mock = yield* MockLanguageModel.make(MockLanguageModel.map((prompt) => prompt))
      const provideMock = Effect.provideService(LanguageModel.LanguageModel, mock.service)

      const fromString = yield* LanguageModel.generateText({ prompt: "plain" }).pipe(provideMock)
      const fromEnvelope = yield* LanguageModel.generateText({
        prompt: Prompt.fromMessages(
          Arr.make(
            Prompt.systemMessage({ content: "rules" }),
            Prompt.userMessage({
              content: Arr.make(
                Prompt.textPart({ text: "question" }),
                Prompt.filePart({ mediaType: "image/png", data: "aW1hZ2U=" })
              )
            })
          )
        )
      }).pipe(provideMock)
      const fromIterable = yield* LanguageModel.generateText({
        prompt: Chunk.make(
          Prompt.systemMessage({ content: "context" }),
          Prompt.userMessage({ content: Arr.of(Prompt.textPart({ text: "request" })) })
        )
      }).pipe(provideMock)
      const calls = yield* Ref.get(mock.calls)

      expect(Arr.make(fromString.text, fromEnvelope.text, fromIterable.text)).toEqual(
        Arr.make("plain", "rules\n\nquestion", "context\n\nrequest")
      )
      expect(Arr.map(calls, (call) => call.prompt)).toEqual(
        Arr.make("plain", "rules\n\nquestion", "context\n\nrequest")
      )
    }))

  it.effect("round-trips JSON controls and preserves schema and encoding rejection", () =>
    Effect.gen(function*() {
      const value = { value: "quote=\" slash=\\ nul=\u0000 backspace=\b formfeed=\f newline=\n return=\r tab=\t" }
      const roundTripMock = yield* MockLanguageModel.make(MockLanguageModel.succeed(value))
      const response = yield* LanguageModel.generateObject({
        prompt: "encode",
        schema: TextEnvelope
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, roundTripMock.service))
      const expectedJson = yield* Schema.encodeEffect(Schema.fromJsonString(TextEnvelope))(value)

      expect(response.value).toEqual(value)
      expect(response.text).toBe(expectedJson)

      const rejectingMock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed(() => "not JSON")
      )
      const rejection = yield* LanguageModel.generateObject({
        prompt: "reject",
        schema: TextEnvelope
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, rejectingMock.service),
        Effect.flip
      )

      expect(rejection.reason._tag).toBe("StructuredOutputError")

      const invalidSchemaMock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ value: 42 })
      )
      const invalidSchema = yield* LanguageModel.generateObject({
        prompt: "validate",
        schema: TextEnvelope
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, invalidSchemaMock.service),
        Effect.flip
      )

      expect(invalidSchema.reason._tag).toBe("StructuredOutputError")
    }))

  it.effect("rejects lossy object responses instead of manufacturing schema-valid JSON", () =>
    Effect.gen(function*() {
      const schema = Schema.Struct({
        value: Schema.Struct({
          score: Schema.NullOr(Score.fields.value),
          note: Schema.optional(Schema.String)
        })
      })
      const infinity = yield* Effect.fromOption(Number.parse("Infinity"))
      const payloads = Arr.make(
        { value: { score: infinity } },
        { value: { score: 7, note: () => "discarded by JSON" } }
      )
      const failures = yield* Effect.forEach(payloads, (payload) =>
        Effect.gen(function*() {
          const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed(payload))
          const failure = yield* LanguageModel.generateObject({ prompt: "lossless", schema }).pipe(
            Effect.provideService(LanguageModel.LanguageModel, mock.service),
            Effect.flip
          )
          expect(Arr.length(yield* Ref.get(mock.calls))).toBe(0)
          return failure
        }))

      expect(Arr.map(failures, (failure) => failure.reason._tag)).toEqual(
        Arr.make("StructuredOutputError", "StructuredOutputError")
      )
    }))

  it.effect("returns sequence responses in order and repeats the final response", () =>
    Effect.gen(function*() {
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.sequence(Arr.make("first", "final"))
      )
      const generate = LanguageModel.generateText({ prompt: "next" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.map((response) => response.text)
      )
      const responses = yield* Effect.all(Arr.make(generate, generate, generate))

      expect(responses).toEqual(Arr.make("first", "final", "final"))
    }))

  it.effect("claims sequence indexes atomically across concurrent requests", () =>
    Effect.gen(function*() {
      const expected = Arr.make("alpha", "bravo", "charlie", "delta")
      const mock = yield* MockLanguageModel.make(MockLanguageModel.sequence(expected))
      const generate = LanguageModel.generateText({ prompt: "concurrent" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.map((response) => response.text)
      )
      const concurrent = yield* Effect.all(Arr.map(expected, () => generate), {
        concurrency: "unbounded"
      })
      const afterConcurrent = yield* generate

      expect(Arr.sort(concurrent, Order.String)).toEqual(Arr.sort(expected, Order.String))
      expect(afterConcurrent).toBe("delta")
    }))

  it.effect("preserves native finish parts and every supplied usage counter", () =>
    Effect.gen(function*() {
      const usage = new Response.Usage({
        inputTokens: { total: 11, uncached: 8, cacheRead: 3 },
        outputTokens: { total: 12, text: 7, reasoning: 5 }
      })
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed(
          Arr.make(
            Response.makePart("text", { text: "retained", metadata: {} }),
            Response.makePart("finish", { reason: "length", usage, metadata: {} })
          )
        )
      )
      const response = yield* LanguageModel.generateText({ prompt: "usage" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service)
      )

      expect(response.text).toBe("retained")
      expect(response.finishReason).toBe("length")
      expect(response.usage).toEqual(usage)

      const unfinishedMock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed(Arr.of(Response.makePart("text", { text: "completed", metadata: {} })))
      )
      const completed = yield* LanguageModel.generateText({ prompt: "finish" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, unfinishedMock.service)
      )

      expect(
        Arr.make(
          completed.usage.inputTokens.total,
          completed.usage.inputTokens.cacheRead,
          completed.usage.outputTokens.total,
          completed.usage.outputTokens.text,
          completed.usage.outputTokens.reasoning
        )
      ).toEqual(Arr.make(undefined, undefined, undefined, undefined, undefined))
    }))

  it.effect("rejects every malformed raw provider response array as invalid parts", () =>
    Effect.gen(function*() {
      const malformed = Arr.make(
        Arr.of({ type: "text", text: 42 }),
        Arr.of({ type: 42, text: "wrong discriminator type" }),
        Arr.of({ text: "missing discriminator" }),
        Arr.of(42)
      )
      const failures = yield* Effect.forEach(malformed, (payload) =>
        Effect.gen(function*() {
          const mock = yield* MockLanguageModel.make(MockLanguageModel.succeed(payload))

          return yield* LanguageModel.generateText({ prompt: "invalid provider output" }).pipe(
            Effect.provideService(LanguageModel.LanguageModel, mock.service),
            Effect.flip
          )
        }))

      expect(Arr.map(failures, (failure) => failure._tag)).toEqual(
        Arr.make("AiError", "AiError", "AiError", "AiError")
      )
      expect(failures).toMatchObject(Arr.map(malformed, () => ({
        reason: { description: "MockLanguageModel received invalid provider response parts" }
      })))
    }))

  it.effect("rejects unsupported and non-finite text values instead of fabricating text", () =>
    Effect.gen(function*() {
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ answer: "not a text response" })
      )
      const failure = yield* LanguageModel.generateText({ prompt: "unsupported" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )
      const calls = yield* Ref.get(mock.calls)

      expect(failure).toMatchObject({
        _tag: "AiError",
        method: "generateText",
        reason: { description: "MockLanguageModel text responses must be strings, finite numbers, or booleans" }
      })
      expect(Arr.length(calls)).toBe(0)

      const nonFinite = yield* Effect.forEach(Arr.make("NaN", "Infinity", "-Infinity"), (value) =>
        Effect.fromOption(Number.parse(value)))
      const nonFiniteFailures = yield* Effect.forEach(
        nonFinite,
        (value) =>
          Effect.gen(function*() {
            const nonFiniteMock = yield* MockLanguageModel.make(MockLanguageModel.succeed(value))

            return yield* LanguageModel.generateText({ prompt: "non-finite" }).pipe(
              Effect.provideService(LanguageModel.LanguageModel, nonFiniteMock.service),
              Effect.flip
            )
          })
      )

      expect(nonFiniteFailures).toMatchObject(Arr.map(nonFinite, () => ({
        reason: { description: "MockLanguageModel text responses must be strings, finite numbers, or booleans" }
      })))
    }))

  it.effect("preserves valid native structured and tool-call responses", () =>
    Effect.gen(function*() {
      const structuredMock = yield* MockLanguageModel.make(
        MockLanguageModel.succeed({ value: "structured" })
      )
      const structured = yield* LanguageModel.generateObject({
        prompt: "structured",
        schema: TextEnvelope
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, structuredMock.service))
      const toolCall = Response.makePart("tool-call", {
        id: "call-1",
        name: "LookupFacts",
        params: { question: "Where?" },
        providerExecuted: false
      })
      const toolMock = yield* MockLanguageModel.make(MockLanguageModel.succeed(Arr.of(toolCall)))
      const tools = Toolkit.make(LookupFacts)
      const toolkit = yield* tools.pipe(
        Effect.provide(tools.toLayer({ LookupFacts: ({ question }) => Effect.succeed(question) }))
      )
      const toolResponse = yield* LanguageModel.generateText({
        prompt: "tool",
        toolkit,
        disableToolCallResolution: true
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, toolMock.service))

      expect(structured.value).toEqual({ value: "structured" })
      expect(toolResponse.toolCalls).toEqual(Arr.of(toolCall))
      expect(toolResponse.finishReason).toBe("stop")
    }))

  it.effect("keeps fromFunction effectful and installable through layer", () =>
    Effect.gen(function*() {
      const response = yield* LanguageModel.generateText({ prompt: "layer callback" }).pipe(
        Effect.provide(
          MockLanguageModel.layer(
            LanguageModel.LanguageModel,
            MockLanguageModel.fromFunction((prompt) => Effect.succeed(String.toUpperCase(prompt)))
          )
        )
      )

      expect(response.text).toBe("LAYER CALLBACK")
    }))

  it.effect("reports failing and empty-sequence strategies through typed failures", () =>
    Effect.gen(function*() {
      const failing = yield* MockLanguageModel.make(MockLanguageModel.fail("expected"))
      const empty = yield* MockLanguageModel.make(MockLanguageModel.sequence(Arr.empty()))
      const failingError = yield* LanguageModel.generateText({ prompt: "fail" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, failing.service),
        Effect.flip
      )
      const emptyError = yield* LanguageModel.generateText({ prompt: "empty" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, empty.service),
        Effect.flip
      )

      expect(failingError._tag).toBe("AiError")
      expect(emptyError._tag).toBe("AiError")
    }))

  it.effect("fails unsupported streaming through the typed AiError channel", () =>
    Effect.gen(function*() {
      const strategies = Arr.make(
        MockLanguageModel.succeed("unused"),
        MockLanguageModel.fail("expected strategy failure")
      )
      const failures = yield* Effect.forEach(strategies, (strategy) =>
        Effect.gen(function*() {
          const mock = yield* MockLanguageModel.make(strategy)

          return yield* LanguageModel.streamText({ prompt: "stream" }).pipe(
            Stream.runDrain,
            Effect.provideService(LanguageModel.LanguageModel, mock.service),
            Effect.flip
          )
        }))

      expect(Arr.map(failures, (failure) => failure._tag)).toEqual(
        Arr.make("AiError", "AiError")
      )
      expect(failures).toMatchObject(Arr.map(strategies, () => ({
        reason: { description: "MockLanguageModel does not support streamText" }
      })))
    }))
})
