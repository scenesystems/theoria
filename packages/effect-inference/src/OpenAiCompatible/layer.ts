/**
 * Live language and embedding layers for OpenAI-compatible endpoints.
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
 * Constructs a fully provided `LanguageModel` for OpenRouter-compatible chat
 * completions at `baseUrl`. Layer construction is infallible; transport and
 * provider failures occur when model operations run.
 *
 * @since 0.1.0
 * @category layers
 */
export const OpenAiCompatibleLive = (options: {
  readonly model: string
  readonly baseUrl: string
}): Layer.Layer<LanguageModel.LanguageModel, never, never> => compatibleLanguageLayer(options)

/**
 * Constructs a fully provided `EmbeddingModel` for OpenAI-compatible batched
 * requests at `baseUrl`. Layer construction is infallible; request failures
 * remain in Effect AI's model-operation channel.
 *
 * @since 0.1.0
 * @category layers
 */
export const OpenAiCompatibleEmbeddingsLive = (options: {
  readonly model: string
  readonly baseUrl: string
}): Layer.Layer<EmbeddingModel.EmbeddingModel, never, never> => compatibleEmbeddingLayer(options)

/**
 * Resolves a descriptor without network I/O. A missing route becomes an
 * unauthenticated local `OpenAiCompatible` route at `baseUrl`; an existing
 * route is retained, including its own base URL. Model layers are included only
 * for capabilities declared by the package's conservative route matrix.
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
