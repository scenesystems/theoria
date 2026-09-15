/**
 * Live model layers and resolution for Hugging Face dedicated endpoints.
 *
 * @since 0.1.0
 */
import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import * as OpenAiLanguageModel from "@effect/ai-openai/OpenAiLanguageModel"
import type * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import type * as HttpClient from "@effect/platform/HttpClient"
import { Boolean, Layer, Option, Schema } from "effect"
import type * as Redacted from "effect/Redacted"

import type { DesiredRuntimeDescriptor } from "../contracts/DesiredRuntimeDescriptor.js"
import { ExecutionRouteSchema } from "../contracts/ExecutionRoute.js"
import { defaultRuntimeCapabilities } from "../internal/defaultCapabilities.js"
import { makeHuggingFaceEmbeddingLayer } from "../internal/huggingFace.js"
import { makeLiveResolvedRouteDescriptor } from "../internal/resolvedRoute.js"
import { planCompatibleTransport } from "../OpenAiCompatible/config.js"
import { ResolvedModelLayers, RuntimeResolution } from "../Runtime/services.js"
import { makeHuggingFaceEndpointRoute } from "./metadata.js"

/**
 * Configuration for a dedicated Hugging Face language-model layer.
 *
 * @since 0.1.0
 * @category models
 */
export class EndpointModelOptions extends Schema.Class<EndpointModelOptions>("EndpointModelOptions")({
  model: Schema.String,
  baseUrl: Schema.String,
  accessToken: Schema.optional(Schema.RedactedFromSelf(Schema.String))
}) {}

/**
 * Configuration shared by routed and dedicated Hugging Face embedding layers.
 *
 * @since 0.1.0
 * @category models
 */
export class HuggingFaceEmbeddingOptions extends Schema.Class<HuggingFaceEmbeddingOptions>(
  "HuggingFaceEmbeddingOptions"
)({
  model: Schema.String,
  route: ExecutionRouteSchema,
  accessToken: Schema.optional(Schema.RedactedFromSelf(Schema.String))
}) {}

/**
 * Constructs a fully provided OpenAI-compatible `LanguageModel` for a Hugging
 * Face dedicated endpoint. `accessToken` remains redacted in configuration;
 * request failures occur when model operations run.
 *
 * @since 0.1.0
 * @category layers
 */
export const HuggingFaceEndpointLive = (
  options: EndpointModelOptions
): Layer.Layer<LanguageModel.LanguageModel> =>
  Layer.provide(
    Layer.provide(
      OpenAiLanguageModel.layer({ model: options.model }),
      OpenAiClient.layer({
        apiUrl: options.baseUrl,
        ...Option.match(Option.fromNullable(options.accessToken), {
          onNone: () => ({}),
          onSome: (apiKey) => ({ apiKey })
        })
      })
    ),
    FetchHttpClient.layer
  )

/**
 * Constructs a native `EmbeddingModel` using the caller's `HttpClient`. Sends
 * feature extraction to the exact endpoint URL without provider discovery.
 * Each operation validates vector cardinality and width before completion.
 *
 * @since 0.4.0
 * @category layers
 */
export const HuggingFaceEndpointEmbeddings = (
  options: HuggingFaceEmbeddingOptions
): Layer.Layer<EmbeddingModel.EmbeddingModel, never, HttpClient.HttpClient> => makeHuggingFaceEmbeddingLayer(options)

/**
 * Provides `HuggingFaceEndpointEmbeddings` with the platform fetch client.
 *
 * @since 0.1.0
 * @category layers
 */
export const HuggingFaceEndpointEmbeddingsLive = (
  options: HuggingFaceEmbeddingOptions
): Layer.Layer<EmbeddingModel.EmbeddingModel> =>
  Layer.provide(HuggingFaceEndpointEmbeddings(options), FetchHttpClient.layer)

/**
 * Resolves a dedicated endpoint without network I/O. The supplied `baseUrl`
 * replaces any route URL, while authentication method and optional endpoint,
 * deployment, and runtime-flavor metadata are retained from `descriptor`.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeHuggingFaceEndpointResolution = (
  descriptor: DesiredRuntimeDescriptor,
  baseUrl: string,
  accessToken?: Redacted.Redacted
): RuntimeResolution => {
  const requestedRoute = Option.fromNullable(descriptor.route)
  const route = planCompatibleTransport(
    makeHuggingFaceEndpointRoute({
      baseUrl,
      authMethod: Option.getOrElse(
        Option.map(requestedRoute, (route) => route.authMethod),
        () => "hf-token"
      ),
      ...Option.match(Option.flatMap(requestedRoute, (route) => Option.fromNullable(route.endpointId)), {
        onNone: () => ({}),
        onSome: (endpointId) => ({ endpointId })
      }),
      ...Option.match(Option.flatMap(requestedRoute, (route) => Option.fromNullable(route.deploymentId)), {
        onNone: () => ({}),
        onSome: (deploymentId) => ({ deploymentId })
      }),
      ...Option.match(Option.flatMap(requestedRoute, (route) => Option.fromNullable(route.runtimeFlavorHint)), {
        onNone: () => ({}),
        onSome: (runtimeFlavorHint) => ({ runtimeFlavorHint })
      })
    })
  ).route
  const capabilities = defaultRuntimeCapabilities({ route })

  return new RuntimeResolution({
    desired: descriptor,
    resolvedRoute: makeLiveResolvedRouteDescriptor(descriptor, route),
    capabilities,
    layers: new ResolvedModelLayers({
      languageModel: Boolean.match(capabilities.textGeneration, {
        onTrue: () =>
          Option.some(
            HuggingFaceEndpointLive(
              new EndpointModelOptions({
                model: descriptor.artifact.modelRef,
                baseUrl: route.baseUrl,
                ...Option.match(Option.fromNullable(accessToken), {
                  onNone: () => ({}),
                  onSome: (resolvedAccessToken) => ({ accessToken: resolvedAccessToken })
                })
              })
            )
          ),
        onFalse: () => Option.none()
      }),
      embeddingModel: Boolean.match(capabilities.embeddings, {
        onTrue: () =>
          Option.some(
            HuggingFaceEndpointEmbeddingsLive(
              new HuggingFaceEmbeddingOptions({
                model: descriptor.artifact.modelRef,
                route,
                ...Option.match(Option.fromNullable(accessToken), {
                  onNone: () => ({}),
                  onSome: (resolvedAccessToken) => ({ accessToken: resolvedAccessToken })
                })
              })
            )
          ),
        onFalse: () => Option.none()
      })
    })
  })
}
