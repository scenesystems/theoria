import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import type * as OpenAiSchema from "@effect/ai-openai/OpenAiSchema"
import { describe, expect, it } from "@effect/vitest"
import type * as AiResponse from "effect/ai/Response"
import * as Arr from "effect/Array"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"

import * as OpenAiUsage from "@scenesystems/effect-inference/OpenAiUsage"
import { encodeSse, jsonHttpClient, sseHttpClient } from "./fixtures/usage.js"

const usage = {
  input_tokens: 17,
  input_tokens_details: { cached_tokens: 3 },
  output_tokens: 5,
  output_tokens_details: { reasoning_tokens: 7 },
  total_tokens: 29
}

const response = (responseUsage: unknown) => ({
  id: "response-1",
  object: "response",
  status: "completed",
  created_at: 0,
  error: null,
  incomplete_details: null,
  output: Arr.empty(),
  instructions: null,
  usage: responseUsage,
  parallel_tool_calls: true,
  model: "gpt-4o",
  tools: Arr.empty(),
  tool_choice: "auto",
  metadata: null,
  temperature: null,
  top_p: null
})

const makeClient = (httpClient: HttpClient.HttpClient) =>
  OpenAiClient.make({}).pipe(
    Effect.provideService(HttpClient.HttpClient, httpClient)
  )

