/**
 * Per-role hosted models with request-scoped generation settings.
 *
 * OpenAI Responses supports temperature, maxTokens (max_output_tokens), and topP;
 * stop and seed are unsupported. Anthropic Messages supports temperature,
 * maxTokens, topP, and stop (stop_sequences); seed is unsupported. OpenRouter
 * supports all five fields. Absent fields retain provider defaults. Supplied
 * unsupported fields fail model operations with InvalidRequestError before HTTP.
 *
 * @since 0.5.0
 * @module
 */
import * as AnthropicLanguageModel from "@effect/ai-anthropic/AnthropicLanguageModel"
import * as OpenAiLanguageModel from "@effect/ai-openai/OpenAiLanguageModel"
import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel"
import * as Binding from "@scenesystems/effect-lm/ModelBinder"
import type { ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import type { Role } from "@scenesystems/effect-lm/Role"
import { Effect, HashMap, Layer, Match, Option, Stream } from "effect"
import * as AiError from "effect/ai/AiError"
import * as LanguageModel from "effect/ai/LanguageModel"
import type { Provider, Runtime } from "./TextProvider.js"

const unsupported = (provider: Provider, settings: ModelSettings): Option.Option<string> =>
  Match.value(provider).pipe(
    Match.when("openai", () =>
      Option.fromNullishOr(settings.stop).pipe(
        Option.as("stop"),
        Option.orElse(() => Option.as(Option.fromNullishOr(settings.seed), "seed"))
      )),
    Match.when("anthropic", () => Option.as(Option.fromNullishOr(settings.seed), "seed")),
    Match.when("openrouter", () => Option.none()),
    Match.exhaustive
  )

const rejected = (parameter: string, constraint: string) => {
  const error = (method: string) =>
    AiError.make({
      module: "@scenesystems/effect-inference/ModelBinder",
      method,
      reason: new AiError.InvalidRequestError({ parameter, constraint, description: constraint })
    })
  return Layer.effect(
    LanguageModel.LanguageModel,
    LanguageModel.make({
      generateText: (options) =>
        Effect.fail(error(options.responseFormat.type === "json" ? "generateObject" : "generateText")),
      streamText: () => Stream.fail(error("streamText"))
    })
  )
}

const configured =
  (runtime: Runtime, settings: ModelSettings) => <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
    const common = {
      ...Option.match(Option.fromNullishOr(settings.temperature), {
        onNone: () => ({}),
        onSome: (temperature) => ({ temperature })
      }),
      ...Option.match(Option.fromNullishOr(settings.topP), { onNone: () => ({}), onSome: (top_p) => ({ top_p }) })
    }
    return Match.value(runtime.provider).pipe(
      Match.when("openai", () =>
        effect.pipe(OpenAiLanguageModel.withConfigOverride({
          ...common,
          ...Option.match(Option.fromNullishOr(settings.maxTokens), {
            onNone: () => ({}),
            onSome: (max_output_tokens) => ({ max_output_tokens })
          })
        }))),
      Match.when("anthropic", () =>
        effect.pipe(AnthropicLanguageModel.withConfigOverride({
          ...common,
          ...Option.match(Option.fromNullishOr(settings.maxTokens), {
            onNone: () => ({}),
            onSome: (max_tokens) => ({ max_tokens })
          }),
          ...Option.match(Option.fromNullishOr(settings.stop), {
            onNone: () => ({}),
            onSome: (stop_sequences) => ({ stop_sequences })
          })
        }))),
      Match.when("openrouter", () =>
        effect.pipe(OpenRouterLanguageModel.withConfigOverride({
          ...common,
          ...Option.match(Option.fromNullishOr(settings.maxTokens), {
            onNone: () => ({}),
            onSome: (max_tokens) => ({ max_tokens })
          }),
          ...Option.match(Option.fromNullishOr(settings.stop), { onNone: () => ({}), onSome: (stop) => ({ stop }) }),
          ...Option.match(Option.fromNullishOr(settings.seed), { onNone: () => ({}), onSome: (seed) => ({ seed }) })
        }))),
      Match.exhaustive,
      Effect.provide(runtime.languageModel)
    )
  }

/**
 * Provides a binder selecting the requested role, falling back to task.
 * Missing runtimes fail model operations with InvalidRequestError. The binder
 * does not change the wrapped effect's error or service channels.
 * @since 0.5.0
 * @category layers
 */
export const layer = (runtimes: HashMap.HashMap<Role, Runtime>) =>
  Layer.succeed(
    Binding.Current,
    new Binding.Binder({
      bind: (request) => <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
        Option.match(HashMap.get(runtimes, request.role).pipe(Option.orElse(() => HashMap.get(runtimes, "task"))), {
          onNone: () => Effect.provide(effect, rejected("role", `No runtime for ${request.role} or task`)),
          onSome: (runtime) =>
            Option.match(unsupported(runtime.provider, request.settings), {
              onNone: () => configured(runtime, request.settings)(effect),
              onSome: (field) =>
                Effect.provide(effect, rejected(field, `${runtime.provider} API does not support ${field}`))
            })
        })
    })
  )
