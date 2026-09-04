/**
 * Configuration precedence for Hugging Face marketplace and endpoint runtimes.
 *
 * @since 0.1.0
 */
import { Config, ConfigError, ConfigProvider, Data, Effect, Match, Option } from "effect"
import type * as Redacted from "effect/Redacted"

import type { DesiredRuntimeDescriptor } from "../contracts/DesiredRuntimeDescriptor.js"
import type { ExecutionRoute } from "../contracts/ExecutionRoute.js"
import { explicitProviderSelection, type RouteSelectionPolicy } from "../contracts/RouteSelectionPolicy.js"
import { InvalidRuntimeConfig } from "../Errors/Config.js"
import { makeHuggingFaceEndpointRoute, makeHuggingFaceRoutedRoute } from "./metadata.js"

const defaultConfigProvider = ConfigProvider.fromEnv().pipe(ConfigProvider.constantCase)

const defaultRoutedBaseUrl = "https://router.huggingface.co/v1"
const explicitProviderPrefix = "provider:"

/**
 * Complete settings for the Hugging Face provider router.
 *
 * @since 0.1.0
 * @category models
 */
export class RoutedLiveRuntimeOptions extends Data.Class<{
  /** Selects marketplace routing. */
  readonly serveMode: "routed-marketplace"
  /** Model repository or provider model reference. */
  readonly model: string
  /** Hugging Face access token retained as `Redacted`. */
  readonly accessToken: Redacted.Redacted
  /** Router base URL; defaults to `https://router.huggingface.co/v1`. */
  readonly baseUrl?: string
  /** Gateway identity retained in route provenance. */
  readonly gatewayId?: string
  /** Broker strategy or required provider. */
  readonly selectionPolicy?: RouteSelectionPolicy
  /** Capability constraints checked before model layers are returned. */
  readonly capabilities?: DesiredRuntimeDescriptor["capabilities"]
}> {}

/**
 * Complete settings for one Hugging Face dedicated endpoint.
 *
 * @since 0.1.0
 * @category models
 */
export class EndpointLiveRuntimeOptions extends Data.Class<{
  /** Selects dedicated-endpoint routing. */
  readonly serveMode: "dedicated-endpoint"
  /** Model identifier passed to endpoint adapters. */
  readonly model: string
  /** Hugging Face access token retained as `Redacted`. */
  readonly accessToken: Redacted.Redacted
  /** Required endpoint base URL. */
  readonly baseUrl: string
  /** Provider endpoint identity retained in provenance. */
  readonly endpointId?: string
  /** Selected deployment identity retained in provenance. */
  readonly deploymentId?: string
  /** Serving-engine hint used by capability policy. */
  readonly runtimeFlavorHint?: ExecutionRoute["runtimeFlavorHint"]
  /** Capability constraints checked before model layers are returned. */
  readonly capabilities?: DesiredRuntimeDescriptor["capabilities"]
}> {}

/**
 * Discriminated settings for marketplace routing or a dedicated endpoint.
 *
 * @since 0.1.0
 * @category models
 */
export type LiveRuntimeOptions = RoutedLiveRuntimeOptions | EndpointLiveRuntimeOptions

/**
 * Explicit overrides for config-driven Hugging Face resolution. Present values
 * take precedence over the selected `ConfigProvider`.
 *
 * @since 0.1.0
 * @category models
 */
export class LiveRuntimeConfigOptions extends Data.Class<{
  /** Runtime lane; defaults to `routed-marketplace`. */
  readonly serveMode?: LiveRuntimeOptions["serveMode"]
  /** Model identifier required after configuration merging. */
  readonly model?: string
  /** Access token required after configuration merging. */
  readonly accessToken?: Redacted.Redacted
  /** Router override or required dedicated-endpoint URL. */
  readonly baseUrl?: string
  /** Dedicated endpoint identity. */
  readonly endpointId?: string
  /** Dedicated deployment identity. */
  readonly deploymentId?: string
  /** Marketplace gateway identity. */
  readonly gatewayId?: string
  /** Marketplace broker-selection policy. */
  readonly selectionPolicy?: RouteSelectionPolicy
  /** Dedicated endpoint serving-engine hint. */
  readonly runtimeFlavorHint?: ExecutionRoute["runtimeFlavorHint"]
  /** Constraints checked against package capability policy. */
  readonly capabilities?: DesiredRuntimeDescriptor["capabilities"]
  /** Configuration source used for values without explicit overrides. */
  readonly configProvider?: ConfigProvider.ConfigProvider
}> {}

