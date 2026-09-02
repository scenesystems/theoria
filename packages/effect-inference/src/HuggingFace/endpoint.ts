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
import { Layer, Option } from "effect"
import type * as Redacted from "effect/Redacted"

import type { DesiredRuntimeDescriptor } from "../contracts/DesiredRuntimeDescriptor.js"
import { defaultRuntimeCapabilities } from "../internal/defaultCapabilities.js"
import { makeHuggingFaceEmbeddingLayer } from "../internal/huggingFace.js"
import { makeLiveResolvedRouteDescriptor } from "../internal/resolvedRoute.js"
import { planCompatibleTransport } from "../OpenAiCompatible/config.js"
import { ResolvedModelLayers, RuntimeResolution } from "../Runtime/services.js"
import { makeHuggingFaceEndpointRoute } from "./metadata.js"

/**
 * Constructs a fully provided OpenAI-compatible `LanguageModel` for a Hugging
 * Face dedicated endpoint. `accessToken` remains redacted in configuration;
 * request failures occur when model operations run.
 *
 * @since 0.1.0
 * @category layers
 */
export const HuggingFaceEndpointLive = (options: {
  readonly model: string
  readonly baseUrl: string
  readonly accessToken?: Redacted.Redacted
}): Layer.Layer<LanguageModel.LanguageModel, never, never> =>
  Layer.provide(
    Layer.provide(
      OpenAiLanguageModel.layer({ model: options.model }),
      OpenAiClient.layer({ apiKey: options.accessToken, apiUrl: options.baseUrl })
    ),
    FetchHttpClient.layer
  )

/**
 * Constructs a fully provided `EmbeddingModel` that sends feature-extraction
 * requests to the dedicated endpoint in `route`.
 *
 * @since 0.1.0
 * @category layers
 */
export const HuggingFaceEndpointEmbeddingsLive = (options: {
  readonly model: string
  readonly route: NonNullable<DesiredRuntimeDescriptor["route"]>
  readonly accessToken?: Redacted.Redacted
}): Layer.Layer<EmbeddingModel.EmbeddingModel, never, never> => makeHuggingFaceEmbeddingLayer(options)

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
  const route = planCompatibleTransport(
    makeHuggingFaceEndpointRoute({
      baseUrl,
      authMethod: descriptor.route?.authMethod ?? "hf-token",
      ...Option.match(Option.fromNullable(descriptor.route?.endpointId), {
        onNone: () => ({}),
        onSome: (endpointId) => ({ endpointId })
      }),
      ...Option.match(Option.fromNullable(descriptor.route?.deploymentId), {
        onNone: () => ({}),
        onSome: (deploymentId) => ({ deploymentId })
      }),
      ...Option.match(Option.fromNullable(descriptor.route?.runtimeFlavorHint), {
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
      languageModel: capabilities.textGeneration
        ? Option.some(
          HuggingFaceEndpointLive({
            model: descriptor.artifact.modelRef,
            baseUrl: route.baseUrl,
            ...Option.match(Option.fromNullable(accessToken), {
              onNone: () => ({}),
              onSome: (resolvedAccessToken) => ({ accessToken: resolvedAccessToken })
            })
          })
        )
        : Option.none(),
      embeddingModel: capabilities.embeddings
        ? Option.some(
          HuggingFaceEndpointEmbeddingsLive({
            model: descriptor.artifact.modelRef,
            route,
            ...Option.match(Option.fromNullable(accessToken), {
              onNone: () => ({}),
              onSome: (resolvedAccessToken) => ({ accessToken: resolvedAccessToken })
            })
          })
        )
        : Option.none()
    })
  })
}
