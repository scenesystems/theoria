/**
 * Config-driven hosted OpenAI, Anthropic, and OpenRouter language models.
 *
 * @since 0.5.0
 * @module
 */
import * as AnthropicClient from "@effect/ai-anthropic/AnthropicClient"
import * as AnthropicLanguageModel from "@effect/ai-anthropic/AnthropicLanguageModel"
import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import * as OpenAiLanguageModel from "@effect/ai-openai/OpenAiLanguageModel"
import * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel"
import { empty, ModelSettings } from "@scenesystems/effect-lm/ModelSettings"
import type * as LanguageModel from "effect/ai/LanguageModel"
import * as ConfigEffect from "effect/Config"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as Layer from "effect/Layer"
import * as Match from "effect/Match"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import * as String from "effect/String"

import { InvalidRuntimeConfig } from "./InferenceError.js"
import * as Settings from "./internal/modelSettings.js"
import type * as RuntimeRequest from "./RuntimeRequest.js"

/** Schema for hosted text-provider identifiers. @since 0.5.0 @category schemas */
export const Provider = Schema.Literals(["openai", "anthropic", "openrouter"])
/** Hosted text-provider identifier inferred from its schema. @since 0.5.0 @category models */
export type Provider = typeof Provider.Type

/** Explicit overrides and configuration source for a hosted provider. @since 0.5.0 @category models */
export class Options extends Data.Class<{
  readonly provider?: Provider
  readonly model?: string
  readonly defaults?: ModelSettings
  readonly apiKey?: Redacted.Redacted
  readonly apiUrl?: string
  readonly anthropicVersion?: string
  readonly openrouterReferrer?: string
  readonly openrouterTitle?: string
  readonly configProvider?: ConfigProvider.ConfigProvider
}> {}

/** Validated hosted-provider configuration with redacted credentials. @since 0.5.0 @category models */
export class Config extends Schema.Class<Config>("@scenesystems/effect-inference/TextProvider/Config")({
  provider: Provider,
  model: Schema.String,
  defaults: ModelSettings,
  apiKey: Schema.Redacted(Schema.String),
  apiUrl: Schema.Option(Schema.String),
  anthropicVersion: Schema.Option(Schema.String),
  openrouterReferrer: Schema.Option(Schema.String),
  openrouterTitle: Schema.Option(Schema.String)
}) {}

/** Hosted-provider runtime derived from one validated configuration.
 * Model identity, defaults, request intent and the executable layer share that
 * configuration. A supplied HttpClient service overrides the default fetch transport.
 * @since 0.5.0
 * @category models
 */
export class Runtime extends Data.Class<{
  readonly config: Config
}> {
  get provider(): Provider {
    return this.config.provider
  }
  get model(): string {
    return this.config.model
  }
  get defaults(): ModelSettings {
    return this.config.defaults
  }
  get request(): RuntimeRequest.RuntimeRequest {
    return request(this.config)
  }
  get languageModel(): Layer.Layer<LanguageModel.LanguageModel> {
    return providerLayer(this.config)
  }
}

const defaultConfigProvider = ConfigProvider.fromEnv().pipe(ConfigProvider.constantCase)

const defaultModel = (provider: Provider): string =>
  Match.value(provider).pipe(
    Match.when("openai", () => "gpt-4o-mini"),
    Match.when("anthropic", () => "claude-3-5-haiku-latest"),
    Match.when("openrouter", () => "openai/gpt-4o-mini"),
    Match.exhaustive
  )

const optionalString = (name: string) =>
  ConfigEffect.option(ConfigEffect.String(name)).pipe(
    ConfigEffect.map(Option.map(String.trim)),
    ConfigEffect.map(Option.filter(String.isNonEmpty))
  )

const optionalRedacted = (name: string) =>
  ConfigEffect.option(ConfigEffect.Redacted(name)).pipe(
    ConfigEffect.map(Option.filter((value) => String.isNonEmpty(String.trim(Redacted.value(value)))))
  )

const providerKey = (provider: Provider, field: "Model" | "ApiKey" | "ApiUrl"): string => String.concat(provider, field)

