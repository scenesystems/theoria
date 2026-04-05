/**
 * Hugging Face routed-provider live adapters and resolution helpers.
 *
 * @since 0.1.0
 */
import * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel"
import type * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { Layer, Option } from "effect"
import type * as Redacted from "effect/Redacted"

import type { DesiredRuntimeDescriptor } from "../contracts/DesiredRuntimeDescriptor.js"
import { defaultRuntimeCapabilities } from "../internal/defaultCapabilities.js"
import { makeHuggingFaceEmbeddingLayer, makeHuggingFaceRoutedModelRef } from "../internal/huggingFace.js"
import { makeLiveResolvedRouteDescriptor } from "../internal/resolvedRoute.js"
import { planCompatibleTransport } from "../OpenAiCompatible/config.js"
import { ResolvedModelLayers, RuntimeResolution } from "../Runtime/services.js"
import { makeHuggingFaceRoutedRoute } from "./metadata.js"

/**
 * Routed-provider text-generation lane for Hugging Face chat-completions
 * traffic. Selection policy is encoded in the provider-side model ref so the
 * route authority stays stable while the transport remains OpenAI compatible.
 *
 * @since 0.1.0
 * @category layers
 */
export const HuggingFaceRoutedLive = (options: {
  readonly model: string
  readonly baseUrl: string
  readonly accessToken?: Redacted.Redacted
  readonly selectionPolicy?: NonNullable<DesiredRuntimeDescriptor["route"]>["selectionPolicy"]
}): Layer.Layer<LanguageModel.LanguageModel, never, never> =>
  Layer.provide(
    Layer.provide(
      OpenRouterLanguageModel.layer({
        model: makeHuggingFaceRoutedModelRef(options.model, Option.fromNullable(options.selectionPolicy))
      }),
      OpenRouterClient.layer({ apiKey: options.accessToken, apiUrl: options.baseUrl })
    ),
    FetchHttpClient.layer
  )

/**
 * Routed-provider embeddings lane for Hugging Face feature extraction. This
 * uses the official Hugging Face client because the OpenAI-compatible router is
 * chat-only.
 *
 * @since 0.1.0
 * @category layers
 */
export const HuggingFaceRoutedEmbeddingsLive = (options: {
  readonly model: string
  readonly route: NonNullable<DesiredRuntimeDescriptor["route"]>
  readonly accessToken?: Redacted.Redacted
}): Layer.Layer<EmbeddingModel.EmbeddingModel, never, never> => makeHuggingFaceEmbeddingLayer(options)

/**
 * Builds a live runtime resolution for Hugging Face routed-provider lanes.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeHuggingFaceRoutedResolution = (
  descriptor: DesiredRuntimeDescriptor,
  baseUrl: string,
  accessToken?: Redacted.Redacted
): RuntimeResolution => {
  const route = planCompatibleTransport(
    makeHuggingFaceRoutedRoute({
      baseUrl,
      authMethod: "hf-token",
      ...Option.match(Option.fromNullable(descriptor.route?.gatewayId), {
        onNone: () => ({}),
        onSome: (gatewayId) => ({ gatewayId })
      }),
      ...Option.match(Option.fromNullable(descriptor.route?.selectionPolicy), {
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
      languageModel: capabilities.textGeneration
        ? Option.some(
          HuggingFaceRoutedLive({
            model: descriptor.artifact.modelRef,
            baseUrl: route.baseUrl,
            ...Option.match(Option.fromNullable(accessToken), {
              onNone: () => ({}),
              onSome: (resolvedAccessToken) => ({ accessToken: resolvedAccessToken })
            }),
            selectionPolicy: route.selectionPolicy
          })
        )
        : Option.none(),
      embeddingModel: capabilities.embeddings
        ? Option.some(
          HuggingFaceRoutedEmbeddingsLive({
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
