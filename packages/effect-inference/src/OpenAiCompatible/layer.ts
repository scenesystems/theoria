/**
 * OpenAI-compatible family live adapters and resolution helpers.
 *
 * @since 0.1.0
 */
import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import * as OpenAiEmbeddingModel from "@effect/ai-openai/OpenAiEmbeddingModel"
import * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel"
import type * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { Layer, Option } from "effect"

import type { DesiredRuntimeDescriptor } from "../contracts/DesiredRuntimeDescriptor.js"
import type { RuntimeCapabilities } from "../contracts/RuntimeCapabilities.js"
import { defaultRuntimeCapabilities } from "../internal/defaultCapabilities.js"
import { makeLiveResolvedRouteDescriptor } from "../internal/resolvedRoute.js"
import { ResolvedModelLayers, RuntimeResolution } from "../Runtime/services.js"
import { planCompatibleTransport } from "./config.js"
import { makeOpenAiCompatibleRoute } from "./metadata.js"

const compatibleLanguageLayer = (options: {
  readonly model: string
  readonly baseUrl: string
}): Layer.Layer<LanguageModel.LanguageModel, never, never> =>
  Layer.provide(
    Layer.provide(
      OpenRouterLanguageModel.layer({ model: options.model }),
      OpenRouterClient.layer({ apiUrl: options.baseUrl })
    ),
    FetchHttpClient.layer
  )

const compatibleEmbeddingLayer = (options: {
  readonly model: string
  readonly baseUrl: string
}): Layer.Layer<EmbeddingModel.EmbeddingModel, never, never> =>
  Layer.provide(
    Layer.provide(
      OpenAiEmbeddingModel.layerBatched({ model: options.model }),
      OpenAiClient.layer({ apiUrl: options.baseUrl })
    ),
    FetchHttpClient.layer
  )

const resolvedModelLayers = (options: {
  readonly capabilities: RuntimeCapabilities
  readonly model: string
  readonly baseUrl: string
}): ResolvedModelLayers =>
  new ResolvedModelLayers({
    languageModel: options.capabilities.textGeneration
      ? Option.some(compatibleLanguageLayer({ model: options.model, baseUrl: options.baseUrl }))
      : Option.none(),
    embeddingModel: options.capabilities.embeddings
      ? Option.some(compatibleEmbeddingLayer({ model: options.model, baseUrl: options.baseUrl }))
      : Option.none()
  })

/**
 * Canonical chat-completions adapter lane for brokered, dedicated, and
 * self-hosted OpenAI-compatible runtimes.
 *
 * @since 0.1.0
 * @category layers
 */
export const OpenAiCompatibleLive = (options: {
  readonly model: string
  readonly baseUrl: string
}): Layer.Layer<LanguageModel.LanguageModel, never, never> => compatibleLanguageLayer(options)

/**
 * Canonical embeddings adapter lane for OpenAI-compatible runtimes whose
 * embedding surface follows the OpenAI schema.
 *
 * @since 0.1.0
 * @category layers
 */
export const OpenAiCompatibleEmbeddingsLive = (options: {
  readonly model: string
  readonly baseUrl: string
}): Layer.Layer<EmbeddingModel.EmbeddingModel, never, never> => compatibleEmbeddingLayer(options)

/**
 * Builds a live OpenAI-compatible runtime-resolution record around the shared
 * transport seam.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeOpenAiCompatibleResolution = (
  descriptor: DesiredRuntimeDescriptor,
  baseUrl: string
): RuntimeResolution => {
  const route = planCompatibleTransport(
    descriptor.route ??
      makeOpenAiCompatibleRoute({
        baseUrl,
        serveMode: "local-runtime",
        authMethod: "none"
      })
  ).route
  const capabilities = defaultRuntimeCapabilities({ route })

  return new RuntimeResolution({
    desired: descriptor,
    resolvedRoute: makeLiveResolvedRouteDescriptor(descriptor, route),
    capabilities,
    layers: resolvedModelLayers({
      capabilities,
      model: descriptor.artifact.modelRef,
      baseUrl: route.baseUrl
    })
  })
}
