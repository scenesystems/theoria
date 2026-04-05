/**
 * Config decoding for the live text-provider lane.
 *
 * @since 0.1.0
 */
import { Config, ConfigError, ConfigProvider, Effect, Match, Option } from "effect"
import type * as Redacted from "effect/Redacted"

import type { DesiredRuntimeDescriptor } from "../contracts/DesiredRuntimeDescriptor.js"
import { InvalidRuntimeConfig } from "../Errors/Config.js"

/**
 * Hosted and brokered text providers supported by the config-driven live lane.
 *
 * @since 0.1.0
 * @category models
 */
export type LiveTextProvider = "openai" | "anthropic" | "openrouter"

/**
 * Override surface for config-driven live text runtime construction.
 *
 * @since 0.1.0
 * @category models
 */
export type LiveTextProviderRuntimeOptions = Readonly<{
  readonly provider?: LiveTextProvider
  readonly model?: string
  readonly apiKey?: Redacted.Redacted
  readonly apiUrl?: string
  readonly anthropicVersion?: string
  readonly openrouterReferrer?: string
  readonly openrouterTitle?: string
  readonly configProvider?: ConfigProvider.ConfigProvider
}>

/**
 * Fully resolved provider settings used to construct a live text runtime.
 *
 * @since 0.1.0
 * @category models
 */
export type ResolvedLiveTextProviderConfig = Readonly<{
  readonly provider: LiveTextProvider
  readonly model: string
  readonly apiKey: Redacted.Redacted
  readonly apiUrl: Option.Option<string>
  readonly anthropicVersion: Option.Option<string>
  readonly openrouterReferrer: Option.Option<string>
  readonly openrouterTitle: Option.Option<string>
}>

type DecodedLiveTextProviderConfig = Readonly<{
  readonly provider: LiveTextProvider
  readonly model: string
  readonly apiKey: Option.Option<Redacted.Redacted>
  readonly apiUrl: Option.Option<string>
  readonly anthropicVersion: Option.Option<string>
  readonly openrouterReferrer: Option.Option<string>
  readonly openrouterTitle: Option.Option<string>
}>

type ProviderOverrides = Readonly<{
  readonly provider: Option.Option<LiveTextProvider>
  readonly model: Option.Option<string>
  readonly apiKey: Option.Option<Redacted.Redacted>
  readonly apiUrl: Option.Option<string>
  readonly anthropicVersion: Option.Option<string>
  readonly openrouterReferrer: Option.Option<string>
  readonly openrouterTitle: Option.Option<string>
}>

const defaultConfigProvider = ConfigProvider.fromEnv().pipe(ConfigProvider.constantCase)

const defaultModel = (provider: LiveTextProvider): string =>
  Match.value(provider).pipe(
    Match.when("openai", () => "gpt-4o-mini"),
    Match.when("anthropic", () => "claude-3-5-haiku-latest"),
    Match.when("openrouter", () => "openai/gpt-4o-mini"),
    Match.exhaustive
  )

const optionalString = (name: string): Config.Config<Option.Option<string>> => Config.option(Config.string(name))

const optionalRedacted = (name: string): Config.Config<Option.Option<Redacted.Redacted>> =>
  Config.option(Config.redacted(name))

const providerModelKey = (provider: LiveTextProvider): string =>
  Match.value(provider).pipe(
    Match.when("openai", () => "openaiModel"),
    Match.when("anthropic", () => "anthropicModel"),
    Match.when("openrouter", () => "openrouterModel"),
    Match.exhaustive
  )

const providerApiKeyKey = (provider: LiveTextProvider): string =>
  Match.value(provider).pipe(
    Match.when("openai", () => "openaiApiKey"),
    Match.when("anthropic", () => "anthropicApiKey"),
    Match.when("openrouter", () => "openrouterApiKey"),
    Match.exhaustive
  )

const providerApiUrlKey = (provider: LiveTextProvider): string =>
  Match.value(provider).pipe(
    Match.when("openai", () => "openaiApiUrl"),
    Match.when("anthropic", () => "anthropicApiUrl"),
    Match.when("openrouter", () => "openrouterApiUrl"),
    Match.exhaustive
  )

const providerApiKeyEnvName = (provider: LiveTextProvider): string =>
  Match.value(provider).pipe(
    Match.when("openai", () => "OPENAI_API_KEY"),
    Match.when("anthropic", () => "ANTHROPIC_API_KEY"),
    Match.when("openrouter", () => "OPENROUTER_API_KEY"),
    Match.exhaustive
  )

const firstDefinedOption = <A>(primary: Option.Option<A>, fallback: Option.Option<A>): Option.Option<A> =>
  Option.orElse(primary, () => fallback)

const requiredOption = <A>(
  option: Option.Option<A>,
  message: string
): Effect.Effect<A, ConfigError.ConfigError> =>
  Option.match(option, { onNone: () => Effect.fail(ConfigError.MissingData([], message)), onSome: Effect.succeed })

