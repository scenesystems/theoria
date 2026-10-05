/** Canonical mappings between model settings and provider configuration. @internal */
import * as Anthropic from "@effect/ai-anthropic/AnthropicLanguageModel"
import * as OpenAi from "@effect/ai-openai/OpenAiLanguageModel"
import * as OpenRouter from "@effect/ai-openrouter/OpenRouterLanguageModel"
import { empty, ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import { Array as Arr, Effect, Match, Option, Predicate, Record } from "effect"
import type { Provider } from "../TextProvider.js"

const common = (settings: ModelSettings) => ({
  ...Option.match(Option.fromNullishOr(settings.temperature), {
    onNone: () => ({}),
    onSome: (temperature) => ({ temperature })
  }),
  ...Option.match(Option.fromNullishOr(settings.topP), { onNone: () => ({}), onSome: (top_p) => ({ top_p }) })
})

/** @internal */
export const openai = (settings: ModelSettings): OpenAi.Config["Service"] => ({
  ...common(settings),
  ...Option.match(Option.fromNullishOr(settings.maxTokens), {
    onNone: () => ({}),
    onSome: (max_output_tokens) => ({ max_output_tokens })
  })
})
/** @internal */
export const anthropic = (settings: ModelSettings): Anthropic.Config["Service"] => ({
  ...common(settings),
  ...Option.match(Option.fromNullishOr(settings.maxTokens), {
    onNone: () => ({}),
    onSome: (max_tokens) => ({ max_tokens })
  }),
  ...Option.match(Option.fromNullishOr(settings.stop), {
    onNone: () => ({}),
    onSome: (stop_sequences) => ({ stop_sequences })
  })
})
/** @internal */
export const openrouter = (settings: ModelSettings): OpenRouter.Config["Service"] => ({
  ...common(settings),
  ...Option.match(Option.fromNullishOr(settings.maxTokens), {
    onNone: () => ({}),
    onSome: (max_tokens) => ({ max_tokens })
  }),
  ...Option.match(Option.fromNullishOr(settings.stop), { onNone: () => ({}), onSome: (stop) => ({ stop }) }),
  ...Option.match(Option.fromNullishOr(settings.seed), { onNone: () => ({}), onSome: (seed) => ({ seed }) })
})

/** Read only ambient overrides; declared runtime defaults own captured configuration. @internal */
export const ambient = (provider: Provider): Effect.Effect<ModelSettings> =>
  Match.value(provider).pipe(
    Match.when("openai", () =>
      Effect.serviceOption(OpenAi.Config).pipe(Effect.map(Option.match({
        onNone: () => empty,
        onSome: (config) =>
          new ModelSettings(
            Record.filter(
              { temperature: config.temperature, maxTokens: config.max_output_tokens, topP: config.top_p },
              Predicate.isNotNullish
            )
          )
      })))),
    Match.when("anthropic", () =>
      Effect.serviceOption(Anthropic.Config).pipe(Effect.map(Option.match({
        onNone: () => empty,
        onSome: (config) =>
          new ModelSettings(
            Record.filter({
              temperature: config.temperature,
              maxTokens: config.max_tokens,
              topP: config.top_p,
              stop: config.stop_sequences
            }, Predicate.isNotNullish)
          )
      })))),
    Match.when("openrouter", () =>
      Effect.serviceOption(OpenRouter.Config).pipe(Effect.map(Option.match({
        onNone: () => empty,
        onSome: (config) =>
          new ModelSettings({
            ...Record.filter({
              temperature: config.temperature,
              maxTokens: config.max_tokens,
              topP: config.top_p,
              seed: config.seed
            }, Predicate.isNotNullish),
            ...Option.match(Option.fromNullishOr(config.stop), {
              onNone: () => ({}),
              onSome: (stop) => ({ stop: Predicate.isString(stop) ? Arr.make(stop) : stop })
            })
          })
      })))),
    Match.exhaustive
  )
