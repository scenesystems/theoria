/**
 * Native Hugging Face feature extraction for endpoints and provider-router routes.
 *
 * @since 0.5.0
 * @module
 */
import type * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import type * as HttpClient from "@effect/platform/HttpClient"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"

import * as internal from "./internal/huggingFaceEmbeddingModel.js"
import * as Route from "./Route.js"

/**
 * Feature-extraction coordinates and credentials. The route selects direct
 * endpoint execution or provider discovery through the Hugging Face Hub.
 *
 * @since 0.5.0
 * @category models
 */
export class Options extends Schema.Class<Options>(
  "@scenesystems/effect-inference/HuggingFaceEmbeddingModel/Options"
)({
  model: Schema.String,
  route: Route.Route,
  accessToken: Schema.optional(Schema.RedactedFromSelf(Schema.String))
}) {}

/**
 * Provides native feature extraction using the caller's platform HTTP client.
 * Routed discovery is cached per layer; HTTP 503 responses are retried twice.
 * Transport and response-validation failures use the native AI error channel.
 *
 * @since 0.5.0
 * @category layers
 */
export const layer: (
  options: Options
) => Layer.Layer<EmbeddingModel.EmbeddingModel, never, HttpClient.HttpClient> = internal.layer

/**
 * Provides native feature extraction with the platform fetch HTTP client.
 *
 * @since 0.5.0
 * @category layers
 */
export const layerFetch = (options: Options): Layer.Layer<EmbeddingModel.EmbeddingModel> =>
  Layer.provide(layer(options), FetchHttpClient.layer)
