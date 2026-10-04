import * as AnthropicClient from "@effect/ai-anthropic/AnthropicClient"
import * as Generated from "@effect/ai-anthropic/Generated"
import { describe, expect, it } from "@effect/vitest"
import * as AiError from "effect/ai/AiError"
import * as Arr from "effect/Array"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as Struct from "effect/Struct"

import * as AnthropicUsage from "@scenesystems/effect-inference/AnthropicUsage"
import { encodeSse, jsonHttpClient, sseHttpClient } from "./fixtures/usage.js"

const message = (usage: unknown) => ({
  id: "message-1",
  type: "message",
  role: "assistant",
  content: Arr.empty(),
  model: "claude-sonnet-4-5",
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: {
    cache_creation: null,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    service_tier: null,
    ...Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(usage)
  }
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

describe("AnthropicUsage.observe", () => {
  it.effect("retains a complete response report without inventing absent canonical counters", () =>
    Effect.scoped(Effect.gen(function*() {
      const observed = yield* Ref.make(Option.none<AnthropicUsage.Observation>())
      const nativeClient = yield* makeClient(jsonHttpClient(message({
        input_tokens: 17,
        output_tokens: 5,
        cache_creation_input_tokens: 11
      })))
      const decorated = AnthropicUsage.observe(
        nativeClient,
        (observation) => Ref.set(observed, Option.some(observation))
      )

      const [result] = yield* decorated.createMessage({ payload })
      const observation = Option.getOrThrow(yield* Ref.get(observed))

      expect(observation._tag).toBe("Response")
      expect(observation.raw).toBe(result.usage)
      expect(observation.raw.cache_creation_input_tokens).toBe(11)
      expect(observation.usage.inputTokens.total).toBeUndefined()
      expect(observation.usage.inputTokens.uncached).toBe(17)
      expect(observation.usage.inputTokens.cacheWrite).toBe(11)
      expect(observation.usage.outputTokens.total).toBe(5)
      expect(observation.usage.outputTokens.reasoning).toBeUndefined()
      expect(observation.usage.inputTokens.cacheRead).toBeUndefined()
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
            cache_creation_input_tokens: null,
            cache_read_input_tokens: null,
            input_tokens: null,
            output_tokens: 5,
            server_tool_use: { web_fetch_requests: 0, web_search_requests: 2 }
          }
        },
        { type: "message_stop" }
      )
      const observed = yield* Ref.make(Arr.empty<AnthropicUsage.Observation>())
      const nativeClient = yield* makeClient(sseHttpClient(encodeSse(events)))
      const decorated = AnthropicUsage.observe(
        nativeClient,
        (observation) => Ref.update(observed, Arr.append(observation))
      )

      const [, stream] = yield* decorated.createMessageStream({ payload })
      const chunks = yield* stream.pipe(Stream.runCollect)
      const observations = yield* Ref.get(observed)
      const initial = Option.getOrThrow(Arr.head(observations))
      const final = Option.getOrThrow(Arr.last(observations))

      expect(Arr.map(chunks, (event) => event.type)).toEqual(
        Arr.make("message_start", "message_delta", "message_stop")
      )
      expect(Arr.length(observations)).toBe(2)
      expect(initial._tag).toBe("MessageStart")
      expect(initial.raw.server_tool_use).toEqual({ web_fetch_requests: 0, web_search_requests: 0 })
      expect(initial.usage.outputTokens.total).toBe(1)
      expect(final._tag).toBe("MessageDelta")
      expect(Option.fromNullishOr(final.raw.input_tokens)).toEqual(Option.none())
      expect(Option.fromNullishOr(final.raw.cache_read_input_tokens)).toEqual(Option.none())
      expect(
        Option.fromNullishOr(final.raw.server_tool_use).pipe(
          Option.map((usage) => usage.web_search_requests)
        )
      ).toEqual(Option.some(2))
      expect(final.usage.inputTokens.total).toBe(27)
      expect(final.usage.inputTokens.uncached).toBe(17)
      expect(final.usage.outputTokens.total).toBe(5)
      const encoded = yield* Schema.encodeEffect(AnthropicUsage.Observation)(final)
      const decoded = yield* Schema.decodeEffect(AnthropicUsage.Observation)(encoded)
      expect(decoded).toEqual(final)
      expect(final.usage.outputTokens.reasoning).toBeUndefined()
      expect(final.usage.inputTokens.cacheRead).toBe(3)
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
      const observed = yield* Ref.make(Arr.empty<AnthropicUsage.Observation>())
      const nativeClient = yield* makeClient(sseHttpClient(encodeSse(events)))
      const decorated = AnthropicUsage.observe(
        nativeClient,
        (observation) => Ref.update(observed, Arr.append(observation))
      )

      const [, stream] = yield* decorated.createMessageStream({ payload })
      const chunks = yield* stream.pipe(
        Stream.take(2),
        Stream.runCollect
      )
      const observations = yield* Ref.get(observed)
      const latest = Option.getOrThrow(Arr.last(observations))

      expect(Arr.map(chunks, (event) => event.type)).toEqual(
        Arr.make("message_start", "message_delta")
      )
      expect(Arr.length(observations)).toBe(2)
      expect(latest._tag).toBe("MessageDelta")
      expect(Option.fromNullishOr(latest.raw.input_tokens)).toEqual(Option.some(0))
      expect(Option.fromNullishOr(latest.raw.cache_read_input_tokens)).toEqual(Option.some(0))
      expect(latest.usage.inputTokens.total).toBe(0)
      expect(latest.usage.outputTokens.total).toBe(0)
      expect(latest.usage.inputTokens.cacheRead).toBe(0)
    })))

  it.effect("allocates cumulative state for each execution of a reused stream", () =>
    Effect.gen(function*() {
      const events = Chunk.make(
        {
          type: "message_delta",
          delta: { stop_reason: null, stop_sequence: null },
          usage: {
            input_tokens: null,
            output_tokens: 2,
            cache_read_input_tokens: null,
            cache_creation_input_tokens: null
          }
        },
        {
          type: "message_start",
          message: message({
            input_tokens: 17,
            output_tokens: 1,
            cache_read_input_tokens: 3,
            cache_creation_input_tokens: 11
          })
        }
      )
      const observed = yield* Ref.make(Arr.empty<AnthropicUsage.Observation>())
      const client = yield* makeClient(sseHttpClient(""))
      const [, nativeStream] = yield* (yield* makeClient(sseHttpClient(encodeSse(events)))).createMessageStream({
        payload
      })
      const reusableEvents = yield* Stream.runCollect(nativeStream)
      const reusableClient = Struct.evolve(client, {
        createMessageStream: (create): AnthropicClient.Service["createMessageStream"] => (options) =>
          create(options).pipe(Effect.map(([response]) => [response, Stream.fromIterable(reusableEvents)]))
      })
      const decorated = AnthropicUsage.observe(reusableClient, (observation) =>
        Ref.update(observed, Arr.append(observation)))
      const [, stream] = yield* decorated.createMessageStream({ payload })
      yield* Stream.runDrain(stream)
      yield* Stream.runDrain(stream)
      expect(Arr.map(yield* Ref.get(observed), (observation) =>
        Option.fromNullishOr(observation.usage.inputTokens.total)))
        .toEqual(Arr.make(Option.none(), Option.some(31), Option.none(), Option.some(31)))
    }))

  it.effect("retains received evidence when the native stream later fails", () =>
    Effect.scoped(Effect.gen(function*() {
      const start = yield* Schema.decodeUnknownEffect(Generated.BetaMessageStartEvent)({
        type: "message_start",
        message: message({ input_tokens: 17, output_tokens: 1 })
      })
      const observed = yield* Ref.make(Arr.empty<AnthropicUsage.Observation>())
      const nativeClient = yield* makeClient(sseHttpClient(""))
      const failure = new AiError.UnknownError({
        description: "expected stream failure"
      })
      const aiFailure = new AiError.AiError({
        module: "AnthropicClient",
        method: "createMessageStream",
        reason: failure
      })
      const failingStream: AnthropicClient.Service["createMessageStream"] = (options) =>
        nativeClient.createMessageStream(options).pipe(
          Effect.map(([response]) => [
            response,
            Stream.make(start).pipe(
              Stream.concat(Stream.fail(aiFailure))
            )
          ])
        )
      const failingClient = Struct.evolve(nativeClient, {
        createMessageStream: () => failingStream
      })
      const decorated = AnthropicUsage.observe(
        failingClient,
        (observation) => Ref.update(observed, Arr.append(observation))
      )

      const [, stream] = yield* decorated.createMessageStream({ payload })
      const receivedFailure = yield* stream.pipe(
        Stream.runCollect,
        Effect.flip
      )
      const observations = yield* Ref.get(observed)
      const retained = Option.getOrThrow(Arr.head(observations))

      expect(receivedFailure).toBe(aiFailure)
      expect(receivedFailure.reason).toBe(failure)
      expect(Arr.length(observations)).toBe(1)
      expect(retained._tag).toBe("MessageStart")
      expect(retained.usage.inputTokens.total).toBeUndefined()
      expect(retained.usage.inputTokens.uncached).toBe(17)
      expect(retained.usage.outputTokens.total).toBe(1)
    })))
})
