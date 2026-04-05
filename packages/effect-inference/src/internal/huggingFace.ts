/**
 * Internal Hugging Face client helpers for routed-provider and dedicated-endpoint lanes.
 *
 * @since 0.1.0
 */
import * as AiError from "@effect/ai/AiError"
import * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import { type FeatureExtractionArgs, InferenceClient } from "@huggingface/inference"
import { Effect, Layer, Match, Option } from "effect"
import * as Arr from "effect/Array"
import * as Redacted from "effect/Redacted"

import type { ExecutionRoute } from "../contracts/ExecutionRoute.js"
import type { RouteSelectionPolicy } from "../contracts/RouteSelectionPolicy.js"

const moduleName = "HuggingFace"

const unknownError = (method: string, description: string, cause: unknown): AiError.UnknownError =>
  new AiError.UnknownError({
    module: moduleName,
    method,
    description,
    cause
  })

const isNumberArray = (value: unknown): value is ReadonlyArray<number> =>
  Arr.isArray(value) && value.every((entry) => typeof entry === "number")

const isEmbeddingBatch = (value: unknown): value is ReadonlyArray<ReadonlyArray<number>> =>
  Arr.isArray(value) && value.every(isNumberArray)

const normalizeEmbeddings = (
  output: unknown
): Effect.Effect<Array<EmbeddingModel.Result>, AiError.AiError> => {
  if (isNumberArray(output)) {
    return Effect.succeed([{ index: 0, embeddings: [...output] }])
  }

  if (isEmbeddingBatch(output)) {
    return Effect.succeed(output.map((embeddings, index) => ({ index, embeddings: [...embeddings] })))
  }

  return Effect.fail(
    unknownError(
      "featureExtraction",
      "Hugging Face feature-extraction output did not decode to one embedding vector per request.",
      output
    )
  )
}

const selectionSuffix = (selectionPolicy: Option.Option<RouteSelectionPolicy>): Option.Option<string> =>
  Option.match(selectionPolicy, {
    onNone: () => Option.none(),
    onSome: (value) =>
      Match.value(value).pipe(
        Match.when("auto", () => Option.none()),
        Match.when("fastest", () => Option.some("fastest")),
        Match.when("cheapest", () => Option.some("cheapest")),
        Match.when("preferred", () => Option.some("preferred")),
        Match.orElse(({ provider }) => Option.some(provider))
      )
  })

/**
 * Encodes routed-provider selection policy into the Hugging Face model-ref suffix
 * expected by chat-completions and feature-extraction APIs.
 *
 * @since 0.1.0
 */
export const makeHuggingFaceRoutedModelRef = (
  modelRef: string,
  selectionPolicy: Option.Option<RouteSelectionPolicy>
): string =>
  selectionSuffix(selectionPolicy).pipe(
    Option.match({
      onNone: () => modelRef,
      onSome: (suffix) => `${modelRef}:${suffix}`
    })
  )

const inferenceClientForRoute = (
  route: ExecutionRoute,
  accessToken?: Redacted.Redacted
): InferenceClient =>
  route.serveMode === "routed-marketplace"
    ? new InferenceClient(accessToken ? Redacted.value(accessToken) : undefined)
    : new InferenceClient(accessToken ? Redacted.value(accessToken) : undefined, { endpointUrl: route.baseUrl })

const featureExtractionArgs = (options: {
  readonly input: readonly [string, ...Array<string>]
  readonly model: string
  readonly route: ExecutionRoute
}): FeatureExtractionArgs => {
  const [first, ...rest] = options.input
  const inputs = rest.length === 0 ? first : [first, ...rest]

  return {
    inputs,
    ...(options.route.serveMode === "routed-marketplace"
      ? { model: makeHuggingFaceRoutedModelRef(options.model, Option.fromNullable(options.route.selectionPolicy)) }
      : { model: options.model })
  }
}

/**
 * Constructs the package-owned Hugging Face embeddings layer for both routed
 * providers and dedicated endpoints.
 *
 * @since 0.1.0
 */
export const makeHuggingFaceEmbeddingLayer = (options: {
  readonly model: string
  readonly route: ExecutionRoute
  readonly accessToken?: Redacted.Redacted
}): Layer.Layer<EmbeddingModel.EmbeddingModel, never, never> =>
  Layer.effect(
    EmbeddingModel.EmbeddingModel,
    Effect.sync(() => inferenceClientForRoute(options.route, options.accessToken)).pipe(
      Effect.flatMap((client) =>
        EmbeddingModel.make({
          embedMany: (input) => {
            const [first, ...rest] = input

            return typeof first === "undefined"
              ? Effect.succeed([])
              : Effect.tryPromise({
                try: () =>
                  client.featureExtraction(
                    featureExtractionArgs({ input: [first, ...rest], model: options.model, route: options.route })
                  ),
                catch: (cause) =>
                  unknownError(
                    "featureExtraction",
                    "Hugging Face feature extraction request failed.",
                    cause
                  )
              }).pipe(Effect.flatMap(normalizeEmbeddings))
          }
        })
      )
    )
  )
