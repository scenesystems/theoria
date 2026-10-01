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
import { Boolean, Data, Layer, Match, Option } from "effect"

import type { Capabilities } from "../Capabilities.js"
import * as HuggingFaceEmbeddingModel from "../HuggingFaceEmbeddingModel.js"
import * as HuggingFaceEndpoint from "../HuggingFaceEndpoint.js"
import * as HuggingFaceRouted from "../HuggingFaceRouted.js"
import * as OpenAiCompatible from "../OpenAiCompatible.js"
import type { Route } from "../Route.js"
import { ModelLayers } from "../Runtime.js"
import type { RuntimeRequest } from "../RuntimeRequest.js"

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

const languageModelLayerForRoute = (route: Route, model: string) =>
  Match.value(route.family).pipe(
    Match.when("OpenAiCompatible", () =>
      OpenAiCompatible.languageModel(new OpenAiCompatible.Options({ model, baseUrl: route.baseUrl }))),
    Match.when("OpenAiResponses", () =>
      openAiLanguageLayer(model, route.baseUrl)),
    Match.when("AnthropicMessages", () => anthropicLanguageLayer(model, route.baseUrl)),
    Match.when("HuggingFace", () =>
      Match.value(route.serveMode).pipe(
        Match.when("routed-marketplace", () =>
          HuggingFaceRouted.languageModel(
            new HuggingFaceRouted.LanguageOptions({
              model,
              baseUrl: route.baseUrl,
              ...Option.match(Option.fromNullable(route.selectionPolicy), {
                onNone: () => ({}),
                onSome: (selectionPolicy) => ({ selectionPolicy })
              })
            })
          )),
        Match.whenOr(
          "hosted-api",
          "dedicated-endpoint",
          "self-hosted",
          "local-runtime",
          () =>
            HuggingFaceEndpoint.languageModel(
              new HuggingFaceEndpoint.LanguageOptions({ model, baseUrl: route.baseUrl })
            )
        ),
        Match.exhaustive
      )),
    Match.exhaustive
  )

const embeddingModelLayerForRoute = (route: Route, model: string) =>
  Match.value(route.family).pipe(
    Match.when(
      "OpenAiCompatible",
      () =>
        Option.some(OpenAiCompatible.embeddingModel(new OpenAiCompatible.Options({ model, baseUrl: route.baseUrl })))
    ),
    Match.when("OpenAiResponses", () => Option.none()),
    Match.when("AnthropicMessages", () => Option.none()),
    Match.when("HuggingFace", () =>
      Option.some(
        HuggingFaceEmbeddingModel.layerFetch(new HuggingFaceEmbeddingModel.Options({ model, route }))
      )),
    Match.exhaustive
  )

class Options extends Data.Class<{
  readonly request: RuntimeRequest
  readonly route: Route
  readonly capabilities: Capabilities
}> {}

/**
 * Builds real model layers for the resolved runtime without emitting any
 * execution-time evidence.
 *
 * @since 0.1.0
 */
export const make = (options: Options): ModelLayers =>
  new ModelLayers({
    languageModel: Boolean.match(options.capabilities.textGeneration, {
      onTrue: () => Option.some(languageModelLayerForRoute(options.route, options.request.model.modelRef)),
      onFalse: () => Option.none()
    }),
    embeddingModel: Boolean.match(options.capabilities.embeddings, {
      onTrue: () => embeddingModelLayerForRoute(options.route, options.request.model.modelRef),
      onFalse: () => Option.none()
    })
  })
