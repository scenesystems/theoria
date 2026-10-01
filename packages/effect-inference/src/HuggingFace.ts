/**
 * Config-driven Hugging Face runtime resolution.
 *
 * @since 0.5.0
 * @module
 */
import type * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import * as ConfigEffect from "effect/Config"
import * as ConfigError from "effect/ConfigError"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Inspectable from "effect/Inspectable"
import type * as Layer from "effect/Layer"
import * as Match from "effect/Match"
import * as Option from "effect/Option"
import type * as Redacted from "effect/Redacted"
import * as String from "effect/String"

import * as Endpoint from "./HuggingFaceEndpoint.js"
import * as Routed from "./HuggingFaceRouted.js"
import { CapabilityMismatch, InvalidRuntimeConfig } from "./InferenceError.js"
import { ensureCapabilityRequirements } from "./internal/capabilityValidation.js"
import * as Route from "./Route.js"
import type * as Runtime from "./Runtime.js"
import type * as RuntimeRequest from "./RuntimeRequest.js"

const defaultConfigProvider = ConfigProvider.fromEnv().pipe(ConfigProvider.constantCase)
const defaultRoutedBaseUrl = "https://router.huggingface.co/v1"
const explicitProviderPrefix = "provider:"

/** Complete settings for Hugging Face provider routing. @since 0.5.0 @category models */
export class RoutedOptions extends Data.Class<{
  readonly serveMode: "routed-marketplace"
  readonly model: string
  readonly accessToken: Redacted.Redacted
  readonly baseUrl?: string
  readonly gatewayId?: string
  readonly selectionPolicy?: Route.SelectionPolicy
  readonly capabilities?: RuntimeRequest.RuntimeRequest["capabilities"]
}> {}

/** Complete settings for one dedicated Hugging Face endpoint. @since 0.5.0 @category models */
export class EndpointOptions extends Data.Class<{
  readonly serveMode: "dedicated-endpoint"
  readonly model: string
  readonly accessToken: Redacted.Redacted
  readonly baseUrl: string
  readonly endpointId?: string
  readonly deploymentId?: string
  readonly runtimeFlavorHint?: Route.Flavor
  readonly capabilities?: RuntimeRequest.RuntimeRequest["capabilities"]
}> {}

/** Complete routed or dedicated Hugging Face runtime settings. @since 0.5.0 @category models */
export type Options = RoutedOptions | EndpointOptions

/** Explicit and ConfigProvider-backed Hugging Face configuration inputs. @since 0.5.0 @category models */
export class Config extends Data.Class<{
  readonly serveMode?: Options["serveMode"]
  readonly model?: string
  readonly accessToken?: Redacted.Redacted
  readonly baseUrl?: string
  readonly endpointId?: string
  readonly deploymentId?: string
  readonly gatewayId?: string
  readonly selectionPolicy?: Route.SelectionPolicy
  readonly runtimeFlavorHint?: Route.Flavor
  readonly capabilities?: RuntimeRequest.RuntimeRequest["capabilities"]
  readonly configProvider?: ConfigProvider.ConfigProvider
}> {}

const optionalString = (name: string) => ConfigEffect.option(ConfigEffect.string(name))
const optionalRedacted = (name: string) => ConfigEffect.option(ConfigEffect.redacted(name))

const required = <A>(value: Option.Option<A>, message: string): Effect.Effect<A, ConfigError.ConfigError> =>
  Option.match(value, {
    onNone: () => Effect.fail(ConfigError.MissingData([], message)),
    onSome: Effect.succeed
  })

const merge = <A>(configured: Option.Option<A>, override?: A): Option.Option<A> =>
  Option.fromNullable(override).pipe(Option.orElse(() => configured))

const selectionPolicy = (value: string): Effect.Effect<Route.SelectionPolicy, ConfigError.ConfigError> =>
  Match.value(value).pipe(
    Match.when("auto", () => Effect.succeed<Route.SelectionPolicy>("auto")),
    Match.when("fastest", () => Effect.succeed<Route.SelectionPolicy>("fastest")),
    Match.when("cheapest", () => Effect.succeed<Route.SelectionPolicy>("cheapest")),
    Match.when("preferred", () => Effect.succeed<Route.SelectionPolicy>("preferred")),
    Match.orElse((raw) =>
      Option.liftPredicate(String.startsWith(explicitProviderPrefix))(raw).pipe(
        Option.match({
          onNone: () =>
            Effect.fail(ConfigError.InvalidData(
              [],
              "Unsupported huggingfaceSelectionPolicy. Use auto, fastest, cheapest, preferred, or provider:<name>."
            )),
          onSome: () => Effect.succeed(Route.explicitProvider(String.slice(String.length(explicitProviderPrefix))(raw)))
        })
      )
    )
  )

const commonToken = (config: Config) =>
  optionalRedacted("huggingfaceAccessToken").pipe(
    Effect.flatMap((configured) =>
      required(
        merge(configured, config.accessToken),
        "Missing Hugging Face access token. Set HUGGINGFACE_ACCESS_TOKEN or pass accessToken explicitly."
      )
    )
  )