const providerEnvKey = (provider: Provider): string =>
  Match.value(provider).pipe(
    Match.when("openai", () => "OPENAI_API_KEY"),
    Match.when("anthropic", () => "ANTHROPIC_API_KEY"),
    Match.when("openrouter", () => "OPENROUTER_API_KEY"),
    Match.exhaustive
  )

const required = <A>(value: Option.Option<A>, message: string): Effect.Effect<A, ConfigEffect.ConfigError> =>
  Effect.fromOption(value, () => new ConfigEffect.ConfigError(new ConfigProvider.SourceError({ message })))

const configured = (options: Options) =>
  Effect.gen(function*() {
    const provider = yield* Option.match(Option.fromNullishOr(options.provider), {
      onSome: Effect.succeed,
      onNone: () => ConfigEffect.withDefault(ConfigEffect.Literals(Provider.literals, "dspProvider"), "openai")
    })
    const providerModel = yield* optionalString(providerKey(provider, "Model"))
    const genericModel = yield* optionalString("dspProviderModel")
    const model = Option.fromNullishOr(options.model).pipe(
      Option.map(String.trim),
      Option.filter(String.isNonEmpty),
      Option.orElse(() => providerModel),
      Option.orElse(() => genericModel),
      Option.getOrElse(() => defaultModel(provider))
    )
    const providerApiKey = yield* optionalRedacted(providerKey(provider, "ApiKey"))
    const genericApiKey = yield* optionalRedacted("dspProviderApiKey")
    const apiKey = yield* required(
      Option.fromNullishOr(options.apiKey).pipe(
        Option.filter((value) => String.isNonEmpty(String.trim(Redacted.value(value)))),
        Option.orElse(() => providerApiKey),
        Option.orElse(() => genericApiKey)
      ),
      String.concat(
        "Missing provider API key. Set DSP_PROVIDER_API_KEY or ",
        String.concat(providerEnvKey(provider), ".")
      )
    )
    const providerApiUrl = yield* optionalString(providerKey(provider, "ApiUrl"))
    const genericApiUrl = yield* optionalString("dspProviderApiUrl")
    const anthropicVersion = yield* optionalString("anthropicVersion")
    const genericAnthropicVersion = yield* optionalString("dspProviderAnthropicVersion")
    const openrouterReferrer = yield* optionalString("openrouterReferrer")
    const genericOpenrouterReferrer = yield* optionalString("dspProviderOpenrouterReferrer")
    const openrouterTitle = yield* optionalString("openrouterTitle")
    const genericOpenrouterTitle = yield* optionalString("dspProviderOpenrouterTitle")
    const mergeString = (primary: Option.Option<string>, fallback: Option.Option<string>, override?: string) =>
      Option.fromNullishOr(override).pipe(
        Option.map(String.trim),
        Option.filter(String.isNonEmpty),
        Option.orElse(() => primary),
        Option.orElse(() => fallback)
      )

    return new Config({
      provider,
      model,
      defaults: options.defaults ?? (yield* ConfigEffect.withDefault(
        ConfigEffect.schema(Schema.fromJsonString(Schema.toCodecJson(ModelSettings)), "dspModelSettings"),
        empty
      )),
      apiKey,
      apiUrl: mergeString(providerApiUrl, genericApiUrl, options.apiUrl),
      anthropicVersion: mergeString(anthropicVersion, genericAnthropicVersion, options.anthropicVersion),
      openrouterReferrer: mergeString(openrouterReferrer, genericOpenrouterReferrer, options.openrouterReferrer),
      openrouterTitle: mergeString(openrouterTitle, genericOpenrouterTitle, options.openrouterTitle)
    })
  })

/**
 * Acquires provider configuration. Explicit values override provider-specific
 * settings, which override generic DSP settings.
 *
 * @since 0.5.0
 * @category configuration
 */
export const fromConfig = (options: Options = new Options({})): Effect.Effect<Config, InvalidRuntimeConfig> =>
  configured(options).pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      Option.getOrElse(Option.fromNullishOr(options.configProvider), () => defaultConfigProvider)
    ),
    Effect.mapError((error) => new InvalidRuntimeConfig({ reason: error.message }))
  )

