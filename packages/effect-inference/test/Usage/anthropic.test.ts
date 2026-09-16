import * as AnthropicClient from "@effect/ai-anthropic/AnthropicClient"
import * as Generated from "@effect/ai-anthropic/Generated"
import * as AiError from "@effect/ai/AiError"
import * as HttpClient from "@effect/platform/HttpClient"
import { describe, expect, it } from "@effect/vitest"
import * as Arr from "effect/Array"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as Struct from "effect/Struct"

import {
  type AnthropicUsageObservation,
  AnthropicUsageObservationSchema,
  observeAnthropic
} from "@scenesystems/effect-inference/Usage/Anthropic"
import { encodeSse, jsonHttpClient, sseHttpClient } from "./fixtures.js"

const message = (usage: unknown) => ({
  id: "message-1",
  type: "message",
  role: "assistant",
  content: Arr.empty(),
  model: "claude-sonnet-4-5",
  stop_reason: "end_turn",
  stop_sequence: null,
  usage
})

const payload = Schema.decodeUnknownSync(Generated.BetaCreateMessageParams)({
  model: "claude-sonnet-4-5",
  max_tokens: 16,
  messages: Arr.make({ role: "user", content: "hello" })
})

const makeClient = (httpClient: HttpClient.HttpClient) =>
  AnthropicClient.make({}).pipe(
    Effect.provideService(HttpClient.HttpClient, httpClient)
  )

