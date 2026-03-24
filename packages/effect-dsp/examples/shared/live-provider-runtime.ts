/**
 * Shared live-provider runtime composition for examples.
 */
import * as AnthropicClient from "@effect/ai-anthropic/AnthropicClient"
import * as AnthropicLanguageModel from "@effect/ai-anthropic/AnthropicLanguageModel"
import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import * as OpenAiLanguageModel from "@effect/ai-openai/OpenAiLanguageModel"
import * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { Config, ConfigError, ConfigProvider, Effect, Layer, Match, Option, Schema } from "effect"
import type * as Redacted from "effect/Redacted"

export type LiveProvider = "openai" | "anthropic" | "openrouter"

export type LiveProviderRuntimeOptions = Readonly<{
  readonly provider?: LiveProvider
  readonly model?: string
  readonly apiKey?: Redacted.Redacted
  readonly apiUrl?: string
  readonly anthropicVersion?: string
  readonly openrouterReferrer?: string
  readonly openrouterTitle?: string
  readonly configProvider?: ConfigProvider.ConfigProvider
}>

export class LiveProviderRuntimeError extends Schema.TaggedError<LiveProviderRuntimeError>()(
  "LiveProviderRuntimeError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown)
  }
) {}

type ProviderConfig = Readonly<{
  readonly provider: LiveProvider
  readonly model: string
  readonly apiKey: Redacted.Redacted
  readonly apiUrl: Option.Option<string>
  readonly anthropicVersion: Option.Option<string>
  readonly openrouterReferrer: Option.Option<string>
  readonly openrouterTitle: Option.Option<string>
}>

type ProviderOverrides = Readonly<{
  readonly provider: Option.Option<LiveProvider>
  readonly model: Option.Option<string>
  readonly apiKey: Option.Option<Redacted.Redacted>
  readonly apiUrl: Option.Option<string>
  readonly anthropicVersion: Option.Option<string>
  readonly openrouterReferrer: Option.Option<string>
  readonly openrouterTitle: Option.Option<string>
}>

const defaultModel = (provider: LiveProvider): string =>
  Match.value(provider).pipe(
    Match.when("openai", () => "gpt-4o-mini"),
    Match.when("anthropic", () => "claude-3-5-haiku-latest"),
    Match.when("openrouter", () => "openai/gpt-4o-mini"),
    Match.exhaustive
  )

const optionalString = (name: string): Config.Config<Option.Option<string>> => Config.option(Config.string(name))

const optionalRedacted = (name: string): Config.Config<Option.Option<Redacted.Redacted>> =>
  Config.option(Config.redacted(name))

const providerModelKey = (provider: LiveProvider): string =>
  Match.value(provider).pipe(
    Match.when("openai", () => "openaiModel"),
    Match.when("anthropic", () => "anthropicModel"),
    Match.when("openrouter", () => "openrouterModel"),
    Match.exhaustive
  )

const providerApiKeyKey = (provider: LiveProvider): string =>
  Match.value(provider).pipe(
    Match.when("openai", () => "openaiApiKey"),
    Match.when("anthropic", () => "anthropicApiKey"),
    Match.when("openrouter", () => "openrouterApiKey"),
    Match.exhaustive
  )

const providerApiUrlKey = (provider: LiveProvider): string =>
  Match.value(provider).pipe(
    Match.when("openai", () => "openaiApiUrl"),
    Match.when("anthropic", () => "anthropicApiUrl"),
    Match.when("openrouter", () => "openrouterApiUrl"),
    Match.exhaustive
  )

const providerApiKeyEnvName = (provider: LiveProvider): string =>
  Match.value(provider).pipe(
    Match.when("openai", () => "OPENAI_API_KEY"),
    Match.when("anthropic", () => "ANTHROPIC_API_KEY"),
    Match.when("openrouter", () => "OPENROUTER_API_KEY"),
    Match.exhaustive
  )