/** Converts validated hosted-provider configuration into runtime intent. @since 0.5.0 @category constructors */
export const request = (config: Config): RuntimeRequest.RuntimeRequest =>
  Match.value(config.provider).pipe(
    Match.when("openai", (): RuntimeRequest.RuntimeRequest => ({
      model: { modelRef: config.model },
      route: {
        family: "OpenAiResponses",
        serveMode: "hosted-api",
        authMethod: "api-key",
        baseUrl: Option.getOrElse(config.apiUrl, () => "https://api.openai.com/v1")
      }
    })),
    Match.when("anthropic", (): RuntimeRequest.RuntimeRequest => ({
      model: { modelRef: config.model },
      route: {
        family: "AnthropicMessages",
        serveMode: "hosted-api",
        authMethod: "api-key",
        baseUrl: Option.getOrElse(config.apiUrl, () => "https://api.anthropic.com")
      }
    })),
    Match.when("openrouter", (): RuntimeRequest.RuntimeRequest => ({
      model: { modelRef: config.model },
      route: {
        family: "OpenAiCompatible",
        serveMode: "routed-marketplace",
        authMethod: "api-key",
        baseUrl: Option.getOrElse(config.apiUrl, () => "https://openrouter.ai/api/v1"),
        gatewayId: "openrouter"
      }
    })),
    Match.exhaustive
  )

const transport = Layer.unwrap(
  Effect.map(
    Effect.serviceOption(HttpClient.HttpClient),
    Option.match({
      onNone: () => FetchHttpClient.layer,
      onSome: (client) => Layer.succeed(HttpClient.HttpClient, client)
    })
  )
)

const providerLayer = (config: Config): Layer.Layer<LanguageModel.LanguageModel> =>
  Match.value(config.provider).pipe(
    Match.when("openai", () =>
      Layer.provide(
        Layer.provide(
          OpenAiLanguageModel.layer({ model: config.model, config: Settings.openai(config.defaults) }),
          OpenAiClient.layer({
            apiKey: config.apiKey,
            ...Option.match(config.apiUrl, { onNone: () => ({}), onSome: (apiUrl) => ({ apiUrl }) })
          })
        ),
        transport
      )),
    Match.when("anthropic", () =>
      Layer.provide(
        Layer.provide(
          AnthropicLanguageModel.layer({ model: config.model, config: Settings.anthropic(config.defaults) }),
          AnthropicClient.layer({
            apiKey: config.apiKey,
            ...Option.match(config.apiUrl, { onNone: () => ({}), onSome: (apiUrl) => ({ apiUrl }) }),
            ...Option.match(config.anthropicVersion, {
              onNone: () => ({}),
              onSome: (anthropicVersion) => ({ anthropicVersion })
            })
          })
        ),
        transport
      )),
    Match.when("openrouter", () =>
      Layer.provide(
        Layer.provide(
          OpenRouterLanguageModel.layer({ model: config.model, config: Settings.openrouter(config.defaults) }),
          OpenRouterClient.layer({
            apiKey: config.apiKey,
            ...Option.match(config.apiUrl, { onNone: () => ({}), onSome: (apiUrl) => ({ apiUrl }) }),
            ...Option.match(config.openrouterReferrer, {
              onNone: () => ({}),
              onSome: (referrer) => ({ referrer })
            }),
            ...Option.match(config.openrouterTitle, { onNone: () => ({}), onSome: (title) => ({ title }) })
          })
        ),
        transport
      )),
    Match.exhaustive
  )

/** Acquires configuration and resolves a hosted-provider language runtime. @since 0.5.0 @category constructors */
export const resolve = (options: Options = new Options({})): Effect.Effect<Runtime, InvalidRuntimeConfig> =>
  fromConfig(options).pipe(Effect.map((config) => new Runtime({ config })))

/** Builds a language-model layer from checked hosted-provider configuration. @since 0.5.0 @category layers */
export const layerConfig = (
  options: Options = new Options({})
): Layer.Layer<LanguageModel.LanguageModel, InvalidRuntimeConfig> =>
  Layer.unwrap(resolve(options).pipe(Effect.map((runtime) => runtime.languageModel)))
