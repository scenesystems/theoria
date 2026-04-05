/**
 * Config-driven live text-runtime helpers for examples and consumers.
 *
 * @since 0.1.0
 */
import * as AnthropicClient from "@effect/ai-anthropic/AnthropicClient"
import * as AnthropicLanguageModel from "@effect/ai-anthropic/AnthropicLanguageModel"
import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import * as OpenAiLanguageModel from "@effect/ai-openai/OpenAiLanguageModel"
import * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { Effect, Layer, Match, Option } from "effect"

import type { DesiredRuntimeDescriptor } from "../contracts/DesiredRuntimeDescriptor.js"
import type { InvalidRuntimeConfig } from "../Errors/Config.js"
import {
  descriptorForLiveTextProvider,
  type LiveTextProvider,
  type LiveTextProviderRuntimeOptions,
  type ResolvedLiveTextProviderConfig,
  resolveLiveTextProviderConfig
} from "./liveTextProviderConfig.js"

/**
 * Resolved runtime configuration plus the package-owned requested descriptor and
 * live `LanguageModel` layer.
 *
 * @since 0.1.0
 * @category models
 */
export type ResolvedLiveTextProviderRuntime = Readonly<{
  readonly provider: LiveTextProvider
  readonly model: string
  readonly desired: DesiredRuntimeDescriptor
  readonly languageModelLayer: Layer.Layer<LanguageModel.LanguageModel, never, never>
}>

const optionalValue = <A>(value: Option.Option<A>) =>
  Option.match(value, { onNone: () => undefined, onSome: (resolved) => resolved })

const openAiLayer = (config: ResolvedLiveTextProviderConfig): Layer.Layer<LanguageModel.LanguageModel, never, never> =>
  Layer.provide(
    Layer.provide(
      OpenAiLanguageModel.layer({ model: config.model }),
      OpenAiClient.layer({ apiKey: config.apiKey, apiUrl: optionalValue(config.apiUrl) })
    ),
    FetchHttpClient.layer
  )

const anthropicLayer = (
  config: ResolvedLiveTextProviderConfig
): Layer.Layer<LanguageModel.LanguageModel, never, never> =>
  Layer.provide(
    Layer.provide(
      AnthropicLanguageModel.layer({ model: config.model }),
      AnthropicClient.layer({
        apiKey: config.apiKey,
        apiUrl: optionalValue(config.apiUrl),
        anthropicVersion: optionalValue(config.anthropicVersion)
      })
    ),
    FetchHttpClient.layer
  )

const openRouterLayer = (
  config: ResolvedLiveTextProviderConfig
): Layer.Layer<LanguageModel.LanguageModel, never, never> =>
  Layer.provide(
    Layer.provide(
      OpenRouterLanguageModel.layer({ model: config.model }),
      OpenRouterClient.layer({
        apiKey: config.apiKey,
        apiUrl: optionalValue(config.apiUrl),
        referrer: optionalValue(config.openrouterReferrer),
        title: optionalValue(config.openrouterTitle)
      })
    ),
    FetchHttpClient.layer
  )

const providerLayer = (
  config: ResolvedLiveTextProviderConfig
): Layer.Layer<LanguageModel.LanguageModel, never, never> =>
  Match.value(config.provider).pipe(
    Match.when("openai", () => openAiLayer(config)),
    Match.when("anthropic", () => anthropicLayer(config)),
    Match.when("openrouter", () => openRouterLayer(config)),
    Match.exhaustive
  )

/**
 * Resolves the requested runtime descriptor and live `LanguageModel` layer from
 * a Config-driven provider surface.
 *
 * @since 0.1.0
 * @category constructors
 */
export const resolveLiveTextProviderRuntime = (
  options: LiveTextProviderRuntimeOptions = {}
): Effect.Effect<ResolvedLiveTextProviderRuntime, InvalidRuntimeConfig> =>
  resolveLiveTextProviderConfig(options).pipe(
    Effect.map((config) => ({
      provider: config.provider,
      model: config.model,
      desired: descriptorForLiveTextProvider(config),
      languageModelLayer: providerLayer(config)
    }))
  )

/**
 * Constructs a live `LanguageModel` layer from the configured provider runtime.
 *
 * @since 0.1.0
 * @category layers
 */
export const liveTextProviderLayer = (
  options: LiveTextProviderRuntimeOptions = {}
): Layer.Layer<LanguageModel.LanguageModel, InvalidRuntimeConfig, never> =>
  Layer.unwrapEffect(resolveLiveTextProviderRuntime(options).pipe(Effect.map((runtime) => runtime.languageModelLayer)))

/**
 * Provides the configured live `LanguageModel` to an Effect program.
 *
 * @since 0.1.0
 * @category constructors
 */
export const withLiveTextProvider = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  options: LiveTextProviderRuntimeOptions = {}
): Effect.Effect<A, E | InvalidRuntimeConfig, Exclude<R, LanguageModel.LanguageModel>> =>
  effect.pipe(Effect.provide(liveTextProviderLayer(options)))