/**
 * Complete marketplace or endpoint settings after configuration merging.
 *
 * @since 0.1.0
 * @category models
 */
export type ResolvedLiveRuntimeConfig = LiveRuntimeOptions

/**
 * Desired-runtime descriptor with a guaranteed route, derived from explicit
 * Hugging Face live runtime options.
 *
 * @since 0.1.0
 * @category models
 */
export class LiveRuntimeDescriptor extends Data.Class<
  DesiredRuntimeDescriptor & {
    readonly route: ExecutionRoute
  }
> {}

const optionalString = (name: string): Config.Config<Option.Option<string>> => Config.option(Config.string(name))

const optionalRedacted = (name: string): Config.Config<Option.Option<Redacted.Redacted>> =>
  Config.option(Config.redacted(name))

const optionalRuntimeFlavor = (name: string): Config.Config<Option.Option<ExecutionRoute["runtimeFlavorHint"]>> =>
  Config.option(Config.literal("unknown", "vllm", "tgi", "ollama", "lm-studio")(name))

const firstDefinedOption = <A>(primary: Option.Option<A>, fallback: Option.Option<A>): Option.Option<A> =>
  Option.orElse(primary, () => fallback)

const mergeOptional = <A>(override: Option.Option<A>, base: Option.Option<A>): Option.Option<A> =>
  Option.match(override, { onNone: () => base, onSome: (value) => Option.some(value) })

const requiredOption = <A>(
  option: Option.Option<A>,
  message: string
): Effect.Effect<A, ConfigError.ConfigError> =>
  Option.match(option, {
    onNone: () => Effect.fail(ConfigError.MissingData([], message)),
    onSome: Effect.succeed
  })

const selectionPolicyFromString = (
  value: string
): Effect.Effect<RouteSelectionPolicy, ConfigError.ConfigError> =>
  Match.value(value).pipe(
    Match.when("auto", () => Effect.succeed<RouteSelectionPolicy>("auto")),
    Match.when("fastest", () => Effect.succeed<RouteSelectionPolicy>("fastest")),
    Match.when("cheapest", () => Effect.succeed<RouteSelectionPolicy>("cheapest")),
    Match.when("preferred", () => Effect.succeed<RouteSelectionPolicy>("preferred")),
    Match.orElse((rawValue) =>
      rawValue.startsWith(explicitProviderPrefix)
        ? Effect.succeed(explicitProviderSelection(rawValue.slice(explicitProviderPrefix.length)))
        : Effect.fail(
          ConfigError.InvalidData(
            [],
            "Unsupported huggingfaceSelectionPolicy. Use auto, fastest, cheapest, preferred, or provider:<name>."
          )
        )
    )
  )

const optionalSelectionPolicyFromConfig = (
  override: Option.Option<RouteSelectionPolicy>,
  base: Option.Option<string>
): Effect.Effect<Option.Option<RouteSelectionPolicy>, ConfigError.ConfigError> =>
  Option.match(override, {
    onNone: () =>
      Option.match(base, {
        onNone: () => Effect.succeed(Option.none()),
        onSome: (value) => selectionPolicyFromString(value).pipe(Effect.map(Option.some))
      }),
    onSome: (value) => Effect.succeed(Option.some(value))
  })

const routedBaseUrlFromConfig = (
  override: Option.Option<string>,
  base: Option.Option<string>
): string =>
  Option.match(mergeOptional(override, base), {
    onNone: () => defaultRoutedBaseUrl,
    onSome: (value) => value
  })

const makeInvalidRuntimeConfig = (error: ConfigError.ConfigError): InvalidRuntimeConfig =>
  new InvalidRuntimeConfig({ reason: String(error) })

const descriptorWithCapabilities = (
  descriptor: LiveRuntimeDescriptor,
  capabilities?: DesiredRuntimeDescriptor["capabilities"]
): LiveRuntimeDescriptor =>
  Option.fromNullable(capabilities).pipe(
    Option.match({
      onNone: () => descriptor,
      onSome: (resolvedCapabilities) => ({
        ...descriptor,
        capabilities: resolvedCapabilities
      })
    })
  )

