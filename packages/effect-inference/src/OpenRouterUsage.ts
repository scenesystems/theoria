/**
 * Usage observation for the native Effect OpenRouter client.
 *
 * @since 0.4.0
 * @module
 */
import * as Generated from "@effect/ai-openrouter/Generated"
import type * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
import * as AiResponse from "effect/ai/Response"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as SchemaGetter from "effect/SchemaGetter"
import * as Stream from "effect/Stream"
import * as Struct from "effect/Struct"

/**
 * Canonical usage paired with the exact OpenRouter usage report.
 *
 * @since 0.5.0
 * @category models
 */
const projectObservation = (raw: Generated.ChatUsage) => ({
  usage: new AiResponse.Usage({
    inputTokens: {
      total: raw.prompt_tokens,
      ...Option.match(Option.fromNullishOr(raw.prompt_tokens_details), {
        onNone: () => ({}),
        onSome: (details) => ({
          ...Option.match(Option.fromNullishOr(details.cached_tokens), {
            onNone: () => ({}),
            onSome: (cacheRead) => ({
              cacheRead,
              ...Option.match(Option.liftPredicate((value: number) => value <= raw.prompt_tokens)(cacheRead), {
                onNone: () => ({}),
                onSome: (value) => ({ uncached: raw.prompt_tokens - value })
              })
            })
          }),
          ...Option.match(Option.fromNullishOr(details.cache_write_tokens), {
            onNone: () => ({}),
            onSome: (cacheWrite) => ({ cacheWrite })
          })
        })
      })
    },
    outputTokens: {
      ...Option.match(Option.fromNullishOr(raw.completion_tokens_details), {
        onNone: () => ({ total: raw.completion_tokens }),
        onSome: (details) => ({
          ...Option.match(Option.fromNullishOr(details.reasoning_tokens), {
            onNone: () => ({ total: raw.completion_tokens }),
            onSome: (reasoning) => ({
              total: raw.completion_tokens,
              reasoning,
              ...Option.match(Option.liftPredicate((value: number) => value <= raw.completion_tokens)(reasoning), {
                onNone: () => ({}),
                onSome: (value) => ({ text: raw.completion_tokens - value })
              })
            })
          })
        })
      })
    }
  }),
  raw
})

/** Canonical usage with its retained provider report. @since 0.5.0 @category schemas */
export const Observation = Schema.toType(Generated.ChatUsage).pipe(
  Schema.decodeTo(Schema.Struct({ usage: Schema.toType(AiResponse.Usage), raw: Schema.toType(Generated.ChatUsage) }), {
    decode: SchemaGetter.transform(projectObservation),
    encode: SchemaGetter.transform((observation) => observation.raw)
  })
)
/** Canonical and raw usage observation. @since 0.5.0 @category models */
export type Observation = typeof Observation.Type

const decodeObservation = Schema.decodeSync(Observation)

const observeOptional = (
  usage: Option.Option<Generated.ChatUsage>,
  observe: (usage: AiResponse.Usage, raw: Option.Option<Generated.ChatUsage>) => Effect.Effect<void>
): Effect.Effect<void> =>
  usage.pipe(
    Option.match({
      onNone: () =>
        observe(
          new AiResponse.Usage({ inputTokens: {}, outputTokens: {} }),
          Option.none()
        ),
      onSome: (raw) => observe(decodeObservation(raw).usage, Option.some(raw))
    })
  )

const decorateCreateChatCompletion = (
  createChatCompletion: OpenRouterClient.Service["createChatCompletion"],
  observe: (usage: AiResponse.Usage, raw: Option.Option<Generated.ChatUsage>) => Effect.Effect<void>
): OpenRouterClient.Service["createChatCompletion"] =>
(options) =>
  createChatCompletion(options).pipe(
    Effect.tap(([response]) =>
      observeOptional(
        Option.fromNullishOr(response.usage),
        observe
      )
    )
  )

const decorateCreateChatCompletionStream = (
  createChatCompletionStream: OpenRouterClient.Service["createChatCompletionStream"],
  observe: (usage: AiResponse.Usage, raw: Option.Option<Generated.ChatUsage>) => Effect.Effect<void>
): OpenRouterClient.Service["createChatCompletionStream"] =>
(options) =>
  createChatCompletionStream(options).pipe(
    Effect.map(([response, stream]) => [
      response,
      stream.pipe(
        Stream.tap((chunk) =>
          Option.match(Option.fromNullishOr(chunk.usage), {
            onNone: () => Effect.void,
            onSome: (raw) => observe(decodeObservation(raw).usage, Option.some(raw))
          })
        )
      )
    ])
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
  observe: (usage: AiResponse.Usage, raw: Option.Option<Generated.ChatUsage>) => Effect.Effect<void>
): OpenRouterClient.Service =>
  Struct.evolve(client, {
    createChatCompletion: (createChatCompletion) => decorateCreateChatCompletion(createChatCompletion, observe),
    createChatCompletionStream: (createChatCompletionStream) =>
      decorateCreateChatCompletionStream(createChatCompletionStream, observe)
  })
