/**
 * Provider response evidence reaches DSP before native structured decoding.
 */
import * as AnthropicClient from "@effect/ai-anthropic/AnthropicClient"
import * as AnthropicLanguageModel from "@effect/ai-anthropic/AnthropicLanguageModel"
import * as GoogleClient from "@effect/ai-google/GoogleClient"
import * as GoogleLanguageModel from "@effect/ai-google/GoogleLanguageModel"
import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import * as OpenAiLanguageModel from "@effect/ai-openai/OpenAiLanguageModel"
import * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel"
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Response from "@effect/ai/Response"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import { describe, expect, it } from "@effect/vitest"
import { ModuleParams } from "@scenesystems/effect-dsp/contracts"
import * as Module from "@scenesystems/effect-dsp/Module"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import * as AnthropicUsage from "@scenesystems/effect-inference/AnthropicUsage"
import * as GoogleUsage from "@scenesystems/effect-inference/GoogleUsage"
import * as OpenAiUsage from "@scenesystems/effect-inference/OpenAiUsage"
import * as OpenRouterUsage from "@scenesystems/effect-inference/OpenRouterUsage"
import { Array as Arr, Effect, Option, Ref, Schema } from "effect"
import { projectTraceObjectiveProjection } from "../../src/contracts/TraceProjection.js"

const jsonHttpClient = (body: unknown): HttpClient.HttpClient =>
  HttpClient.make((request) =>
    Effect.succeed(HttpClientResponse.fromWeb(
      request,
      HttpServerResponse.toWeb(HttpServerResponse.unsafeJson(body))
    ))
  )

const providerResponse = {
  id: "generation-1",
  choices: Arr.make({
    finish_reason: "stop",
    index: 0,
    message: { role: "assistant", content: "not-json" }
  }),
  created: 0,
  model: "openai/gpt-4o-mini",
  object: "chat.completion",
  usage: {
    prompt_tokens: 17,
    completion_tokens: 5,
    total_tokens: 29,
    completion_tokens_details: { reasoning_tokens: 7 },
    prompt_tokens_details: { cached_tokens: 3 }
  }
}

