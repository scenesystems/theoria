/**
 * Configuration precedence and defaults for hosted text providers.
 *
 * @since 0.1.0
 */
import { Config, ConfigError, ConfigProvider, Effect, Match, Option, Redacted } from "effect"

import type { DesiredRuntimeDescriptor } from "../contracts/DesiredRuntimeDescriptor.js"
import { InvalidRuntimeConfig } from "../Errors/Config.js"

/**
 * Providers accepted by the config-driven language-model layer.
 *
 * @since 0.1.0
 * @category models
 */
export type LiveTextProvider = "openai" | "anthropic" | "openrouter"

/**
 * Explicit overrides for hosted text-provider configuration. Present values
 * take precedence over the selected `ConfigProvider`.
 *
 * @since 0.1.0
 * @category models
 */
export type LiveTextProviderRuntimeOptions = Readonly<{
  /** Provider adapter; defaults to `openai`. */
  readonly provider?: LiveTextProvider
  /** Provider model identifier; defaults according to `provider`. */
  readonly model?: string
  /** Required credential, retained as `Redacted`. */
  readonly apiKey?: Redacted.Redacted
  /** Optional API base URL replacing the provider default. */
  readonly apiUrl?: string
  /** Optional Anthropic API version header. */
  readonly anthropicVersion?: string
  /** Optional OpenRouter HTTP referrer header. */
  readonly openrouterReferrer?: string
  /** Optional OpenRouter application title header. */
  readonly openrouterTitle?: string
  /** Configuration source used for values without explicit overrides. */
  readonly configProvider?: ConfigProvider.ConfigProvider
}>

/**
 * Provider settings after defaults, configuration, and explicit overrides are
 * merged. The API key is always present and remains redacted.
 *
 * @since 0.1.0
 * @category models
 */
export type ResolvedLiveTextProviderConfig = Readonly<{
  /** Selected provider adapter. */
  readonly provider: LiveTextProvider
  /** Model identifier passed to the provider client. */
  readonly model: string
  /** Credential passed to the provider client. */
  readonly apiKey: Redacted.Redacted
  /** API base URL override, or `None` to use the client default. */
  readonly apiUrl: Option.Option<string>
  /** Anthropic API version header, when configured. */
  readonly anthropicVersion: Option.Option<string>
  /** OpenRouter referrer header, when configured. */
  readonly openrouterReferrer: Option.Option<string>
  /** OpenRouter application title header, when configured. */
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

const nonEmptyString = (value: string): boolean => value.trim().length > 0

const optionalString = (name: string): Config.Config<Option.Option<string>> =>
  Config.option(Config.string(name)).pipe(
    Config.map(Option.filter(nonEmptyString)),
    Config.map(Option.map((value) => value.trim()))
  )

const optionalRedacted = (name: string): Config.Config<Option.Option<Redacted.Redacted>> =>
  Config.option(Config.redacted(name)).pipe(
    Config.map(Option.filter((value) => nonEmptyString(Redacted.value(value))))
  )

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
 * Maps hosted provider config to caller intent and an explicit execution route.
 * Provider-specific base URLs are used when `apiUrl` is `None`.
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
 * Resolves hosted text-provider configuration without contacting the provider.
 *
 * @remarks
 * Resolves explicit overrides over environment-backed settings. Provider
 * defaults to `openai`; model defaults are provider-specific. An API key is
 * mandatory after merging (`DSP_PROVIDER_API_KEY` or the provider-specific
 * key), and every Effect Config failure is wrapped as `InvalidRuntimeConfig`.
 * Secrets remain `Redacted` in the result.
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