describe("Usage/observeAnthropic", () => {
  it.effect("retains a complete response report without inventing absent canonical counters", () =>
    Effect.scoped(Effect.gen(function*() {
      const observed = yield* Ref.make(Option.none<AnthropicUsageObservation>())
      const nativeClient = yield* makeClient(jsonHttpClient(message({
        input_tokens: 17,
        output_tokens: 5,
        cache_creation_input_tokens: 11
      })))
      const decorated = observeAnthropic(
        nativeClient,
        (observation) => Ref.set(observed, Option.some(observation))
      )

      const result = yield* decorated.createMessage({ payload })
      const observation = yield* Ref.get(observed).pipe(Effect.flatten)

      expect(observation._tag).toBe("Response")
      expect(observation.raw).toBe(result.usage)
      expect(observation.raw.cache_creation_input_tokens).toBe(11)
      expect(observation.usage.inputTokens).toBe(17)
      expect(observation.usage.outputTokens).toBe(5)
      expect(Option.fromNullable(observation.usage.totalTokens)).toEqual(Option.none())
      expect(Option.fromNullable(observation.usage.reasoningTokens)).toEqual(Option.none())
      expect(Option.fromNullable(observation.usage.cachedInputTokens)).toEqual(Option.none())
    })))

  it.effect("preserves native start and delta evidence while projecting cumulative counters", () =>
    Effect.scoped(Effect.gen(function*() {
      const events = Chunk.make(
        {
          type: "message_start",
          message: message({
            input_tokens: 17,
            output_tokens: 1,
            cache_creation_input_tokens: 7,
            cache_read_input_tokens: 3,
            server_tool_use: {
              web_fetch_requests: 0,
              web_search_requests: 0
            }
          })
        },
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn", stop_sequence: null },
          usage: {
            output_tokens: 5,
            server_tool_use: { web_search_requests: 2 }
          }
        },
        { type: "message_stop" }
      )
      const observed = yield* Ref.make(Arr.empty<AnthropicUsageObservation>())
      const nativeClient = yield* makeClient(sseHttpClient(encodeSse(events)))
      const decorated = observeAnthropic(
        nativeClient,
        (observation) => Ref.update(observed, Arr.append(observation))
      )

      const chunks = yield* decorated.createMessageStream({ payload }).pipe(Stream.runCollect)
      const observations = yield* Ref.get(observed)
      const initial = yield* Arr.head(observations)
      const final = yield* Arr.last(observations)

      expect(Chunk.map(chunks, (event) => event.type)).toEqual(
        Chunk.make("message_start", "message_delta", "message_stop")
      )
      expect(Arr.length(observations)).toBe(2)
      expect(initial._tag).toBe("MessageStart")
      expect(initial.raw.server_tool_use).toEqual(
        new Generated.BetaServerToolUsage({ web_fetch_requests: 0, web_search_requests: 0 })
      )
      expect(initial.usage.outputTokens).toBe(1)
      expect(final._tag).toBe("MessageDelta")
      expect(Option.fromNullable(final.raw.input_tokens)).toEqual(Option.none())
      expect(Option.fromNullable(final.raw.cache_read_input_tokens)).toEqual(Option.none())
      expect(
        Option.fromNullable(final.raw.server_tool_use).pipe(
          Option.map((usage) => usage.web_search_requests)
        )
      ).toEqual(Option.some(2))
      expect(Schema.is(AnthropicUsageObservationSchema)(final)).toBe(true)
      expect(final.usage.inputTokens).toBe(17)
      expect(final.usage.outputTokens).toBe(5)
      expect(Option.fromNullable(final.usage.totalTokens)).toEqual(Option.none())
      expect(Option.fromNullable(final.usage.reasoningTokens)).toEqual(Option.none())
      expect(Option.fromNullable(final.usage.cachedInputTokens)).toEqual(Option.some(3))
    })))

  it.effect("retains explicit zero delta evidence before downstream cancellation", () =>
    Effect.scoped(Effect.gen(function*() {
      const events = Chunk.make(
        {
          type: "message_start",
          message: message({
            input_tokens: 17,
            output_tokens: 1,
            cache_creation_input_tokens: 7,
            cache_read_input_tokens: 3
          })
        },
        {
          type: "message_delta",
          delta: { stop_reason: null, stop_sequence: null },
          usage: {
            input_tokens: 0,
            output_tokens: 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0
          }
        },
        { type: "message_stop" }
      )
      const observed = yield* Ref.make(Arr.empty<AnthropicUsageObservation>())
      const nativeClient = yield* makeClient(sseHttpClient(encodeSse(events)))
      const decorated = observeAnthropic(
        nativeClient,
        (observation) => Ref.update(observed, Arr.append(observation))
      )

      const chunks = yield* decorated.createMessageStream({ payload }).pipe(
        Stream.take(2),
        Stream.runCollect
      )
      const observations = yield* Ref.get(observed)
      const latest = yield* Arr.last(observations)

      expect(Chunk.map(chunks, (event) => event.type)).toEqual(
        Chunk.make("message_start", "message_delta")
      )
      expect(Arr.length(observations)).toBe(2)
      expect(latest._tag).toBe("MessageDelta")
      expect(Option.fromNullable(latest.raw.input_tokens)).toEqual(Option.some(0))
      expect(Option.fromNullable(latest.raw.cache_read_input_tokens)).toEqual(Option.some(0))
      expect(latest.usage.inputTokens).toBe(0)
      expect(latest.usage.outputTokens).toBe(0)
      expect(Option.fromNullable(latest.usage.cachedInputTokens)).toEqual(Option.some(0))
    })))

  it.effect("retains received evidence when the native stream later fails", () =>
    Effect.scoped(Effect.gen(function*() {
      const start = Schema.decodeUnknownSync(AnthropicClient.MessageStreamEvent)({
        type: "message_start",
        message: message({ input_tokens: 17, output_tokens: 1 })
      })
      const observed = yield* Ref.make(Arr.empty<AnthropicUsageObservation>())
      const nativeClient = yield* makeClient(sseHttpClient(""))
      const failure = new AiError.MalformedOutput({
        module: "AnthropicClient",
        method: "createMessageStream"
      })
      const failingStream: AnthropicClient.Service["createMessageStream"] = (options) =>
        nativeClient.createMessageStream(options).pipe(
          Stream.take(0),
          Stream.concat(Stream.make(start)),
          Stream.concat(Stream.fail(failure))
        )
      const failingClient = Struct.evolve(nativeClient, {
        createMessageStream: () => failingStream
      })
      const decorated = observeAnthropic(
        failingClient,
        (observation) => Ref.update(observed, Arr.append(observation))
      )

      const receivedFailure = yield* decorated.createMessageStream({ payload }).pipe(
        Stream.runCollect,
        Effect.flip
      )
      const observations = yield* Ref.get(observed)
      const retained = yield* Arr.head(observations)

      expect(receivedFailure).toBe(failure)
      expect(Arr.length(observations)).toBe(1)
      expect(retained._tag).toBe("MessageStart")
      expect(retained.usage.inputTokens).toBe(17)
      expect(retained.usage.outputTokens).toBe(1)
    })))
})
