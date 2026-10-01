import type * as Generated from "@effect/ai-openai/Generated"
import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import type * as AiResponse from "@effect/ai/Response"
import * as HttpClient from "@effect/platform/HttpClient"
import { describe, expect, it } from "@effect/vitest"
import * as Arr from "effect/Array"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
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
  it.effect("observes all five native Responses API counters", () =>
    Effect.scoped(Effect.gen(function*() {
      const observed = yield* Ref.make(Arr.empty<AiResponse.Usage>())
      const rawObserved = yield* Ref.make(Option.none<Generated.ResponseUsage>())
      const nativeClient = yield* makeClient(jsonHttpClient(response(usage)))
      const decorated = OpenAiUsage.observe(
        nativeClient,
        (usage, raw) =>
          Ref.update(observed, Arr.append(usage)).pipe(
            Effect.zipRight(Ref.set(rawObserved, raw))
          )
      )

      const result = yield* decorated.createResponse({ model: "gpt-4o", input: "hello" })
      const usages = yield* Ref.get(observed)
      const observedUsage = yield* Arr.head(usages)
      const raw = yield* Ref.get(rawObserved).pipe(Effect.flatten)

      expect(result.id).toBe("response-1")
      expect(raw).toBe(result.usage)
      expect(Arr.length(usages)).toBe(1)
      expect(observedUsage.inputTokens).toBe(17)
      expect(observedUsage.outputTokens).toBe(5)
      expect(observedUsage.totalTokens).toBe(29)
      expect(Option.fromNullable(observedUsage.reasoningTokens)).toEqual(Option.some(7))
      expect(Option.fromNullable(observedUsage.cachedInputTokens)).toEqual(Option.some(3))
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

      const chunks = yield* decorated.createResponseStream({
        model: "gpt-4o",
        input: "hello"
      }).pipe(Stream.runCollect)
      const usages = yield* Ref.get(observed)
      const observedUsage = yield* Arr.head(usages)

      expect(Chunk.map(chunks, (event) => event.type)).toEqual(
        Chunk.make("response.created", "response.completed")
      )
      expect(Arr.length(usages)).toBe(1)
      expect(observedUsage.inputTokens).toBe(0)
      expect(observedUsage.outputTokens).toBe(0)
      expect(observedUsage.totalTokens).toBe(0)
      expect(Option.fromNullable(observedUsage.reasoningTokens)).toEqual(Option.some(0))
      expect(Option.fromNullable(observedUsage.cachedInputTokens)).toEqual(Option.some(0))
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

      const chunks = yield* decorated.createResponseStream({
        model: "gpt-4o",
        input: "hello"
      }).pipe(
        Stream.take(1),
        Stream.runCollect
      )
      const usages = yield* Ref.get(observed)

      expect(Chunk.map(chunks, (event) => event.type)).toEqual(Chunk.make("response.created"))
      expect(Arr.isEmptyArray(usages)).toBe(true)
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

        yield* decorated.createResponseStream({ model: "gpt-4o", input: "hello" }).pipe(
          Stream.take(count),
          Stream.runDrain
        )
        const usages = yield* Ref.get(observed)
        const received = yield* Arr.head(usages)

        expect(Arr.length(usages)).toBe(1)
        expect(received.totalTokens).toBe(29)
        expect(received.reasoningTokens).toBe(7)
      }))
  )
})