const resolvedSelection = (
  config: Config,
  configured: Option.Option<string>
): Effect.Effect<Option.Option<Route.SelectionPolicy>, ConfigError.ConfigError> =>
  Option.match(Option.fromNullable(config.selectionPolicy), {
    onSome: Effect.succeedSome,
    onNone: () =>
      Option.match(configured, {
        onNone: () => Effect.succeedNone,
        onSome: (value) => Effect.asSome(selectionPolicy(value))
      })
  })

const routedConfig = (config: Config): Effect.Effect<Options, ConfigError.ConfigError> =>
  Effect.gen(function*() {
    const routedModel = yield* optionalString("huggingfaceRoutedModel")
    const genericModel = yield* optionalString("huggingfaceModel")
    const configuredModel = routedModel.pipe(Option.orElse(() => genericModel))
    const routedBaseUrl = yield* optionalString("huggingfaceRoutedBaseUrl")
    const genericBaseUrl = yield* optionalString("huggingfaceBaseUrl")
    const configuredBaseUrl = routedBaseUrl.pipe(Option.orElse(() => genericBaseUrl))
    const routedGateway = yield* optionalString("huggingfaceRoutedGatewayId")
    const genericGateway = yield* optionalString("huggingfaceGatewayId")
    const configuredGateway = routedGateway.pipe(Option.orElse(() => genericGateway))
    const routedPolicy = yield* optionalString("huggingfaceRoutedSelectionPolicy")
    const genericPolicy = yield* optionalString("huggingfaceSelectionPolicy")
    const configuredPolicy = routedPolicy.pipe(Option.orElse(() => genericPolicy))
    const model = yield* required(
      merge(configuredModel, config.model),
      "Missing Hugging Face routed model. Set HUGGINGFACE_MODEL, HUGGINGFACE_ROUTED_MODEL, or pass model explicitly."
    )
    const accessToken = yield* commonToken(config)
    const policy = yield* resolvedSelection(config, configuredPolicy)

    return new RoutedOptions({
      serveMode: "routed-marketplace",
      model,
      accessToken,
      baseUrl: Option.getOrElse(merge(configuredBaseUrl, config.baseUrl), () => defaultRoutedBaseUrl),
      ...Option.match(merge(configuredGateway, config.gatewayId), {
        onNone: () => ({}),
        onSome: (gatewayId) => ({ gatewayId })
      }),
      ...Option.match(policy, { onNone: () => ({}), onSome: (selectionPolicy) => ({ selectionPolicy }) }),
      ...Option.match(Option.fromNullable(config.capabilities), {
        onNone: () => ({}),
        onSome: (capabilities) => ({ capabilities })
      })
    })
  })

const endpointConfig = (config: Config): Effect.Effect<Options, ConfigError.ConfigError> =>
  Effect.gen(function*() {
    const endpointModel = yield* optionalString("huggingfaceEndpointModel")
    const genericModel = yield* optionalString("huggingfaceModel")
    const configuredModel = endpointModel.pipe(Option.orElse(() => genericModel))
    const endpointBaseUrl = yield* optionalString("huggingfaceEndpointBaseUrl")
    const genericBaseUrl = yield* optionalString("huggingfaceBaseUrl")
    const configuredBaseUrl = endpointBaseUrl.pipe(Option.orElse(() => genericBaseUrl))
    const model = yield* required(
      merge(configuredModel, config.model),
      "Missing Hugging Face endpoint model. Set HUGGINGFACE_MODEL, HUGGINGFACE_ENDPOINT_MODEL, or pass model explicitly."
    )
    const accessToken = yield* commonToken(config)
    const baseUrl = yield* required(
      merge(configuredBaseUrl, config.baseUrl),
      "Missing Hugging Face endpoint base URL. Set HUGGINGFACE_BASE_URL, HUGGINGFACE_ENDPOINT_BASE_URL, or pass baseUrl explicitly."
    )
    const endpointId = yield* optionalString("huggingfaceEndpointId")
    const deploymentId = yield* optionalString("huggingfaceDeploymentId")
    const runtimeFlavor = yield* ConfigEffect.option(
      ConfigEffect.literal(...Route.Flavor.literals)("huggingfaceRuntimeFlavor")
    )

    return new EndpointOptions({
      serveMode: "dedicated-endpoint",
      model,
      accessToken,
      baseUrl,
      ...Option.match(merge(endpointId, config.endpointId), {
        onNone: () => ({}),
        onSome: (endpointId) => ({ endpointId })
      }),
      ...Option.match(merge(deploymentId, config.deploymentId), {
        onNone: () => ({}),
        onSome: (deploymentId) => ({ deploymentId })
      }),
      ...Option.match(merge(runtimeFlavor, config.runtimeFlavorHint), {
        onNone: () => ({}),
        onSome: (runtimeFlavorHint) => ({ runtimeFlavorHint })
      }),
      ...Option.match(Option.fromNullable(config.capabilities), {
        onNone: () => ({}),
        onSome: (capabilities) => ({ capabilities })
      })
    })
  })

