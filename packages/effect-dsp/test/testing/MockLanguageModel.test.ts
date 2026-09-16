/**
 * Behavioral tests for the public in-memory language-model test double.
 */
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Prompt from "@effect/ai/Prompt"
import * as Response from "@effect/ai/Response"
import { describe, expect, it } from "@effect/vitest"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"
import { Array as Arr, Chunk, Effect, Order, Ref, Schema, String } from "effect"

const TextEnvelope = Schema.Struct({ value: Schema.String })

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
      const roundTripMock = yield* MockLanguageModel.make(MockLanguageModel.fixed(value))
      const response = yield* LanguageModel.generateObject({
        prompt: "encode",
        schema: TextEnvelope
      }).pipe(Effect.provideService(LanguageModel.LanguageModel, roundTripMock.service))
      const expectedJson = yield* Schema.encode(Schema.parseJson(TextEnvelope))(value)

      expect(response.value).toEqual(value)
      expect(response.text).toBe(expectedJson)

      const rejectingMock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed(() => "not JSON")
      )
      const rejection = yield* LanguageModel.generateObject({
        prompt: "reject",
        schema: TextEnvelope
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, rejectingMock.service),
        Effect.flip
      )

      expect(rejection._tag).toBe("UnknownError")

      const invalidSchemaMock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed({ value: 42 })
      )
      const invalidSchema = yield* LanguageModel.generateObject({
        prompt: "validate",
        schema: TextEnvelope
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, invalidSchemaMock.service),
        Effect.flip
      )

      expect(invalidSchema._tag).toBe("MalformedOutput")
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

      expect(Arr.sort(concurrent, Order.string)).toEqual(Arr.sort(expected, Order.string))
      expect(afterConcurrent).toBe("delta")
    }))

  it.effect("preserves native finish parts and every supplied usage counter", () =>
    Effect.gen(function*() {
      const usage = new Response.Usage({
        inputTokens: 11,
        outputTokens: 7,
        totalTokens: 23,
        reasoningTokens: 5,
        cachedInputTokens: 3
      })
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed(
          Arr.make(
            Response.textPart({ text: "retained", metadata: {} }),
            Response.finishPart({ reason: "length", usage, metadata: {} })
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
        MockLanguageModel.fixed(Arr.of(Response.textPart({ text: "completed", metadata: {} })))
      )
      const completed = yield* LanguageModel.generateText({ prompt: "finish" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, unfinishedMock.service)
      )

      expect(
        Arr.make(
          completed.usage.inputTokens,
          completed.usage.outputTokens,
          completed.usage.totalTokens,
          completed.usage.reasoningTokens,
          completed.usage.cachedInputTokens
        )
      ).toEqual(Arr.make(undefined, undefined, undefined, undefined, undefined))
    }))

  it.effect("rejects malformed raw provider response arrays", () =>
    Effect.gen(function*() {
      const mock = yield* MockLanguageModel.make(
        MockLanguageModel.fixed(Arr.of({ type: "text", text: 42 }))
      )
      const failure = yield* LanguageModel.generateText({ prompt: "invalid provider output" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, mock.service),
        Effect.flip
      )

      expect(failure._tag).toBe("UnknownError")
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
      const failing = yield* MockLanguageModel.make(MockLanguageModel.failing("expected"))
      const empty = yield* MockLanguageModel.make(MockLanguageModel.sequence(Arr.empty()))
      const failingError = yield* LanguageModel.generateText({ prompt: "fail" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, failing.service),
        Effect.flip
      )
      const emptyError = yield* LanguageModel.generateText({ prompt: "empty" }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, empty.service),
        Effect.flip
      )

      expect(failingError._tag).toBe("UnknownError")
      expect(emptyError._tag).toBe("UnknownError")
    }))
})