const firstDefinedOption = <A>(
  primary: Option.Option<A>,
  fallback: Option.Option<A>
): Option.Option<A> => Option.orElse(primary, () => fallback)

const requiredOption = <A>(
  option: Option.Option<A>,
  message: string
): Effect.Effect<A, ConfigError.ConfigError> =>
  Option.match(option, {
    onNone: () => Effect.fail(ConfigError.MissingData([], message)),
    onSome: (value) => Effect.succeed(value)
  })

const providerConfig = Effect.gen(function*() {
  const provider = yield* Config.withDefault(
    Config.literal("openai", "anthropic", "openrouter")("dspProvider"),
    "openai"
  )

  const globalModel = yield* optionalString("dspProviderModel")
  const providerModel = yield* optionalString(providerModelKey(provider))
  const model = Option.match(firstDefinedOption(globalModel, providerModel), {
    onNone: () => defaultModel(provider),
    onSome: (value) => value
  })

  const globalApiKey = yield* optionalRedacted("dspProviderApiKey")
  const providerApiKey = yield* optionalRedacted(providerApiKeyKey(provider))
  const apiKey = yield* requiredOption(
    firstDefinedOption(globalApiKey, providerApiKey),
    `Missing provider API key. Set DSP_PROVIDER_API_KEY or ${providerApiKeyEnvName(provider)}.`
  )

  const globalApiUrl = yield* optionalString("dspProviderApiUrl")
  const providerApiUrl = yield* optionalString(providerApiUrlKey(provider))
  const apiUrl = firstDefinedOption(globalApiUrl, providerApiUrl)

  const globalAnthropicVersion = yield* optionalString("dspProviderAnthropicVersion")
  const anthropicVersion = firstDefinedOption(globalAnthropicVersion, yield* optionalString("anthropicVersion"))

  const globalOpenrouterReferrer = yield* optionalString("dspProviderOpenrouterReferrer")
  const openrouterReferrer = firstDefinedOption(globalOpenrouterReferrer, yield* optionalString("openrouterReferrer"))

  const globalOpenrouterTitle = yield* optionalString("dspProviderOpenrouterTitle")
  const openrouterTitle = firstDefinedOption(globalOpenrouterTitle, yield* optionalString("openrouterTitle"))

  return {
    provider,
    model,
    apiKey,
    apiUrl,
    anthropicVersion,
    openrouterReferrer,
    openrouterTitle
  }
})

const defaultConfigProvider = ConfigProvider.fromEnv().pipe(
  ConfigProvider.constantCase
)

const decodeProviderConfig = (
  configProvider: ConfigProvider.ConfigProvider
): Effect.Effect<ProviderConfig, LiveProviderRuntimeError> =>
  providerConfig.pipe(
    Effect.withConfigProvider(configProvider),
    Effect.mapError((error) =>
      new LiveProviderRuntimeError({
        message: "Failed to decode live provider configuration",
        cause: error
      })
    )
  )

const overrideConfig = (options: LiveProviderRuntimeOptions): ProviderOverrides => ({
  provider: Option.fromNullable(options.provider),
  model: Option.fromNullable(options.model),
  apiKey: Option.fromNullable(options.apiKey),
  apiUrl: Option.fromNullable(options.apiUrl),
  anthropicVersion: Option.fromNullable(options.anthropicVersion),
  openrouterReferrer: Option.fromNullable(options.openrouterReferrer),
  openrouterTitle: Option.fromNullable(options.openrouterTitle)
})

const resolvedConfigProvider = (options: LiveProviderRuntimeOptions): ConfigProvider.ConfigProvider =>
  Option.getOrElse(Option.fromNullable(options.configProvider), () => defaultConfigProvider)

const mergeRequired = <A>(override: Option.Option<A>, base: A): A =>
  Option.match(override, {
    onNone: () => base,
    onSome: (value) => value
  })

