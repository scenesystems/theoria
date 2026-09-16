/**
 * Usage observation for the native Effect OpenRouter client.
 *
 * @since 0.4.0
 * @module
 */
import * as Generated from "@effect/ai-openrouter/Generated"
import type * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
import * as AiResponse from "@effect/ai/Response"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as Struct from "effect/Struct"

/**
 * Canonical usage paired with the exact OpenRouter usage report.
 *
 * @since 0.5.0
 * @category models
 */
export const Observation = Schema.transform(
  Schema.typeSchema(Generated.ChatGenerationTokenUsage),
  Schema.Struct({
    usage: Schema.typeSchema(AiResponse.Usage),
    raw: Schema.typeSchema(Generated.ChatGenerationTokenUsage)
  }),
  {
    strict: true,
    decode: (raw) => ({
      usage: new AiResponse.Usage({
        inputTokens: raw.prompt_tokens,
        outputTokens: raw.completion_tokens,
        totalTokens: raw.total_tokens,
        ...Option.match(Option.fromNullable(raw.completion_tokens_details), {
          onNone: () => ({}),
          onSome: (details) => ({ reasoningTokens: details.reasoning_tokens })
        }),
        ...Option.match(Option.fromNullable(raw.prompt_tokens_details), {
          onNone: () => ({}),
          onSome: (details) => ({ cachedInputTokens: details.cached_tokens })
        })
      }),
      raw
    }),
    encode: (_encoded, observation) => observation.raw
  }
)

/** Canonical and raw OpenRouter usage observation inferred from its schema. @since 0.5.0 @category models */
export type Observation = typeof Observation.Type

const decodeObservation = Schema.decodeSync(Observation)

const observeOptional = (
  usage: Option.Option<Generated.ChatGenerationTokenUsage>,
  observe: (usage: AiResponse.Usage, raw: Option.Option<Generated.ChatGenerationTokenUsage>) => Effect.Effect<void>
): Effect.Effect<void> =>
  usage.pipe(
    Option.match({
      onNone: () =>
        observe(
          new AiResponse.Usage({ inputTokens: undefined, outputTokens: undefined, totalTokens: undefined }),
          Option.none()
        ),
      onSome: (raw) => observe(decodeObservation(raw).usage, Option.some(raw))
    })
  )

const decorateCreateChatCompletion = (
  createChatCompletion: OpenRouterClient.Service["createChatCompletion"],
  observe: (usage: AiResponse.Usage, raw: Option.Option<Generated.ChatGenerationTokenUsage>) => Effect.Effect<void>
): OpenRouterClient.Service["createChatCompletion"] =>
(options) =>
  createChatCompletion(options).pipe(
    Effect.tap((response) =>
      observeOptional(
        Option.fromNullable(response.usage),
        observe
      )
    )
  )

const decorateCreateChatCompletionStream = (
  createChatCompletionStream: OpenRouterClient.Service["createChatCompletionStream"],
  observe: (usage: AiResponse.Usage, raw: Option.Option<Generated.ChatGenerationTokenUsage>) => Effect.Effect<void>
): OpenRouterClient.Service["createChatCompletionStream"] =>
(options) =>
  createChatCompletionStream(options).pipe(
    Stream.tap((chunk) =>
      Option.match(Option.fromNullable(chunk.usage), {
        onNone: () => Effect.void,
        onSome: (raw) => observe(decodeObservation(raw).usage, Option.some(raw))
      })
    )
  )

/**
 * Decorates a native OpenRouter client so chat-completion usage is observed
 * before the native language model transforms the response. Streaming usage
 * is observed whenever a chunk carries it. The second callback argument retains
 * the complete native report in an Option, including costs and cache-write
 * details. Non-streaming responses without usage emit unknown canonical counters
 * and None; stream chunks without usage do not overwrite earlier snapshots.
 *
 * @example
 * ```ts
 * import * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
 * import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel"
 * import { Effect } from "effect"
 * import { OpenRouterUsage } from "@scenesystems/effect-inference"
 *
 * const model = Effect.gen(function*() {
 *   const client = yield* OpenRouterClient.OpenRouterClient
 *   const observed = OpenRouterUsage.observe(client, (usage) => Effect.log(usage))
 *   return yield* OpenRouterLanguageModel.make({ model: "openai/gpt-4o" }).pipe(
 *     Effect.provideService(OpenRouterClient.OpenRouterClient, observed)
 *   )
 * })
 * ```
 *
 * @since 0.4.0
 * @category combinators
 */
export const observe = (
  client: OpenRouterClient.Service,
  observe: (usage: AiResponse.Usage, raw: Option.Option<Generated.ChatGenerationTokenUsage>) => Effect.Effect<void>
): OpenRouterClient.Service =>
  Struct.evolve(client, {
    createChatCompletion: (createChatCompletion) => decorateCreateChatCompletion(createChatCompletion, observe),
    createChatCompletionStream: (createChatCompletionStream) =>
      decorateCreateChatCompletionStream(createChatCompletionStream, observe)
  })
