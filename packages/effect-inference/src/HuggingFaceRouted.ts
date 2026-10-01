/**
 * Hugging Face provider-router routes and model layers.
 *
 * @since 0.5.0
 * @module
 */
import * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import * as Boolean from "effect/Boolean"
import * as Layer from "effect/Layer"
import * as Match from "effect/Match"
import * as Option from "effect/Option"
import type * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import * as String from "effect/String"

import * as HuggingFaceEmbeddingModel from "./HuggingFaceEmbeddingModel.js"
import { defaultCapabilities } from "./internal/defaultCapabilities.js"
import * as resolvedRoute from "./internal/resolvedRoute.js"
import * as Route from "./Route.js"
import { ModelLayers, Resolution } from "./Runtime.js"
import type * as RuntimeRequest from "./RuntimeRequest.js"

/** Language-model coordinates for the Hugging Face provider router. @since 0.5.0 @category models */
export class LanguageOptions extends Schema.Class<LanguageOptions>(
  "@scenesystems/effect-inference/HuggingFaceRouted/LanguageOptions"
)({
  model: Schema.String,
  baseUrl: Schema.String,
  accessToken: Schema.optional(Schema.RedactedFromSelf(Schema.String)),
  selectionPolicy: Schema.optional(Route.SelectionPolicy)
}) {}

/** Constructs a Hugging Face provider-router route. @since 0.5.0 @category constructors */
export const route = (options: {
  readonly baseUrl: string
  readonly authMethod: Route.AuthMethod
  readonly gatewayId?: string
  readonly selectionPolicy?: Route.SelectionPolicy
}): Route.Route => ({
  family: "HuggingFace",
  serveMode: "routed-marketplace",
  ...options
})

const selectionSuffix = (selectionPolicy: Option.Option<Route.SelectionPolicy>): Option.Option<string> =>
  Option.flatMap(selectionPolicy, (value) =>
    Match.value(value).pipe(
      Match.when("auto", () => Option.none()),
      Match.whenOr("fastest", "cheapest", "preferred", (policy) => Option.some(policy)),
      Match.when({ _tag: "provider" }, ({ provider }) => Option.some(provider)),
      Match.exhaustive
    ))

// Encodes chat-only router selection. Feature extraction uses Hub mappings.
const modelRef = (
  model: string,
  selectionPolicy: Option.Option<Route.SelectionPolicy>
): string =>
  selectionSuffix(selectionPolicy).pipe(Option.match({
    onNone: () => model,
    onSome: (suffix) => String.concat(model, String.concat(":", suffix))
  }))

/** Builds an OpenRouter language layer targeting the Hugging Face router. @since 0.5.0 @category layers */
export const languageModel = (options: LanguageOptions): Layer.Layer<LanguageModel.LanguageModel> =>
  Layer.provide(
    Layer.provide(
      OpenRouterLanguageModel.layer({
        model: modelRef(options.model, Option.fromNullable(options.selectionPolicy))
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

/** Resolves a routed request into provenance and executable model layers. @since 0.5.0 @category constructors */
export const resolve = (
  request: RuntimeRequest.RuntimeRequest,
  baseUrl: string,
  accessToken?: Redacted.Redacted
): Resolution => {
  const requestedRoute = Option.fromNullable(request.route)
  const selectedRoute = route({
    baseUrl,
    authMethod: "hf-token",
    ...Option.match(Option.flatMap(requestedRoute, (value) => Option.fromNullable(value.gatewayId)), {
      onNone: () => ({}),
      onSome: (gatewayId) => ({ gatewayId })
    }),
    ...Option.match(Option.flatMap(requestedRoute, (value) => Option.fromNullable(value.selectionPolicy)), {
      onNone: () => ({}),
      onSome: (selectionPolicy) => ({ selectionPolicy })
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
              ...token,
              ...Option.match(Option.fromNullable(selectedRoute.selectionPolicy), {
                onNone: () => ({}),
                onSome: (selectionPolicy) => ({ selectionPolicy })
              })
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