const routedRouteForLiveRuntime = (options: RoutedLiveRuntimeOptions): ExecutionRoute =>
  makeHuggingFaceRoutedRoute({
    baseUrl: options.baseUrl ?? defaultRoutedBaseUrl,
    authMethod: "hf-token",
    ...Option.match(Option.fromNullable(options.gatewayId), {
      onNone: () => ({}),
      onSome: (gatewayId) => ({ gatewayId })
    }),
    ...Option.match(Option.fromNullable(options.selectionPolicy), {
      onNone: () => ({}),
      onSome: (selectionPolicy) => ({ selectionPolicy })
    })
  })

const endpointRouteForLiveRuntime = (options: EndpointLiveRuntimeOptions): ExecutionRoute =>
  makeHuggingFaceEndpointRoute({
    baseUrl: options.baseUrl,
    authMethod: "hf-token",
    ...Option.match(Option.fromNullable(options.endpointId), {
      onNone: () => ({}),
      onSome: (endpointId) => ({ endpointId })
    }),
    ...Option.match(Option.fromNullable(options.deploymentId), {
      onNone: () => ({}),
      onSome: (deploymentId) => ({ deploymentId })
    }),
    ...Option.match(Option.fromNullable(options.runtimeFlavorHint), {
      onNone: () => ({}),
      onSome: (runtimeFlavorHint) => ({ runtimeFlavorHint })
    })
  })

/**
 * Converts complete Hugging Face settings to caller intent with a guaranteed
 * route. Marketplace URLs default to the Hugging Face router; endpoint URLs
 * remain required.
 * @since 0.1.0
 * @category constructors
 */
export const descriptorForLiveRuntime = (options: LiveRuntimeOptions): LiveRuntimeDescriptor =>
  options.serveMode === "routed-marketplace"
    ? descriptorWithCapabilities(
      {
        artifact: { modelRef: options.model },
        route: routedRouteForLiveRuntime(options)
      },
      options.capabilities
    )
    : descriptorWithCapabilities(
      {
        artifact: { modelRef: options.model },
        route: endpointRouteForLiveRuntime(options)
      },
      options.capabilities
    )

const commonAccessToken = (options: LiveRuntimeConfigOptions) =>
  Effect.gen(function*() {
    const configuredAccessToken = yield* optionalRedacted("huggingfaceAccessToken")

    return yield* requiredOption(
      mergeOptional(Option.fromNullable(options.accessToken), configuredAccessToken),
      "Missing Hugging Face access token. Set HUGGINGFACE_ACCESS_TOKEN or pass accessToken explicitly."
    )
  })

const commonServeMode = (options: LiveRuntimeConfigOptions) =>
  Effect.gen(function*() {
    const configuredServeMode = yield* Config.withDefault(
      Config.literal("routed-marketplace", "dedicated-endpoint")("huggingfaceServeMode"),
      "routed-marketplace"
    )

    return Option.getOrElse(Option.fromNullable(options.serveMode), () => configuredServeMode)
  })

const routedConfig = (
  options: LiveRuntimeConfigOptions & { readonly serveMode: "routed-marketplace" }
): Effect.Effect<ResolvedLiveRuntimeConfig, ConfigError.ConfigError> =>
  Effect.gen(function*() {
    const configuredModel = firstDefinedOption(
      yield* optionalString("huggingfaceRoutedModel"),
      yield* optionalString("huggingfaceModel")
    )
    const configuredBaseUrl = firstDefinedOption(
      yield* optionalString("huggingfaceRoutedBaseUrl"),
      yield* optionalString("huggingfaceBaseUrl")
    )
    const configuredGatewayId = firstDefinedOption(
      yield* optionalString("huggingfaceRoutedGatewayId"),
      yield* optionalString("huggingfaceGatewayId")
    )
    const configuredSelectionPolicy = firstDefinedOption(
      yield* optionalString("huggingfaceRoutedSelectionPolicy"),
      yield* optionalString("huggingfaceSelectionPolicy")
    )
    const model = yield* requiredOption(
      mergeOptional(Option.fromNullable(options.model), configuredModel),
      "Missing Hugging Face routed model. Set HUGGINGFACE_MODEL, HUGGINGFACE_ROUTED_MODEL, or pass model explicitly."
    )
    const accessToken = yield* commonAccessToken(options)
    const selectionPolicy = yield* optionalSelectionPolicyFromConfig(
      Option.fromNullable(options.selectionPolicy),
      configuredSelectionPolicy
    )

    return {
      serveMode: options.serveMode,
      model,
      accessToken,
      baseUrl: routedBaseUrlFromConfig(Option.fromNullable(options.baseUrl), configuredBaseUrl),
      ...Option.match(mergeOptional(Option.fromNullable(options.gatewayId), configuredGatewayId), {
        onNone: () => ({}),
        onSome: (gatewayId) => ({ gatewayId })
      }),
      ...Option.match(selectionPolicy, {
        onNone: () => ({}),
        onSome: (resolvedSelectionPolicy) => ({ selectionPolicy: resolvedSelectionPolicy })
      }),
      ...Option.match(Option.fromNullable(options.capabilities), {
        onNone: () => ({}),
        onSome: (capabilities) => ({ capabilities })
      })
    }
  })

