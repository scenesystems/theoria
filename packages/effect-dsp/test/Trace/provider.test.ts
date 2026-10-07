/**
 * Provider response evidence reaches DSP before native structured decoding.
 */
import * as AnthropicClient from "@effect/ai-anthropic/AnthropicClient"
import * as AnthropicLanguageModel from "@effect/ai-anthropic/AnthropicLanguageModel"
import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import * as OpenAiLanguageModel from "@effect/ai-openai/OpenAiLanguageModel"
import * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel"
import { describe, expect, it } from "@effect/vitest"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import * as Signature from "@scenesystems/effect-dsp/Signature"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import * as AnthropicUsage from "@scenesystems/effect-inference/AnthropicUsage"
import * as OpenAiUsage from "@scenesystems/effect-inference/OpenAiUsage"
import * as OpenRouterUsage from "@scenesystems/effect-inference/OpenRouterUsage"
import { Array as Arr, Effect, Option, Ref, Schema } from "effect"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Response from "effect/ai/Response"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as HttpServerResponse from "effect/http/HttpServerResponse"

const jsonHttpClient = (body: unknown): HttpClient.HttpClient =>
  HttpClient.make((request) =>
    Effect.succeed(HttpClientResponse.fromWeb(
      request,
      HttpServerResponse.toWeb(HttpServerResponse.jsonUnsafe(body))
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
  system_fingerprint: null,
  usage: {
    prompt_tokens: 17,
    completion_tokens: 12,
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
            output_tokens: 12,
            total_tokens: 29,
            input_tokens_details: { cached_tokens: 3 },
            output_tokens_details: { reasoning_tokens: 7 }
          },
          expected: new Response.Usage({
            inputTokens: { total: 17, uncached: 14, cacheRead: 3 },
            outputTokens: { total: 12, text: 5, reasoning: 7 }
          })
        },
        {
          name: "missing",
          raw: null,
          expected: new Response.Usage({ inputTokens: {}, outputTokens: {} })
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
            inputTokens: { total: 0, uncached: 0, cacheRead: 0 },
            outputTokens: { total: 0, text: 0, reasoning: 0 }
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
          const module = yield* Module.predict(
            Arr.join(Arr.make("openai", name, "usage"), "-"),
            signature,
            new Module.PredictOptions({
              policy: new Module.PredictPolicyOverrides({
                parse: new Module.ParsePolicyOverrides({ maxRetries: 0 })
              })
            })
          )
          yield* Ref.update(
            module.parameters,
            (parameters) =>
              new ModuleParameters({
                instructions: parameters.instructions,
                demos: parameters.demos,
                outputStrategy: "text",
                temperature: parameters.temperature,
                maxTokens: parameters.maxTokens
              })
          )
          const [[[output, entries], calls], aggregate] = yield* Trace.withUsageTracking(
            Trace.withCalls(Trace.withTracing(module.forward({ question: "Capital?" })))
          ).pipe(Effect.provideService(LanguageModel.LanguageModel, model))
          const call = Option.getOrThrow(Arr.head(calls))
          const entry = Option.getOrThrow(Arr.head(entries))
          const projection = yield* Trace.projectObjective(entry)
          const codec = Schema.fromJsonString(Trace.Entry)
          const persisted = yield* Schema.encodeEffect(codec)(entry)
          const restored = yield* Schema.decodeEffect(codec)(persisted)

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
            stop_sequence: null,
            usage: {
              input_tokens: 14,
              output_tokens: 5,
              cache_read_input_tokens: 3,
              cache_creation_input_tokens: null,
              cache_creation: null,
              service_tier: null
            }
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
      const call = Option.getOrThrow(Arr.head(calls))
      const entry = Option.getOrThrow(Arr.head(entries))
      const projection = yield* Trace.projectObjective(entry)
      const expected = new Response.Usage({
        inputTokens: { uncached: 14, cacheRead: 3 },
        outputTokens: { total: 5 }
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
      const call = Option.getOrThrow(Arr.head(calls))
      const received = Option.getOrThrow(call.usage)
      const codec = Schema.fromJsonString(Trace.Call)
      const json = yield* Schema.encodeEffect(codec)(call)
      const restored = yield* Schema.decodeEffect(codec)(json)

      // The schema-invalid structured reply is a signature parse failure with its raw text.
      expect(failure).toMatchObject({
        _tag: "ParseOutputError",
        moduleName: "provider-usage",
        rawOutput: Option.some("not-json"),
        context: { predictorPath: "provider-usage" }
      })
      expect(failure.message).toBe(
        "LanguageModel.generateObject: Structured output validation failed: Expected a valid JSON string"
      )
      expect(Arr.length(entries)).toBe(0)
      expect(Arr.length(calls)).toBe(1)
      expect(call.outcome).toBe("failure")
      expect(restored.usage).toEqual(Option.some(
        new Response.Usage({
          inputTokens: { total: 17, uncached: 14, cacheRead: 3 },
          outputTokens: { total: 12, text: 5, reasoning: 7 }
        })
      ))
      expect(received.inputTokens.total).toBe(17)
      expect(received.outputTokens.total).toBe(12)
      expect(aggregate.callCount).toBe(1)
      expect(aggregate.tokens.inputTokens.total).toBe(17)
      expect(aggregate.tokens.inputTokens.cacheRead).toBe(3)
    }))
})
