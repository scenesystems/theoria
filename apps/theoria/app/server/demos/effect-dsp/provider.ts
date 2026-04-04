import * as AnthropicClient from "@effect/ai-anthropic/AnthropicClient"
import * as AnthropicLanguageModel from "@effect/ai-anthropic/AnthropicLanguageModel"
import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import * as OpenAiLanguageModel from "@effect/ai-openai/OpenAiLanguageModel"
import * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { Config, Context, Effect, Either, Layer, Match, Option, Schema } from "effect"
import type * as Redacted from "effect/Redacted"

import type { DspProvider } from "../../../contracts/capabilities.js"

export class DspProviderUnavailable extends Schema.TaggedError<DspProviderUnavailable>()(
  "DspProviderUnavailable",
  {
    message: Schema.String
  }
) {}

type ProviderCapability = {
  readonly enabled: boolean
  readonly provider: Option.Option<DspProvider>
  readonly model: Option.Option<string>
  readonly reason: Option.Option<string>
}

type ConfiguredProvider = {
  readonly provider: DspProvider
  readonly model: string
  readonly apiKey: Option.Option<Redacted.Redacted>
}

export class DspProviderRuntime extends Context.Tag("@theoria/app/server/demos/effect-dsp/DspProviderRuntime")<
  DspProviderRuntime,
  {
    readonly capability: ProviderCapability
    readonly layer: Option.Option<
      Layer.Layer<LanguageModel.LanguageModel, never, never>
    >
  }
>() {}

const defaultModel = (provider: DspProvider): string =>
  Match.value(provider).pipe(
    Match.when("openai", () => "gpt-4o-mini"),
    Match.when("anthropic", () => "claude-3-5-haiku-latest"),
    Match.orElse(() => "openai/gpt-4o-mini")
  )

const openAiLayer = (
  model: string,
  apiKey: Redacted.Redacted
): Layer.Layer<LanguageModel.LanguageModel, never, never> =>
  Layer.provide(
    Layer.provide(
      OpenAiLanguageModel.layer({ model }),
      OpenAiClient.layer({ apiKey })
    ),
    FetchHttpClient.layer
  )

const anthropicLayer = (
  model: string,
  apiKey: Redacted.Redacted
): Layer.Layer<LanguageModel.LanguageModel, never, never> =>
  Layer.provide(
    Layer.provide(
      AnthropicLanguageModel.layer({ model }),
      AnthropicClient.layer({ apiKey })
    ),
    FetchHttpClient.layer
  )

const openRouterLayer = (
  model: string,
  apiKey: Redacted.Redacted
): Layer.Layer<LanguageModel.LanguageModel, never, never> =>
  Layer.provide(
    Layer.provide(
      OpenRouterLanguageModel.layer({ model }),
      OpenRouterClient.layer({ apiKey })
    ),
    FetchHttpClient.layer
  )

const providerLayer = (
  provider: DspProvider,
  model: string,
  apiKey: Redacted.Redacted
): Layer.Layer<LanguageModel.LanguageModel, never, never> =>
  Match.value(provider).pipe(
    Match.when("openai", () => openAiLayer(model, apiKey)),
    Match.when("anthropic", () => anthropicLayer(model, apiKey)),
    Match.orElse(() => openRouterLayer(model, apiKey))
  )

const configuredProvider = Effect.gen(function*() {
  const provider = yield* Config.withDefault(
    Config.literal("openai", "anthropic", "openrouter")("DSP_PROVIDER"),
    "openai"
  )
  const model = yield* Config.withDefault(
    Config.string("DSP_PROVIDER_MODEL"),
    defaultModel(provider)
  )
  const openAiApiKey = yield* Config.option(Config.redacted("OPENAI_API_KEY"))
  const anthropicApiKey = yield* Config.option(Config.redacted("ANTHROPIC_API_KEY"))
  const openRouterApiKey = yield* Config.option(Config.redacted("OPENROUTER_API_KEY"))

  const apiKey = Match.value(provider).pipe(
    Match.when("openai", () => openAiApiKey),
    Match.when("anthropic", () => anthropicApiKey),
    Match.orElse(() => openRouterApiKey)
  )

  return {
    provider,
    model,
    apiKey
  }
})

const disabledRuntime = (reason: string) =>
  DspProviderRuntime.of({
    capability: {
      enabled: false,
      provider: Option.none(),
      model: Option.none(),
      reason: Option.some(reason)
    },
    layer: Option.none()
  })

const makeRuntime = Effect.gen(function*() {
  const decoded = yield* configuredProvider.pipe(Effect.either)

  return Either.match(decoded, {
    onLeft: () => disabledRuntime("DSP provider configuration is invalid."),
    onRight: (config: ConfiguredProvider) =>
      Option.match(config.apiKey, {
        onNone: () =>
          disabledRuntime(
            `DSP provider '${config.provider}' is selected but its API key is missing.`
          ),
        onSome: (apiKey) =>
          DspProviderRuntime.of({
            capability: {
              enabled: true,
              provider: Option.some(config.provider),
              model: Option.some(config.model),
              reason: Option.none()
            },
            layer: Option.some(providerLayer(config.provider, config.model, apiKey))
          })
      })
  })
})

export const DspProviderRuntimeLive = Layer.effect(DspProviderRuntime, makeRuntime)