describe("Trace provider integration", () => {
  it.effect("uses reported OpenAI usage or explicit absence consistently through successful text prediction", () =>
    Effect.forEach(
      Arr.make(
        {
          name: "reported",
          raw: {
            input_tokens: 17,
            output_tokens: 5,
            total_tokens: 29,
            input_tokens_details: { cached_tokens: 3 },
            output_tokens_details: { reasoning_tokens: 7 }
          },
          expected: new Response.Usage({
            inputTokens: 17,
            outputTokens: 5,
            totalTokens: 29,
            reasoningTokens: 7,
            cachedInputTokens: 3
          })
        },
        {
          name: "missing",
          raw: null,
          expected: new Response.Usage({ inputTokens: undefined, outputTokens: undefined, totalTokens: undefined })
        },
        {
          name: "zero",
          raw: {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 }
          },
          expected: new Response.Usage({
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            reasoningTokens: 0,
            cachedInputTokens: 0
          })
        }
      ),
      ({ name, raw, expected }) =>
        Effect.scoped(Effect.gen(function*() {
          const client = yield* OpenAiClient.make({}).pipe(
            Effect.provideService(
              HttpClient.HttpClient,
              jsonHttpClient({
                id: "response-1",
                object: "response",
                status: "completed",
                created_at: 0,
                error: null,
                incomplete_details: null,
                output: Arr.make({
                  type: "message",
                  id: "message-1",
                  role: "assistant",
                  status: "completed",
                  content: Arr.make({
                    type: "output_text",
                    text: "[[ ## answer ## ]]\nParis",
                    annotations: Arr.empty()
                  })
                }),
                instructions: null,
                usage: raw,
                parallel_tool_calls: true,
                model: "gpt-4o",
                tools: Arr.empty(),
                tool_choice: "auto",
                metadata: null,
                temperature: null,
                top_p: null
              })
            )
          )
          const model = yield* OpenAiLanguageModel.make({ model: "gpt-4o" }).pipe(
            Effect.provideService(OpenAiClient.OpenAiClient, OpenAiUsage.observe(client, Trace.observeUsage))
          )
          const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
          const module = yield* Module.predict(Arr.join(Arr.make("openai", name, "usage"), "-"), signature, {
            policy: { parse: { maxRetries: 0 } }
          })
          yield* Ref.update(module.params, (params) => new ModuleParams({ ...params, outputStrategy: "text" }))
          const [[[output, entries], calls], aggregate] = yield* Trace.withUsageTracking(
            Trace.withCalls(Trace.withTracing(module.forward({ question: "Capital?" })))
          ).pipe(Effect.provideService(LanguageModel.LanguageModel, model))
          const call = yield* Arr.head(calls)
          const entry = yield* Arr.head(entries)
          const projection = yield* projectTraceObjectiveProjection(entry)
          const codec = Schema.parseJson(Trace.Entry)
          const persisted = yield* Schema.encode(codec)(entry)
          const restored = yield* Schema.decode(codec)(persisted)

          expect(output.answer).toBe("Paris")
          expect(Arr.length(calls)).toBe(1)
          expect(Arr.length(entries)).toBe(1)
          expect(call.usage).toEqual(Option.some(expected))
          expect(entry.usage).toEqual(expected)
          expect(projection.usage).toEqual(expected)
          expect(restored.usage).toEqual(expected)
          expect(aggregate.tokens).toEqual(expected)
          expect(aggregate.callCount).toBe(1)
        })),
      { discard: true }
    ))

  it.effect("keeps Anthropic's unreported total unknown through successful structured prediction", () =>
    Effect.scoped(Effect.gen(function*() {
      const client = yield* AnthropicClient.make({}).pipe(
        Effect.provideService(
          HttpClient.HttpClient,
          jsonHttpClient({
            id: "message-1",
            type: "message",
            role: "assistant",
            content: Arr.make({ type: "tool_use", id: "object-1", name: "generateObject", input: { answer: "Paris" } }),
            model: "claude-sonnet-4-5",
            stop_reason: "tool_use",
            usage: { input_tokens: 17, output_tokens: 5, cache_read_input_tokens: 3 }
          })
        )
      )
      const model = yield* AnthropicLanguageModel.make({ model: "claude-sonnet-4-5" }).pipe(
        Effect.provideService(
          AnthropicClient.AnthropicClient,
          AnthropicUsage.observe(client, (observation) => Trace.observeUsage(observation.usage))
        )
      )
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const module = yield* Module.predict("anthropic-usage", signature)
      const [[[output, entries], calls], aggregate] = yield* Trace.withUsageTracking(
        Trace.withCalls(Trace.withTracing(module.forward({ question: "Capital?" })))
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, model))
      const call = yield* Arr.head(calls)
      const entry = yield* Arr.head(entries)
      const projection = yield* projectTraceObjectiveProjection(entry)
      const expected = new Response.Usage({
        inputTokens: 17,
        outputTokens: 5,
        totalTokens: undefined,
        cachedInputTokens: 3
      })

      expect(output.answer).toBe("Paris")
      expect(call.usage).toEqual(Option.some(expected))
      expect(entry.usage).toEqual(expected)
      expect(projection.usage).toEqual(expected)
      expect(aggregate.tokens).toEqual(expected)
      expect(aggregate.callCount).toBe(1)
    })))

  it.effect("retains and serializes OpenRouter usage despite native structured-output failure", () =>
    Effect.gen(function*() {
      const client = yield* OpenRouterClient.make({}).pipe(
        Effect.provideService(
          HttpClient.HttpClient,
          jsonHttpClient(providerResponse)
        )
      )
      const model = yield* OpenRouterLanguageModel.make({ model: "openai/gpt-4o-mini" }).pipe(
        Effect.provideService(OpenRouterClient.OpenRouterClient, OpenRouterUsage.observe(client, Trace.observeUsage))
      )
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const module = yield* Module.predict("provider-usage", signature)
      const [[[failure, entries], calls], aggregate] = yield* Trace.withUsageTracking(
        Trace.withCalls(Trace.withTracing(Effect.flip(module.forward({ question: "Capital?" }))))
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, model))
      const call = yield* Arr.head(calls)
      const received = yield* call.usage
      const codec = Schema.parseJson(Trace.Call)
      const json = yield* Schema.encode(codec)(call)
      const restored = yield* Schema.decode(codec)(json)

      expect(failure._tag).toBe("MalformedOutput")
      expect(Arr.isEmptyReadonlyArray(entries)).toBe(true)
      expect(Arr.length(calls)).toBe(1)
      expect(call.outcome).toBe("failure")
      expect(restored.usage).toEqual(Option.some(
        new Response.Usage({
          inputTokens: 17,
          outputTokens: 5,
          totalTokens: 29,
          reasoningTokens: 7,
          cachedInputTokens: 3
        })
      ))
      expect(received.totalTokens).toBe(29)
      expect(aggregate.callCount).toBe(1)
      expect(aggregate.tokens.totalTokens).toBe(29)
      expect(aggregate.tokens.cachedInputTokens).toBe(3)
    }))

  it.effect("retains Google usage through native decoding failure into serializable DSP evidence", () =>
    Effect.scoped(Effect.gen(function*() {
      const response = {
        candidates: Arr.make({
          index: 0,
          content: { role: "model", parts: Arr.make({ text: "not-json" }) },
          finishReason: "STOP"
        }),
        usageMetadata: {
          promptTokenCount: 17,
          candidatesTokenCount: 5,
          totalTokenCount: 29,
          thoughtsTokenCount: 7,
          cachedContentTokenCount: 3
        }
      }
      const client = yield* GoogleClient.make({}).pipe(
        Effect.provideService(
          HttpClient.HttpClient,
          jsonHttpClient(response)
        )
      )
      const model = yield* GoogleLanguageModel.make({ model: "gemini-2.5-flash" }).pipe(
        Effect.provideService(GoogleClient.GoogleClient, GoogleUsage.observe(client, Trace.observeUsage))
      )
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const module = yield* Module.predict("google-usage", signature)
      const [[[failure, entries], calls], aggregate] = yield* Trace.withUsageTracking(
        Trace.withCalls(Trace.withTracing(Effect.flip(module.forward({ question: "Capital?" }))))
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, model))
      const call = yield* Arr.head(calls)
      const codec = Schema.parseJson(Trace.Call)
      const persisted = yield* Schema.encode(codec)(call)
      const restored = yield* Schema.decode(codec)(persisted)

      expect(failure._tag).toBe("MalformedOutput")
      expect(Arr.isEmptyReadonlyArray(entries)).toBe(true)
      expect(Arr.length(calls)).toBe(1)
      expect(restored.outcome).toBe("failure")
      expect(restored.usage).toEqual(Option.some(
        new Response.Usage({
          inputTokens: 17,
          outputTokens: 5,
          totalTokens: 29,
          reasoningTokens: 7,
          cachedInputTokens: 3
        })
      ))
      expect(aggregate.callCount).toBe(1)
      expect(aggregate.tokens.totalTokens).toBe(29)
    })))

  it.effect("retains all five Google counters through successful structured prediction", () =>
    Effect.scoped(Effect.gen(function*() {
      const client = yield* GoogleClient.make({}).pipe(
        Effect.provideService(
          HttpClient.HttpClient,
          jsonHttpClient({
            candidates: Arr.make({
              index: 0,
              content: { role: "model", parts: Arr.make({ text: "{\"answer\":\"Paris\"}" }) },
              finishReason: "STOP"
            }),
            usageMetadata: {
              promptTokenCount: 17,
              candidatesTokenCount: 5,
              totalTokenCount: 29,
              thoughtsTokenCount: 7,
              cachedContentTokenCount: 3
            }
          })
        )
      )
      const model = yield* GoogleLanguageModel.make({ model: "gemini-2.5-flash" }).pipe(
        Effect.provideService(GoogleClient.GoogleClient, GoogleUsage.observe(client, Trace.observeUsage))
      )
      const signature = yield* Signature.make("Answer", { question: Schema.String }, { answer: Schema.String })
      const module = yield* Module.predict("google-success-usage", signature)
      const [[[output, entries], calls], aggregate] = yield* Trace.withUsageTracking(
        Trace.withCalls(Trace.withTracing(module.forward({ question: "Capital?" })))
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, model))
      const call = yield* Arr.head(calls)
      const entry = yield* Arr.head(entries)
      const projection = yield* projectTraceObjectiveProjection(entry)
      const expected = new Response.Usage({
        inputTokens: 17,
        outputTokens: 5,
        totalTokens: 29,
        reasoningTokens: 7,
        cachedInputTokens: 3
      })

      expect(output.answer).toBe("Paris")
      expect(call.usage).toEqual(Option.some(expected))
      expect(entry.usage).toEqual(expected)
      expect(projection.usage).toEqual(expected)
      expect(aggregate.tokens).toEqual(expected)
      expect(aggregate.callCount).toBe(1)
    })))
})
