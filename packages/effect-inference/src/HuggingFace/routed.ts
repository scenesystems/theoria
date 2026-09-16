/**
 * Live model layers and resolution for the Hugging Face provider router.
 *
 * @since 0.1.0
 */
import * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel"
import type * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import type * as HttpClient from "@effect/platform/HttpClient"
import { Boolean, Layer, Option, Schema } from "effect"
import type * as Redacted from "effect/Redacted"

import type { DesiredRuntimeDescriptor } from "../contracts/DesiredRuntimeDescriptor.js"
import { RouteSelectionPolicySchema } from "../contracts/RouteSelectionPolicy.js"
import { defaultRuntimeCapabilities } from "../internal/defaultCapabilities.js"
import { makeHuggingFaceEmbeddingLayer, makeHuggingFaceRoutedModelRef } from "../internal/huggingFace.js"
import { makeLiveResolvedRouteDescriptor } from "../internal/resolvedRoute.js"
import { planCompatibleTransport } from "../OpenAiCompatible/config.js"
import { ResolvedModelLayers, RuntimeResolution } from "../Runtime/services.js"
import { HuggingFaceEmbeddingOptions } from "./endpoint.js"
import { makeHuggingFaceRoutedRoute } from "./metadata.js"

/**
 * Configuration for a routed Hugging Face language-model layer.
 *
 * @since 0.1.0
 * @category models
 */
export class RoutedModelOptions extends Schema.Class<RoutedModelOptions>("RoutedModelOptions")({
  model: Schema.String,
  baseUrl: Schema.String,
  accessToken: Schema.optional(Schema.RedactedFromSelf(Schema.String)),
  selectionPolicy: Schema.optional(RouteSelectionPolicySchema)
}) {}

/**
 * Routed-provider text-generation lane for Hugging Face chat-completions
 * traffic. Selection policy is encoded in the provider-side model ref so the
 * execution route remains unchanged while the transport uses the OpenAI chat
 * protocol.
 *
 * @since 0.1.0
 * @category layers
 */
export const HuggingFaceRoutedLive = (
  options: RoutedModelOptions
): Layer.Layer<LanguageModel.LanguageModel> =>
  Layer.provide(
    Layer.provide(
      OpenRouterLanguageModel.layer({
        model: makeHuggingFaceRoutedModelRef(
          options.model,
          Option.fromNullable(options.selectionPolicy)
        )
      }),
      OpenRouterClient.layer({
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
 * Constructs native feature extraction with caller-owned HTTP transport for
 * both Hub discovery and inference. Auto selects the first Hub mapping;
 * explicit provider selection must match. Chat-only policies fail at operation
 * time. Discovery is cached per layer for five minutes, with concurrent misses
 * coalesced. HTTP 503 retries twice after 100 ms and 200 ms, without failover.
 *
 * @since 0.4.0
 * @category layers
 */
export const HuggingFaceRoutedEmbeddings = (
  options: HuggingFaceEmbeddingOptions
): Layer.Layer<EmbeddingModel.EmbeddingModel, never, HttpClient.HttpClient> => makeHuggingFaceEmbeddingLayer(options)

/**
 * Provides `HuggingFaceRoutedEmbeddings` with the platform fetch client.
 *
 * @since 0.1.0
 * @category layers
 */
export const HuggingFaceRoutedEmbeddingsLive = (
  options: HuggingFaceEmbeddingOptions
): Layer.Layer<EmbeddingModel.EmbeddingModel> =>
  Layer.provide(HuggingFaceRoutedEmbeddings(options), FetchHttpClient.layer)

/**
 * Resolves a marketplace route without network I/O. The supplied `baseUrl`
 * replaces any route URL; gateway and selection policy are retained from
 * `descriptor`. Authentication is recorded as `hf-token`.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeHuggingFaceRoutedResolution = (
  descriptor: DesiredRuntimeDescriptor,
  baseUrl: string,
  accessToken?: Redacted.Redacted
): RuntimeResolution => {
  const requestedRoute = Option.fromNullable(descriptor.route)
  const route = planCompatibleTransport(
    makeHuggingFaceRoutedRoute({
      baseUrl,
      authMethod: "hf-token",
      ...Option.match(Option.flatMap(requestedRoute, (route) => Option.fromNullable(route.gatewayId)), {
        onNone: () => ({}),
        onSome: (gatewayId) => ({ gatewayId })
      }),
      ...Option.match(Option.flatMap(requestedRoute, (route) => Option.fromNullable(route.selectionPolicy)), {
        onNone: () => ({}),
        onSome: (selectionPolicy) => ({ selectionPolicy })
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
            HuggingFaceRoutedLive(
              new RoutedModelOptions({
                model: descriptor.artifact.modelRef,
                baseUrl: route.baseUrl,
                ...Option.match(Option.fromNullable(accessToken), {
                  onNone: () => ({}),
                  onSome: (resolvedAccessToken) => ({ accessToken: resolvedAccessToken })
                }),
                ...Option.match(Option.fromNullable(route.selectionPolicy), {
                  onNone: () => ({}),
                  onSome: (selectionPolicy) => ({ selectionPolicy })
                })
              })
            )
          ),
        onFalse: () => Option.none()
      }),
      embeddingModel: Boolean.match(capabilities.embeddings, {
        onTrue: () =>
          Option.some(
            HuggingFaceRoutedEmbeddingsLive(
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