const providerConfig = Effect.gen(function*() {
  const provider = yield* Config.withDefault(
    Config.literal("openai", "anthropic", "openrouter")("dspProvider"),
    "openai"
  )

  return {
    provider,
    model: Option.match(
      firstDefinedOption(yield* optionalString(providerModelKey(provider)), yield* optionalString("dspProviderModel")),
      { onNone: () => defaultModel(provider), onSome: (value) => value }
    ),
    apiKey: firstDefinedOption(
      yield* optionalRedacted(providerApiKeyKey(provider)),
      yield* optionalRedacted("dspProviderApiKey")
    ),
    apiUrl: firstDefinedOption(
      yield* optionalString(providerApiUrlKey(provider)),
      yield* optionalString("dspProviderApiUrl")
    ),
    anthropicVersion: firstDefinedOption(
      yield* optionalString("anthropicVersion"),
      yield* optionalString("dspProviderAnthropicVersion")
    ),
    openrouterReferrer: firstDefinedOption(
      yield* optionalString("openrouterReferrer"),
      yield* optionalString("dspProviderOpenrouterReferrer")
    ),
    openrouterTitle: firstDefinedOption(
      yield* optionalString("openrouterTitle"),
      yield* optionalString("dspProviderOpenrouterTitle")
    )
  }
})

const overrideConfig = (options: LiveTextProviderRuntimeOptions): ProviderOverrides => ({
  provider: Option.fromNullable(options.provider),
  model: Option.fromNullable(options.model),
  apiKey: Option.fromNullable(options.apiKey),
  apiUrl: Option.fromNullable(options.apiUrl),
  anthropicVersion: Option.fromNullable(options.anthropicVersion),
  openrouterReferrer: Option.fromNullable(options.openrouterReferrer),
  openrouterTitle: Option.fromNullable(options.openrouterTitle)
})

const mergeRequired = <A>(override: Option.Option<A>, base: A): A =>
  Option.match(override, { onNone: () => base, onSome: (value) => value })

const mergeOptional = <A>(override: Option.Option<A>, base: Option.Option<A>): Option.Option<A> =>
  Option.match(override, { onNone: () => base, onSome: (value) => Option.some(value) })

const withOverrides = (
  base: DecodedLiveTextProviderConfig,
  overrides: ProviderOverrides
): DecodedLiveTextProviderConfig => ({
  provider: mergeRequired(overrides.provider, base.provider),
  model: mergeRequired(overrides.model, base.model),
  apiKey: mergeOptional(overrides.apiKey, base.apiKey),
  apiUrl: mergeOptional(overrides.apiUrl, base.apiUrl),
  anthropicVersion: mergeOptional(overrides.anthropicVersion, base.anthropicVersion),
  openrouterReferrer: mergeOptional(overrides.openrouterReferrer, base.openrouterReferrer),
  openrouterTitle: mergeOptional(overrides.openrouterTitle, base.openrouterTitle)
})

/**
 * Projects the requested runtime descriptor from resolved provider config.
 *
 * @since 0.1.0
 * @category constructors
 */
export const descriptorForLiveTextProvider = (
  config: ResolvedLiveTextProviderConfig
): DesiredRuntimeDescriptor =>
  Match.value(config.provider).pipe(
    Match.when("openai", () => {
      const route: NonNullable<DesiredRuntimeDescriptor["route"]> = {
        family: "OpenAiResponses",
        serveMode: "hosted-api",
        authMethod: "api-key",
        baseUrl: Option.getOrElse(config.apiUrl, () => "https://api.openai.com/v1")
      }

      return {
        artifact: { modelRef: config.model },
        route
      }
    }),
    Match.when("anthropic", () => {
      const route: NonNullable<DesiredRuntimeDescriptor["route"]> = {
        family: "AnthropicMessages",
        serveMode: "hosted-api",
        authMethod: "api-key",
        baseUrl: Option.getOrElse(config.apiUrl, () => "https://api.anthropic.com")
      }

      return {
        artifact: { modelRef: config.model },
        route
      }
    }),
    Match.when("openrouter", () => {
      const route: NonNullable<DesiredRuntimeDescriptor["route"]> = {
        family: "OpenAiCompatible",
        serveMode: "routed-marketplace",
        authMethod: "api-key",
        baseUrl: Option.getOrElse(config.apiUrl, () => "https://openrouter.ai/api/v1"),
        gatewayId: "openrouter"
      }

      return {
        artifact: { modelRef: config.model },
        route
      }
    }),
    Match.exhaustive
  )

/**
 * Resolves config-backed provider settings into one package-owned live runtime
 * config record.
 *
 * @since 0.1.0
 * @category constructors
 */
export const resolveLiveTextProviderConfig = (
  options: LiveTextProviderRuntimeOptions = {}
): Effect.Effect<ResolvedLiveTextProviderConfig, InvalidRuntimeConfig> =>
  providerConfig.pipe(
    Effect.withConfigProvider(options.configProvider ?? defaultConfigProvider),
    Effect.map((base) => withOverrides(base, overrideConfig(options))),
    Effect.flatMap((config) =>
      requiredOption(
        config.apiKey,
        `Missing provider API key. Set DSP_PROVIDER_API_KEY or ${providerApiKeyEnvName(config.provider)}.`
      ).pipe(
        Effect.map((apiKey) => ({
          provider: config.provider,
          model: config.model,
          apiKey,
          apiUrl: config.apiUrl,
          anthropicVersion: config.anthropicVersion,
          openrouterReferrer: config.openrouterReferrer,
          openrouterTitle: config.openrouterTitle
        }))
      )
    ),
    Effect.mapError((error) => new InvalidRuntimeConfig({ reason: String(error) }))
  )
