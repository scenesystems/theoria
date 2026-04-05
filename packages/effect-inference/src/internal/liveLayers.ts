/**
 * Internal live-layer assembly for stable runtime route families.
 *
 * @since 0.1.0
 */
import * as AnthropicClient from "@effect/ai-anthropic/AnthropicClient"
import * as AnthropicLanguageModel from "@effect/ai-anthropic/AnthropicLanguageModel"
import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import * as OpenAiLanguageModel from "@effect/ai-openai/OpenAiLanguageModel"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { Layer, Match, Option } from "effect"

import type { DesiredRuntimeDescriptor } from "../contracts/DesiredRuntimeDescriptor.js"
import type { ExecutionRoute } from "../contracts/ExecutionRoute.js"
import type { RuntimeCapabilities } from "../contracts/RuntimeCapabilities.js"
import { HuggingFaceEndpointEmbeddingsLive, HuggingFaceEndpointLive } from "../HuggingFace/endpoint.js"
import { HuggingFaceRoutedEmbeddingsLive, HuggingFaceRoutedLive } from "../HuggingFace/routed.js"
import { OpenAiCompatibleEmbeddingsLive, OpenAiCompatibleLive } from "../OpenAiCompatible/layer.js"
import { ResolvedModelLayers } from "../Runtime/services.js"

const openAiLanguageLayer = (model: string, baseUrl: string) =>
  Layer.provide(
    Layer.provide(
      OpenAiLanguageModel.layer({ model }),
      OpenAiClient.layer({ apiUrl: baseUrl })
    ),
    FetchHttpClient.layer
  )

const anthropicLanguageLayer = (model: string, baseUrl: string) =>
  Layer.provide(
    Layer.provide(
      AnthropicLanguageModel.layer({ model }),
      AnthropicClient.layer({ apiUrl: baseUrl })
    ),
    FetchHttpClient.layer
  )

const languageModelLayerForRoute = (route: ExecutionRoute, model: string) =>
  Match.value(route.family).pipe(
    Match.when("OpenAiCompatible", () => OpenAiCompatibleLive({ model, baseUrl: route.baseUrl })),
    Match.when("OpenAiResponses", () => openAiLanguageLayer(model, route.baseUrl)),
    Match.when("AnthropicMessages", () => anthropicLanguageLayer(model, route.baseUrl)),
    Match.when("HuggingFace", () =>
      Match.value(route.serveMode).pipe(
        Match.when("routed-marketplace", () =>
          HuggingFaceRoutedLive({
            model,
            baseUrl: route.baseUrl,
            selectionPolicy: route.selectionPolicy
          })),
        Match.orElse(() => HuggingFaceEndpointLive({ model, baseUrl: route.baseUrl }))
      )),
    Match.exhaustive
  )

const embeddingModelLayerForRoute = (route: ExecutionRoute, model: string) =>
  Match.value(route.family).pipe(
    Match.when(
      "OpenAiCompatible",
      () => Option.some(OpenAiCompatibleEmbeddingsLive({ model, baseUrl: route.baseUrl }))
    ),
    Match.when("OpenAiResponses", () => Option.none()),
    Match.when("AnthropicMessages", () => Option.none()),
    Match.when("HuggingFace", () =>
      Match.value(route.serveMode).pipe(
        Match.when("routed-marketplace", () =>
          Option.some(
            HuggingFaceRoutedEmbeddingsLive({
              model,
              route
            })
          )),
        Match.orElse(() =>
          Option.some(
            HuggingFaceEndpointEmbeddingsLive({
              model,
              route
            })
          )
        )
      )),
    Match.exhaustive
  )

/**
 * Builds real model layers for the resolved runtime without emitting any
 * execution-time evidence.
 *
 * @since 0.1.0
 */
export const makeResolvedModelLayers = (options: {
  readonly descriptor: DesiredRuntimeDescriptor
  readonly route: ExecutionRoute
  readonly capabilities: RuntimeCapabilities
}): ResolvedModelLayers =>
  new ResolvedModelLayers({
    languageModel: options.capabilities.textGeneration
      ? Option.some(languageModelLayerForRoute(options.route, options.descriptor.artifact.modelRef))
      : Option.none(),
    embeddingModel: options.capabilities.embeddings
      ? embeddingModelLayerForRoute(options.route, options.descriptor.artifact.modelRef)
      : Option.none()
  })