/**
 * Acquires complete Hugging Face settings with explicit values taking
 * precedence over the selected ConfigProvider.
 *
 * @since 0.5.0
 * @category configuration
 */
export const fromConfig = (config: Config = new Config({})): Effect.Effect<Options, InvalidRuntimeConfig> =>
  ConfigEffect.withDefault(
    ConfigEffect.literal("routed-marketplace", "dedicated-endpoint")("huggingfaceServeMode"),
    "routed-marketplace"
  ).pipe(
    Effect.map((configured) => Option.getOrElse(Option.fromNullable(config.serveMode), () => configured)),
    Effect.flatMap((serveMode) =>
      Match.value(serveMode).pipe(
        Match.when("routed-marketplace", () => routedConfig(config)),
        Match.when("dedicated-endpoint", () => endpointConfig(config)),
        Match.exhaustive
      )
    ),
    Effect.withConfigProvider(
      Option.getOrElse(Option.fromNullable(config.configProvider), () => defaultConfigProvider)
    ),
    Effect.mapError((error) => new InvalidRuntimeConfig({ reason: Inspectable.toStringUnknown(error) }))
  )

/** Converts complete Hugging Face settings into caller-owned runtime intent. @since 0.5.0 @category constructors */
export const request = (options: Options): RuntimeRequest.RuntimeRequest =>
  Match.value(options).pipe(
    Match.when({ serveMode: "routed-marketplace" }, (options) => ({
      model: { modelRef: options.model },
      route: Routed.route({
        baseUrl: Option.getOrElse(Option.fromNullable(options.baseUrl), () => defaultRoutedBaseUrl),
        authMethod: "hf-token",
        ...Option.match(Option.fromNullable(options.gatewayId), {
          onNone: () => ({}),
          onSome: (gatewayId) => ({ gatewayId })
        }),
        ...Option.match(Option.fromNullable(options.selectionPolicy), {
          onNone: () => ({}),
          onSome: (selectionPolicy) => ({ selectionPolicy })
        })
      }),
      ...Option.match(Option.fromNullable(options.capabilities), {
        onNone: () => ({}),
        onSome: (capabilities) => ({ capabilities })
      })
    })),
    Match.when({ serveMode: "dedicated-endpoint" }, (options) => ({
      model: { modelRef: options.model },
      route: Endpoint.route({
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
      }),
      ...Option.match(Option.fromNullable(options.capabilities), {
        onNone: () => ({}),
        onSome: (capabilities) => ({ capabilities })
      })
    })),
    Match.exhaustive
  )

/**
 * Resolves explicit Hugging Face options and validates capability requirements.
 *
 * @since 0.5.0
 * @category constructors
 */
export const resolve = (options: Options): Effect.Effect<Runtime.Resolution, CapabilityMismatch> => {
  const runtimeRequest = request(options)
  const resolution = Match.value(options).pipe(
    Match.when({ serveMode: "routed-marketplace" }, (options) =>
      Routed.resolve(
        runtimeRequest,
        Option.fromNullable(runtimeRequest.route).pipe(
          Option.map((route) => route.baseUrl),
          Option.getOrElse(() => defaultRoutedBaseUrl)
        ),
        options.accessToken
      )),
    Match.when(
      { serveMode: "dedicated-endpoint" },
      (options) => Endpoint.resolve(runtimeRequest, options.baseUrl, options.accessToken)
    ),
    Match.exhaustive
  )
  return ensureCapabilityRequirements(
    Option.fromNullable(runtimeRequest.capabilities),
    resolution.capabilities
  ).pipe(Effect.as(resolution))
}

/** Acquires configuration and resolves it without executing a model. @since 0.5.0 @category constructors */
export const resolveConfig = (
  config: Config = new Config({})
): Effect.Effect<Runtime.Resolution, InvalidRuntimeConfig | CapabilityMismatch> =>
  fromConfig(config).pipe(Effect.flatMap(resolve))

const missingCapability = (capability: string) =>
  new CapabilityMismatch({ capability, reason: String.concat("resolved runtime does not support ", capability) })

/** Retrieves the resolved language layer or fails with a capability mismatch. @since 0.5.0 @category getters */
export const languageModel = (
  resolution: Runtime.Resolution
): Effect.Effect<Layer.Layer<LanguageModel.LanguageModel>, CapabilityMismatch> =>
  Option.match(resolution.models.languageModel, {
    onNone: () => Effect.fail(missingCapability("textGeneration")),
    onSome: Effect.succeed
  })

/** Retrieves the resolved embedding layer or fails with a capability mismatch. @since 0.5.0 @category getters */
export const embeddingModel = (
  resolution: Runtime.Resolution
): Effect.Effect<Layer.Layer<EmbeddingModel.EmbeddingModel>, CapabilityMismatch> =>
  Option.match(resolution.models.embeddingModel, {
    onNone: () => Effect.fail(missingCapability("embeddings")),
    onSome: Effect.succeed
  })
