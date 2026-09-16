/**
 * Hugging Face dedicated endpoint routes and model layers.
 *
 * @since 0.5.0
 * @module
 */
import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import * as OpenAiLanguageModel from "@effect/ai-openai/OpenAiLanguageModel"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import * as Boolean from "effect/Boolean"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"

import * as HuggingFaceEmbeddingModel from "./HuggingFaceEmbeddingModel.js"
import { defaultCapabilities } from "./internal/defaultCapabilities.js"
import * as resolvedRoute from "./internal/resolvedRoute.js"
import type * as Route from "./Route.js"
import { ModelLayers, Resolution } from "./Runtime.js"
import type * as RuntimeRequest from "./RuntimeRequest.js"

/** Language-model coordinates for a dedicated Hugging Face endpoint. @since 0.5.0 @category models */
export class LanguageOptions extends Schema.Class<LanguageOptions>(
  "@scenesystems/effect-inference/HuggingFaceEndpoint/LanguageOptions"
)({
  model: Schema.String,
  baseUrl: Schema.String,
  accessToken: Schema.optional(Schema.RedactedFromSelf(Schema.String))
}) {}

/** Constructs a dedicated Hugging Face endpoint route. @since 0.5.0 @category constructors */
export const route = (options: {
  readonly baseUrl: string
  readonly authMethod: Route.AuthMethod
  readonly endpointId?: string
  readonly deploymentId?: string
  readonly runtimeFlavorHint?: Route.Flavor
}): Route.Route => ({
  family: "HuggingFace",
  serveMode: "dedicated-endpoint",
  ...options
})

/** Builds an OpenAI-compatible language layer for a dedicated endpoint. @since 0.5.0 @category layers */
export const languageModel = (options: LanguageOptions): Layer.Layer<LanguageModel.LanguageModel> =>
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

/** Resolves a dedicated endpoint request into provenance and model layers. @since 0.5.0 @category constructors */
export const resolve = (
  request: RuntimeRequest.RuntimeRequest,
  baseUrl: string,
  accessToken?: Redacted.Redacted
): Resolution => {
  const requestedRoute = Option.fromNullable(request.route)
  const selectedRoute = route({
    baseUrl,
    authMethod: Option.match(requestedRoute, { onNone: () => "hf-token", onSome: (value) => value.authMethod }),
    ...Option.match(Option.flatMap(requestedRoute, (value) => Option.fromNullable(value.endpointId)), {
      onNone: () => ({}),
      onSome: (endpointId) => ({ endpointId })
    }),
    ...Option.match(Option.flatMap(requestedRoute, (value) => Option.fromNullable(value.deploymentId)), {
      onNone: () => ({}),
      onSome: (deploymentId) => ({ deploymentId })
    }),
    ...Option.match(Option.flatMap(requestedRoute, (value) => Option.fromNullable(value.runtimeFlavorHint)), {
      onNone: () => ({}),
      onSome: (runtimeFlavorHint) => ({ runtimeFlavorHint })
    })
  })
  const capabilities = defaultCapabilities({ route: selectedRoute })
  const token = Option.match(Option.fromNullable(accessToken), {
    onNone: () => ({}),
    onSome: (accessToken) => ({ accessToken })
  })

  return new Resolution({
    request,
    route: resolvedRoute.make(request, selectedRoute),
    capabilities,
    models: new ModelLayers({
      languageModel: Boolean.match(capabilities.textGeneration, {
        onTrue: () =>
          Option.some(languageModel(
            new LanguageOptions({
              model: request.model.modelRef,
              baseUrl: selectedRoute.baseUrl,
              ...token
            })
          )),
        onFalse: () => Option.none()
      }),
      embeddingModel: Boolean.match(capabilities.embeddings, {
        onTrue: () =>
          Option.some(HuggingFaceEmbeddingModel.layerFetch(
            new HuggingFaceEmbeddingModel.Options({
              model: request.model.modelRef,
              route: selectedRoute,
              ...token
            })
          )),
        onFalse: () => Option.none()
      })
    })
  })
}
