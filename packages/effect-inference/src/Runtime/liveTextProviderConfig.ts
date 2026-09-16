/**
 * Configuration precedence and defaults for hosted text providers.
 *
 * @since 0.1.0
 */
import {
  Array as Arr,
  Config,
  ConfigError,
  ConfigProvider,
  Data,
  Effect,
  Match,
  Option,
  Redacted,
  Schema,
  String
} from "effect"

import { type DesiredRuntimeDescriptor, DesiredRuntimeDescriptorSchema } from "../contracts/DesiredRuntimeDescriptor.js"
import { ExecutionRouteSchema } from "../contracts/ExecutionRoute.js"
import { InvalidRuntimeConfig } from "../Errors/Config.js"

/**
 * Providers accepted by the config-driven language-model layer.
 *
 * @since 0.1.0
 * @category schemas
 */
export const LiveTextProviderSchema = Schema.Literal("openai", "anthropic", "openrouter")

/**
 * Providers accepted by the config-driven language-model layer.
 *
 * @since 0.1.0
 * @category models
 */
export type LiveTextProvider = typeof LiveTextProviderSchema.Type

/**
 * Explicit overrides for hosted text-provider configuration. Present values
 * take precedence over the selected `ConfigProvider`.
 *
 * @since 0.1.0
 * @category models
 */
export class LiveTextProviderRuntimeOptions extends Data.Class<{
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
}> {}

/**
 * Provider settings after defaults, configuration, and explicit overrides are
 * merged. The API key is always present and remains redacted.
 *
 * @since 0.1.0
 * @category models
 */
export class ResolvedLiveTextProviderConfig extends Schema.Class<ResolvedLiveTextProviderConfig>(
  "ResolvedLiveTextProviderConfig"
)({
  /** Selected provider adapter. */
  provider: LiveTextProviderSchema,
  /** Model identifier passed to the provider client. */
  model: Schema.String,
  /** Credential passed to the provider client. */
  apiKey: Schema.RedactedFromSelf(Schema.String),
  /** API base URL override, or `None` to use the client default. */
  apiUrl: Schema.OptionFromSelf(Schema.String),
  /** Anthropic API version header, when configured. */
  anthropicVersion: Schema.OptionFromSelf(Schema.String),
  /** OpenRouter referrer header, when configured. */
  openrouterReferrer: Schema.OptionFromSelf(Schema.String),
  /** OpenRouter application title header, when configured. */
  openrouterTitle: Schema.OptionFromSelf(Schema.String)
}) {}

const defaultConfigProvider = ConfigProvider.fromEnv().pipe(ConfigProvider.constantCase)

const defaultModel = (provider: LiveTextProvider): string =>
  Match.value(provider).pipe(
    Match.when("openai", () => "gpt-4o-mini"),
    Match.when("anthropic", () => "claude-3-5-haiku-latest"),
    Match.when("openrouter", () => "openai/gpt-4o-mini"),
    Match.exhaustive
  )

const optionalString = (name: string): Config.Config<Option.Option<string>> =>
  Config.option(Config.string(name)).pipe(
    Config.map(Option.map(String.trim)),
    Config.map(Option.filter(String.isNonEmpty))
  )