const mergeOptional = <A>(override: Option.Option<A>, base: Option.Option<A>): Option.Option<A> =>
  Option.match(override, {
    onNone: () => base,
    onSome: (value) => Option.some(value)
  })

const withOverrides = (base: ProviderConfig, overrides: ProviderOverrides): ProviderConfig => ({
  provider: mergeRequired(overrides.provider, base.provider),
  model: mergeRequired(overrides.model, base.model),
  apiKey: mergeRequired(overrides.apiKey, base.apiKey),
  apiUrl: mergeOptional(overrides.apiUrl, base.apiUrl),
  anthropicVersion: mergeOptional(overrides.anthropicVersion, base.anthropicVersion),
  openrouterReferrer: mergeOptional(overrides.openrouterReferrer, base.openrouterReferrer),
  openrouterTitle: mergeOptional(overrides.openrouterTitle, base.openrouterTitle)
})

const optionalValue = <A>(value: Option.Option<A>) =>
  Option.match(value, {
    onNone: () => undefined,
    onSome: (resolved) => resolved
  })

const openAiLayer = (config: ProviderConfig): Layer.Layer<LanguageModel.LanguageModel, never, never> =>
  Layer.provide(
    Layer.provide(
      OpenAiLanguageModel.layer({
        model: config.model
      }),
      OpenAiClient.layer({
        apiKey: config.apiKey,
        apiUrl: optionalValue(config.apiUrl)
      })
    ),
    FetchHttpClient.layer
  )

const anthropicLayer = (config: ProviderConfig): Layer.Layer<LanguageModel.LanguageModel, never, never> =>
  Layer.provide(
    Layer.provide(
      AnthropicLanguageModel.layer({
        model: config.model
      }),
      AnthropicClient.layer({
        apiKey: config.apiKey,
        apiUrl: optionalValue(config.apiUrl),
        anthropicVersion: optionalValue(config.anthropicVersion)
      })
    ),
    FetchHttpClient.layer
  )

const openRouterLayer = (config: ProviderConfig): Layer.Layer<LanguageModel.LanguageModel, never, never> =>
  Layer.provide(
    Layer.provide(
      OpenRouterLanguageModel.layer({
        model: config.model
      }),
      OpenRouterClient.layer({
        apiKey: config.apiKey,
        apiUrl: optionalValue(config.apiUrl),
        referrer: optionalValue(config.openrouterReferrer),
        title: optionalValue(config.openrouterTitle)
      })
    ),
    FetchHttpClient.layer
  )

const providerLayer = (config: ProviderConfig): Layer.Layer<LanguageModel.LanguageModel, never, never> =>
  Match.value(config.provider).pipe(
    Match.when("openai", () => openAiLayer(config)),
    Match.when("anthropic", () => anthropicLayer(config)),
    Match.when("openrouter", () => openRouterLayer(config)),
    Match.exhaustive
  )

export const resolveLiveProviderConfig = (
  options: LiveProviderRuntimeOptions = {}
): Effect.Effect<ProviderConfig, LiveProviderRuntimeError> =>
  decodeProviderConfig(resolvedConfigProvider(options)).pipe(
    Effect.map((base) => withOverrides(base, overrideConfig(options)))
  )

export type ResolvedLiveProviderConfig = ProviderConfig

export const liveLanguageModelLayer = (
  options: LiveProviderRuntimeOptions = {}
): Layer.Layer<LanguageModel.LanguageModel, LiveProviderRuntimeError, never> =>
  Layer.unwrapEffect(
    resolveLiveProviderConfig(options).pipe(
      Effect.map(providerLayer)
    )
  )

export const withLiveLanguageModel = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  options: LiveProviderRuntimeOptions = {}
): Effect.Effect<A, E | LiveProviderRuntimeError, Exclude<R, LanguageModel.LanguageModel>> =>
  effect.pipe(
    Effect.provide(liveLanguageModelLayer(options))
  )