describe("OpenAiUsage.observe", () => {
  it.effect("projects disjoint token components and retains the raw report through encoding", () =>
    Effect.gen(function*() {
      const raw = { ...usage, output_tokens: 12 }
      const observation = yield* Schema.decodeEffect(OpenAiUsage.Observation)(raw)
      expect(observation.usage.inputTokens).toMatchObject({ total: 17, uncached: 14, cacheRead: 3 })
      expect(observation.usage.outputTokens).toEqual({ total: 12, text: 5, reasoning: 7 })
      expect(yield* Schema.encodeEffect(OpenAiUsage.Observation)(observation)).toEqual(raw)
    }))
  it.effect("observes all five native Responses API counters", () =>
    Effect.scoped(Effect.gen(function*() {
      const observed = yield* Ref.make(Arr.empty<AiResponse.Usage>())
      const rawObserved = yield* Ref.make(Option.none<OpenAiSchema.ResponseUsage>())
      const nativeClient = yield* makeClient(jsonHttpClient(response(usage)))
      const decorated = OpenAiUsage.observe(
        nativeClient,
        (usage, raw) =>
          Ref.update(observed, Arr.append(usage)).pipe(
            Effect.andThen(Ref.set(rawObserved, raw))
          )
      )

      const [result] = yield* decorated.createResponse({ model: "gpt-4o", input: "hello" })
      const usages = yield* Ref.get(observed)
      const observedUsage = Option.getOrThrow(Arr.head(usages))
      const raw = Option.getOrThrow(yield* Ref.get(rawObserved))

      expect(result.id).toBe("response-1")
      expect(raw).toBe(result.usage)
      expect(Arr.length(usages)).toBe(1)
      expect(observedUsage.inputTokens.total).toBe(17)
      expect(observedUsage.inputTokens.uncached).toBe(14)
      expect(observedUsage.inputTokens.cacheRead).toBe(3)
      expect(observedUsage.outputTokens.total).toBe(5)
      expect(observedUsage.outputTokens.text).toBeUndefined()
      expect(observedUsage.outputTokens.reasoning).toBe(7)
    })))

  it.effect("preserves terminal stream chunks and explicit zero counters", () =>
    Effect.scoped(Effect.gen(function*() {
      const zeroUsage = {
        input_tokens: 0,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens: 0,
        output_tokens_details: { reasoning_tokens: 0 },
        total_tokens: 0
      }
      const events = Chunk.make(
        { type: "response.created", sequence_number: 0, response: response(null) },
        { type: "response.completed", sequence_number: 1, response: response(zeroUsage) }
      )
      const observed = yield* Ref.make(Arr.empty<AiResponse.Usage>())
      const nativeClient = yield* makeClient(sseHttpClient(encodeSse(events)))
      const decorated = OpenAiUsage.observe(
        nativeClient,
        (usage) => Ref.update(observed, Arr.append(usage))
      )

      const [, stream] = yield* decorated.createResponseStream({
        model: "gpt-4o",
        input: "hello"
      })
      const chunks = yield* stream.pipe(Stream.runCollect)
      const usages = yield* Ref.get(observed)
      const observedUsage = Option.getOrThrow(Arr.head(usages))

      expect(Arr.map(chunks, (event) => event.type)).toEqual(
        Arr.make("response.created", "response.completed")
      )
      expect(Arr.length(usages)).toBe(1)
      expect(observedUsage.inputTokens.total).toBe(0)
      expect(observedUsage.inputTokens.cacheRead).toBe(0)
      expect(observedUsage.outputTokens.total).toBe(0)
      expect(observedUsage.outputTokens.reasoning).toBe(0)
    })))

  it.effect("does not invent detail counters when OpenAI omits them", () =>
    Effect.scoped(Effect.gen(function*() {
      const observed = yield* Ref.make(Option.none<AiResponse.Usage>())
      const nativeClient = yield* makeClient(jsonHttpClient(response({
        input_tokens: 17,
        output_tokens: 5,
        total_tokens: 22
      })))
      yield* OpenAiUsage.observe(nativeClient, (current) => Ref.set(observed, Option.some(current)))
        .createResponse({ model: "gpt-4o", input: "hello" })
      const current = Option.getOrThrow(yield* Ref.get(observed))

      expect(current.inputTokens.total).toBe(17)
      expect(current.inputTokens.uncached).toBeUndefined()
      expect(current.inputTokens.cacheRead).toBeUndefined()
      expect(current.outputTokens.total).toBe(5)
      expect(current.outputTokens.text).toBeUndefined()
      expect(current.outputTokens.reasoning).toBeUndefined()
    })))

  it.effect("preserves downstream cancellation before terminal usage", () =>
    Effect.scoped(Effect.gen(function*() {
      const events = Chunk.make(
        { type: "response.created", sequence_number: 0, response: response(null) },
        { type: "response.completed", sequence_number: 1, response: response(usage) }
      )
      const observed = yield* Ref.make(Arr.empty<AiResponse.Usage>())
      const nativeClient = yield* makeClient(sseHttpClient(encodeSse(events)))
      const decorated = OpenAiUsage.observe(
        nativeClient,
        (usage) => Ref.update(observed, Arr.append(usage))
      )

      const [, stream] = yield* decorated.createResponseStream({
        model: "gpt-4o",
        input: "hello"
      })
      const chunks = yield* stream.pipe(
        Stream.take(1),
        Stream.runCollect
      )
      const usages = yield* Ref.get(observed)

      expect(Arr.map(chunks, (event) => event.type)).toEqual(Arr.make("response.created"))
      expect(Arr.length(usages)).toBe(0)
    })))

  it.effect.each(Arr.make(1, 2))(
    "retains non-terminal usage after consuming %i events",
    (count) =>
      Effect.scoped(Effect.gen(function*() {
        const events = Chunk.make(
          { type: "response.in_progress", sequence_number: 0, response: response(usage) },
          { type: "response.completed", sequence_number: 1, response: response(null) }
        )
        const observed = yield* Ref.make(Arr.empty<AiResponse.Usage>())
        const nativeClient = yield* makeClient(sseHttpClient(encodeSse(events)))
        const decorated = OpenAiUsage.observe(nativeClient, (usage) => Ref.update(observed, Arr.append(usage)))

        const [, stream] = yield* decorated.createResponseStream({ model: "gpt-4o", input: "hello" })
        yield* stream.pipe(
          Stream.take(count),
          Stream.runDrain
        )
        const usages = yield* Ref.get(observed)
        const received = Option.getOrThrow(Arr.head(usages))

        expect(Arr.length(usages)).toBe(1)
        expect(received.inputTokens.total).toBe(17)
        expect(received.outputTokens.reasoning).toBe(7)
      }))
  )
})