const optionalRedacted = (name: string): Config.Config<Option.Option<Redacted.Redacted>> =>
  Config.option(Config.redacted(name)).pipe(
    Config.map(Option.filter((value) => String.isNonEmpty(String.trim(Redacted.value(value)))))
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

const requiredOption = <A>(
  option: Option.Option<A>,
  message: string
): Effect.Effect<A, ConfigError.ConfigError> =>
  Option.match(option, {
    onNone: () => Effect.fail(ConfigError.MissingData(Arr.empty(), message)),
    onSome: Effect.succeed
  })

const providerConfig = (options: LiveTextProviderRuntimeOptions) =>
  Effect.gen(function*() {
    const provider = yield* Option.match(Option.fromNullable(options.provider), {
      onNone: () =>
        Config.withDefault(
          Config.literal(...LiveTextProviderSchema.literals)("dspProvider"),
          "openai"
        ),
      onSome: Effect.succeed
    })
    const providerModel = yield* optionalString(providerModelKey(provider))
    const genericModel = yield* optionalString("dspProviderModel")
    const configuredModel = providerModel.pipe(Option.orElse(() => genericModel))
    const model = Option.fromNullable(options.model).pipe(
      Option.map(String.trim),
      Option.filter(String.isNonEmpty),
      Option.orElse(() => configuredModel),
      Option.getOrElse(() => defaultModel(provider))
    )
    const providerApiKey = yield* optionalRedacted(providerApiKeyKey(provider))
    const genericApiKey = yield* optionalRedacted("dspProviderApiKey")
    const configuredApiKey = providerApiKey.pipe(Option.orElse(() => genericApiKey))
    const apiKey = yield* requiredOption(
      Option.fromNullable(options.apiKey).pipe(
        Option.filter((value) => String.isNonEmpty(String.trim(Redacted.value(value)))),
        Option.orElse(() => configuredApiKey)
      ),
      String.concat(
        "Missing provider API key. Set DSP_PROVIDER_API_KEY or ",
        String.concat(providerApiKeyEnvName(provider), ".")
      )
    )
    const providerApiUrl = yield* optionalString(providerApiUrlKey(provider))
    const genericApiUrl = yield* optionalString("dspProviderApiUrl")
    const anthropicVersion = yield* optionalString("anthropicVersion")
    const genericAnthropicVersion = yield* optionalString("dspProviderAnthropicVersion")
    const openrouterReferrer = yield* optionalString("openrouterReferrer")
    const genericOpenrouterReferrer = yield* optionalString("dspProviderOpenrouterReferrer")
    const openrouterTitle = yield* optionalString("openrouterTitle")
    const genericOpenrouterTitle = yield* optionalString("dspProviderOpenrouterTitle")

    return new ResolvedLiveTextProviderConfig({
      provider,
      model,
      apiKey,
      apiUrl: Option.fromNullable(options.apiUrl).pipe(
        Option.map(String.trim),
        Option.filter(String.isNonEmpty),
        Option.orElse(() => providerApiUrl),
        Option.orElse(() => genericApiUrl)
      ),
      anthropicVersion: Option.fromNullable(options.anthropicVersion).pipe(
        Option.map(String.trim),
        Option.filter(String.isNonEmpty),
        Option.orElse(() => anthropicVersion),
        Option.orElse(() => genericAnthropicVersion)
      ),
      openrouterReferrer: Option.fromNullable(options.openrouterReferrer).pipe(
        Option.map(String.trim),
        Option.filter(String.isNonEmpty),
        Option.orElse(() => openrouterReferrer),
        Option.orElse(() => genericOpenrouterReferrer)
      ),
      openrouterTitle: Option.fromNullable(options.openrouterTitle).pipe(
        Option.map(String.trim),
        Option.filter(String.isNonEmpty),
        Option.orElse(() => openrouterTitle),
        Option.orElse(() => genericOpenrouterTitle)
      )
    })
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
      const route = ExecutionRouteSchema.make({
        family: "OpenAiResponses",
        serveMode: "hosted-api",
        authMethod: "api-key",
        baseUrl: Option.getOrElse(config.apiUrl, () => "https://api.openai.com/v1")
      })

      return DesiredRuntimeDescriptorSchema.make({
        artifact: { modelRef: config.model },
        route
      })
    }),
    Match.when("anthropic", () => {
      const route = ExecutionRouteSchema.make({
        family: "AnthropicMessages",
        serveMode: "hosted-api",
        authMethod: "api-key",
        baseUrl: Option.getOrElse(config.apiUrl, () => "https://api.anthropic.com")
      })

      return DesiredRuntimeDescriptorSchema.make({
        artifact: { modelRef: config.model },
        route
      })
    }),
    Match.when("openrouter", () => {
      const route = ExecutionRouteSchema.make({
        family: "OpenAiCompatible",
        serveMode: "routed-marketplace",
        authMethod: "api-key",
        baseUrl: Option.getOrElse(config.apiUrl, () => "https://openrouter.ai/api/v1"),
        gatewayId: "openrouter"
      })

      return DesiredRuntimeDescriptorSchema.make({
        artifact: { modelRef: config.model },
        route
      })
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
  options: LiveTextProviderRuntimeOptions = new LiveTextProviderRuntimeOptions({})
): Effect.Effect<ResolvedLiveTextProviderConfig, InvalidRuntimeConfig> =>
  providerConfig(options).pipe(
    Effect.withConfigProvider(
      Option.getOrElse(Option.fromNullable(options.configProvider), () => defaultConfigProvider)
    ),
    Effect.mapError((error) => new InvalidRuntimeConfig({ reason: error.message }))
  )
