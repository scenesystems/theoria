/**
 * OpenAI-compatible routes, transport planning, and model layers.
 *
 * @since 0.5.0
 * @module
 */
import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import * as OpenAiEmbeddingModel from "@effect/ai-openai/OpenAiEmbeddingModel"
import * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel"
import type * as EmbeddingModel from "effect/ai/EmbeddingModel"
import type * as LanguageModel from "effect/ai/LanguageModel"
import * as Boolean from "effect/Boolean"
import * as Data from "effect/Data"
import { dual } from "effect/Function"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Struct from "effect/Struct"

import { defaultCapabilities, Options as DefaultCapabilitiesOptions } from "./internal/defaultCapabilities.js"
import * as resolvedRoute from "./internal/resolvedRoute.js"
import * as Route from "./Route.js"
import { ModelLayers, Resolution } from "./Runtime.js"
import type * as RuntimeRequest from "./RuntimeRequest.js"

/** OpenAI-compatible model and base-URL layer options. @since 0.5.0 @category models */
export class Options extends Schema.Class<Options>("@scenesystems/effect-inference/OpenAiCompatible/Options")({
  model: Schema.String,
  baseUrl: Schema.String
}) {}

/** Route fields accepted by the OpenAI-compatible route constructor. @since 0.5.0 @category models */
export class RouteOptions extends Data.Class<{
  readonly baseUrl: string
  readonly serveMode: Route.ServeMode
  readonly authMethod: Route.AuthMethod
  readonly endpointId?: string
  readonly deploymentId?: string
  readonly gatewayId?: string
  readonly selectionPolicy?: Route.SelectionPolicy
  readonly runtimeFlavorHint?: Route.Flavor
}> {}

/** HTTP transport coordinates projected from a resolved route. @since 0.5.0 @category models */
export class Transport extends Data.Class<{
  readonly baseUrl: string
  readonly authMethod: Route.AuthMethod
}> {}

/** Route and transport projection used by compatible clients. @since 0.5.0 @category models */
export class TransportPlan extends Data.Class<{
  readonly route: Route.Route
  readonly transport: Transport
}> {}

/**
 * Constructs an OpenAI-compatible route without validating the endpoint URL.
 *
 * @since 0.5.0
 * @category constructors
 */
export const route = (options: RouteOptions): Route.Route => Struct.assign(options, { family: Route.defaultFamily })

/**
 * Replaces a request's route while retaining model intent and requirements.
 *
 * @since 0.5.0
 * @category combinators
 */
export const withRoute: {
  (options: RouteOptions): (request: RuntimeRequest.RuntimeRequest) => RuntimeRequest.RuntimeRequest
  (request: RuntimeRequest.RuntimeRequest, options: RouteOptions): RuntimeRequest.RuntimeRequest
} = dual(2, (request: RuntimeRequest.RuntimeRequest, options: RouteOptions) => ({
  ...request,
  route: route(options)
}))

/** Projects route identity into an OpenAI-compatible transport plan. @since 0.5.0 @category constructors */
export const planTransport = (resolvedRoute: Route.Route): TransportPlan =>
  new TransportPlan({
    route: resolvedRoute,
    transport: new Transport({ baseUrl: resolvedRoute.baseUrl, authMethod: resolvedRoute.authMethod })
  })

/** Builds a native language-model layer for an OpenAI-compatible endpoint. @since 0.5.0 @category layers */
export const languageModel = (options: Options): Layer.Layer<LanguageModel.LanguageModel> =>
  Layer.provide(
    Layer.provide(
      OpenRouterLanguageModel.layer({ model: options.model }),
      OpenRouterClient.layer({ apiUrl: options.baseUrl })
    ),
    FetchHttpClient.layer
  )

/** Builds a native embedding-model layer for an OpenAI-compatible endpoint. @since 0.5.0 @category layers */
export const embeddingModel = (options: Options): Layer.Layer<EmbeddingModel.EmbeddingModel> =>
  Layer.provide(
    Layer.provide(
      OpenAiEmbeddingModel.layer({ model: options.model }),
      OpenAiClient.layer({ apiUrl: options.baseUrl })
    ),
    FetchHttpClient.layer
  )

/**
 * Resolves a request to OpenAI-compatible layers without network I/O.
 *
 * @since 0.5.0
 * @category constructors
 */
export const resolve = (request: RuntimeRequest.RuntimeRequest, baseUrl: string): Resolution => {
  const selectedRoute = planTransport(
    Option.getOrElse(
      Option.fromNullishOr(request.route),
      () => route(new RouteOptions({ baseUrl, serveMode: "local-runtime", authMethod: "none" }))
    )
  ).route
  const capabilities = defaultCapabilities(new DefaultCapabilitiesOptions({ route: selectedRoute }))
  const options = new Options({ model: request.model.modelRef, baseUrl: selectedRoute.baseUrl })

  return new Resolution({
    request,
    route: resolvedRoute.make(request, selectedRoute),
    capabilities,
    models: new ModelLayers({
      languageModel: Boolean.match(capabilities.textGeneration, {
        onTrue: () => Option.some(languageModel(options)),
        onFalse: () => Option.none()
      }),
      embeddingModel: Boolean.match(capabilities.embeddings, {
        onTrue: () => Option.some(embeddingModel(options)),
        onFalse: () => Option.none()
      })
    })
  })
}