const endpointConfig = (
  options: LiveRuntimeConfigOptions & { readonly serveMode: "dedicated-endpoint" }
): Effect.Effect<ResolvedLiveRuntimeConfig, ConfigError.ConfigError> =>
  Effect.gen(function*() {
    const configuredModel = firstDefinedOption(
      yield* optionalString("huggingfaceEndpointModel"),
      yield* optionalString("huggingfaceModel")
    )
    const configuredBaseUrl = firstDefinedOption(
      yield* optionalString("huggingfaceEndpointBaseUrl"),
      yield* optionalString("huggingfaceBaseUrl")
    )
    const configuredEndpointId = yield* optionalString("huggingfaceEndpointId")
    const configuredDeploymentId = yield* optionalString("huggingfaceDeploymentId")
    const configuredRuntimeFlavorHint = yield* optionalRuntimeFlavor("huggingfaceRuntimeFlavor")
    const model = yield* requiredOption(
      mergeOptional(Option.fromNullable(options.model), configuredModel),
      "Missing Hugging Face endpoint model. Set HUGGINGFACE_MODEL, HUGGINGFACE_ENDPOINT_MODEL, or pass model explicitly."
    )
    const accessToken = yield* commonAccessToken(options)
    const baseUrl = yield* requiredOption(
      mergeOptional(Option.fromNullable(options.baseUrl), configuredBaseUrl),
      "Missing Hugging Face endpoint base URL. Set HUGGINGFACE_BASE_URL, HUGGINGFACE_ENDPOINT_BASE_URL, or pass baseUrl explicitly."
    )

    return {
      serveMode: options.serveMode,
      model,
      accessToken,
      baseUrl,
      ...Option.match(mergeOptional(Option.fromNullable(options.endpointId), configuredEndpointId), {
        onNone: () => ({}),
        onSome: (endpointId) => ({ endpointId })
      }),
      ...Option.match(mergeOptional(Option.fromNullable(options.deploymentId), configuredDeploymentId), {
        onNone: () => ({}),
        onSome: (deploymentId) => ({ deploymentId })
      }),
      ...Option.match(mergeOptional(Option.fromNullable(options.runtimeFlavorHint), configuredRuntimeFlavorHint), {
        onNone: () => ({}),
        onSome: (runtimeFlavorHint) => ({ runtimeFlavorHint })
      }),
      ...Option.match(Option.fromNullable(options.capabilities), {
        onNone: () => ({}),
        onSome: (capabilities) => ({ capabilities })
      })
    }
  })

/**
 * Resolves complete marketplace or endpoint settings without making a provider
 * request. Explicit options take precedence over configuration values.
 *
 * @remarks
 * Supported env keys include `HUGGINGFACE_ACCESS_TOKEN`,
 * `HUGGINGFACE_SERVE_MODE`, `HUGGINGFACE_MODEL`, route-specific model/base-url
 * keys, `HUGGINGFACE_SELECTION_POLICY`, `HUGGINGFACE_ENDPOINT_ID`,
 * `HUGGINGFACE_DEPLOYMENT_ID`, and `HUGGINGFACE_RUNTIME_FLAVOR`.
 * Missing tokens, models, or dedicated endpoint URLs fail as
 * `InvalidRuntimeConfig`. `provider:<name>` selects one marketplace provider.
 *
 * @since 0.1.0
 * @category constructors
 */
export const resolveLiveRuntimeConfig = (
  options: LiveRuntimeConfigOptions = {}
): Effect.Effect<ResolvedLiveRuntimeConfig, InvalidRuntimeConfig> =>
  commonServeMode(options).pipe(
    Effect.flatMap((serveMode) =>
      serveMode === "routed-marketplace"
        ? routedConfig({ ...options, serveMode })
        : endpointConfig({ ...options, serveMode })
    ),
    Effect.withConfigProvider(options.configProvider ?? defaultConfigProvider),
    Effect.catchAll((error) => Effect.fail(makeInvalidRuntimeConfig(error)))
  )
