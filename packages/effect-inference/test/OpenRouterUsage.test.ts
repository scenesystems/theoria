import * as Generated from "@effect/ai-openrouter/Generated"
import * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel"
import { describe, expect, it } from "@effect/vitest"
import * as AiResponse from "effect/ai/Response"
import * as Arr from "effect/Array"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as Str from "effect/String"
import * as Struct from "effect/Struct"

import * as OpenRouterUsage from "@scenesystems/effect-inference/OpenRouterUsage"
import { encodeSse, jsonHttpClient, sseHttpClient } from "./fixtures/usage.js"

const response = {
  id: "generation-1",
  choices: Arr.make({
    finish_reason: "stop",
    index: 0,
    message: { role: "assistant", content: "not-json" }
  }),
  created: 0,
  model: "openai/gpt-4o-mini",
  object: "chat.completion",
  system_fingerprint: null,
  usage: {
    prompt_tokens: 17,
    completion_tokens: 5,
    total_tokens: 29,
    completion_tokens_details: { reasoning_tokens: 7 },
    prompt_tokens_details: { cached_tokens: 3, cache_write_tokens: 11 },
    cost: 0.002
  }
}

const request = Schema.decodeSync(Generated.ChatRequest)({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "hello" }]
})

describe("OpenRouterUsage.observe", () => {
  it.effect("projects disjoint token components and retains cost in the raw codec", () =>
    Effect.gen(function*() {
      const raw = { ...response.usage, completion_tokens: 12 }
      const observation = yield* Schema.decodeEffect(OpenRouterUsage.Observation)(raw)
      expect(observation.usage.inputTokens).toMatchObject({ total: 17, uncached: 14, cacheRead: 3, cacheWrite: 11 })
      expect(observation.usage.outputTokens).toEqual({ total: 12, text: 5, reasoning: 7 })
      expect(yield* Schema.encodeEffect(OpenRouterUsage.Observation)(observation)).toEqual(raw)
    }))

  it.effect("observes all reported counters before structured decoding", () =>
    Effect.gen(function*() {
      const observed = yield* Ref.make(Arr.empty<AiResponse.Usage>())
      const rawObserved = yield* Ref.make(Option.none<Generated.ChatUsage>())
      const nativeClient = yield* OpenRouterClient.make({}).pipe(
        Effect.provideService(
          HttpClient.HttpClient,
          jsonHttpClient(response)
        )
      )
      const decorated = OpenRouterUsage.observe(
        nativeClient,
        (usage, raw) =>
          Ref.update(observed, Arr.append(usage)).pipe(
            Effect.andThen(Ref.set(rawObserved, raw))
          )
      )
      const model = yield* OpenRouterLanguageModel.make({ model: "openai/gpt-4o-mini" }).pipe(
        Effect.provideService(OpenRouterClient.OpenRouterClient, decorated)
      )
      const exit = yield* model.generateObject({
        prompt: "Return an object",
        schema: Schema.Struct({ answer: Schema.String })
      }).pipe(Effect.exit)
      const usages = yield* Ref.get(observed)
      const usage = Option.getOrThrow(Arr.head(usages))
      const raw = Option.getOrThrow(yield* Ref.get(rawObserved))
      const promptDetails = Option.getOrThrow(Option.fromNullishOr(raw.prompt_tokens_details))

      expect(exit._tag).toBe("Failure")
      expect(raw.cost).toBe(0.002)
      expect(promptDetails.cache_write_tokens).toBe(11)
      expect(Arr.length(usages)).toBe(1)
      expect(usage.inputTokens.total).toBe(17)
      expect(usage.inputTokens.uncached).toBe(14)
      expect(usage.inputTokens.cacheRead).toBe(3)
      expect(usage.outputTokens.total).toBe(5)
      expect(usage.outputTokens.text).toBeUndefined()
      expect(usage.outputTokens.reasoning).toBe(7)
    }))

  it.effect("preserves explicit zero details", () =>
    Effect.gen(function*() {
      const zeroResponse = {
        ...response,
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          completion_tokens_details: { reasoning_tokens: 0 },
          prompt_tokens_details: { cached_tokens: 0 }
        }
      }
      const observed = yield* Ref.make(Option.none<AiResponse.Usage>())
      const nativeClient = yield* OpenRouterClient.make({}).pipe(
        Effect.provideService(HttpClient.HttpClient, jsonHttpClient(zeroResponse))
      )
      const decorated = OpenRouterUsage.observe(
        nativeClient,
        (usage) => Ref.set(observed, Option.some(usage))
      )

      yield* decorated.createChatCompletion(request)
      const observedOption = yield* Ref.get(observed)
      const usage = Option.getOrThrow(observedOption)

      expect(usage.outputTokens.reasoning).toBe(0)
      expect(usage.inputTokens.cacheRead).toBe(0)
    }))

  it.effect("preserves absent optional details", () =>
    Effect.gen(function*() {
      const absentResponse = {
        ...response,
        usage: {
          prompt_tokens: 17,
          completion_tokens: 5,
          total_tokens: 29
        }
      }
      const observed = yield* Ref.make(Option.none<AiResponse.Usage>())
      const nativeClient = yield* OpenRouterClient.make({}).pipe(
        Effect.provideService(HttpClient.HttpClient, jsonHttpClient(absentResponse))
      )
      const decorated = OpenRouterUsage.observe(
        nativeClient,
        (usage) => Ref.set(observed, Option.some(usage))
      )

      yield* decorated.createChatCompletion(request)
      const observedOption = yield* Ref.get(observed)
      const usage = Option.getOrThrow(observedOption)

      expect(usage.outputTokens.reasoning).toBeUndefined()
      expect(usage.inputTokens.cacheRead).toBeUndefined()
    }))

  it.effect("observes a non-streaming response without usage as unknown", () =>
    Effect.gen(function*() {
      const observed = yield* Ref.make(Option.none<AiResponse.Usage>())
      const reported = yield* Ref.make(true)
      const client = yield* OpenRouterClient.make({}).pipe(
        Effect.provideService(HttpClient.HttpClient, jsonHttpClient(Struct.omit(response, ["usage"])))
      )
      yield* OpenRouterUsage.observe(client, (usage, raw) =>
        Ref.set(observed, Option.some(usage)).pipe(Effect.andThen(Ref.set(reported, Option.isSome(raw)))))
        .createChatCompletion(request)
      const usage = Option.getOrThrow(yield* Ref.get(observed))
      const hasReport = yield* Ref.get(reported)

      expect(usage).toEqual(
        new AiResponse.Usage({
          inputTokens: {},
          outputTokens: {}
        })
      )
      expect(hasReport).toBe(false)
    }))

  it.effect("retains known counters when nullable cache details are unknown", () =>
    Effect.gen(function*() {
      const unknownCacheResponse = {
        ...response,
        usage: {
          prompt_tokens: 17,
          completion_tokens: 5,
          total_tokens: 29,
          completion_tokens_details: { reasoning_tokens: 7 },
          prompt_tokens_details: {}
        }
      }
      const observed = yield* Ref.make(Option.none<AiResponse.Usage>())
      const nativeClient = yield* OpenRouterClient.make({}).pipe(
        Effect.provideService(HttpClient.HttpClient, jsonHttpClient(unknownCacheResponse))
      )
      const decorated = OpenRouterUsage.observe(
        nativeClient,
        (usage) => Ref.set(observed, Option.some(usage))
      )

      yield* decorated.createChatCompletion(request)
      const observedOption = yield* Ref.get(observed)
      const usage = Option.getOrThrow(observedOption)

      expect(usage.inputTokens.total).toBe(17)
      expect(usage.outputTokens.total).toBe(5)
      expect(usage.inputTokens.uncached).toBeUndefined()
      expect(usage.outputTokens.text).toBeUndefined()
      expect(usage.outputTokens.reasoning).toBe(7)
      expect(usage.inputTokens.cacheRead).toBeUndefined()
    }))

  it.effect("keeps stream chunks and failures while observing the final usage chunk", () =>
    Effect.gen(function*() {
      const events = Chunk.make(
        {
          id: "generation-1",
          model: "openai/gpt-4o-mini",
          created: 0,
          object: "chat.completion.chunk",
          choices: Arr.make({
            index: 0,
            delta: { content: "hello" },
            finish_reason: "stop"
          })
        },
        {
          id: "generation-1",
          model: "openai/gpt-4o-mini",
          created: 0,
          object: "chat.completion.chunk",
          choices: Arr.empty(),
          usage: response.usage
        }
      )
      const body = Str.concat(encodeSse(events), "data: malformed\n\n")
      const seen = yield* Ref.make(Arr.empty<string>())
      const observed = yield* Ref.make(Arr.empty<AiResponse.Usage>())
      const nativeClient = yield* OpenRouterClient.make({}).pipe(
        Effect.provideService(HttpClient.HttpClient, sseHttpClient(body))
      )
      const decorated = OpenRouterUsage.observe(
        nativeClient,
        (usage) => Ref.update(observed, Arr.append(usage))
      )

      const [, stream] = yield* decorated.createChatCompletionStream(request)
      const exit = yield* stream.pipe(
        Stream.tap((chunk) =>
          Ref.update(
            seen,
            Arr.append(Option.getOrElse(
              Option.fromNullishOr(chunk.id),
              () => "absent"
            ))
          )
        ),
        Stream.runDrain,
        Effect.exit
      )
      const chunks = yield* Ref.get(seen)
      const usages = yield* Ref.get(observed)

      expect(exit._tag).toBe("Failure")
      expect(chunks).toEqual(Arr.make("generation-1", "generation-1"))
      expect(Arr.length(usages)).toBe(1)
    }))
})
