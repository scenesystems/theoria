/**
 * Deterministic model layers and runtime fixtures for tests.
 *
 * @since 0.5.0
 * @module
 */
import * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Response from "@effect/ai/Response"
import * as Arr from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"

import { defaultCapabilities } from "./internal/defaultCapabilities.js"
import * as Model from "./Model.js"
import * as Route from "./Route.js"
import * as Runtime from "./Runtime.js"
import * as RuntimeEvidence from "./RuntimeEvidence.js"
import * as RuntimeRequest from "./RuntimeRequest.js"

const RequestOptions = Schema.extend(
  Schema.Struct({ modelRef: Schema.optional(Model.Model.fields.modelRef) }),
  Schema.partialWith(RuntimeRequest.RuntimeRequest.pipe(Schema.pick("route", "capabilities")), { exact: true })
)

const ResolvedRouteOptions = Schema.extend(
  Schema.Struct({ request: Schema.optional(RuntimeRequest.RuntimeRequest) }),
  Schema.partialWith(Route.Resolved, { exact: true })
)

const ResolutionOptions = Schema.extend(
  RuntimeEvidence.RuntimeEvidence.pipe(Schema.pick("request")),
  Schema.partialWith(RuntimeEvidence.RuntimeEvidence.pipe(Schema.pick("route", "capabilities")), { exact: true })
)

const ResponseOptions = Schema.partialWith(RuntimeEvidence.Response, { exact: true })

const EvidenceOptions = Schema.extend(
  RuntimeEvidence.RuntimeEvidence.pipe(Schema.pick("request")),
  Schema.partialWith(RuntimeEvidence.RuntimeEvidence.pipe(Schema.pick("route", "capabilities", "response")), {
    exact: true
  })
)

/**
 * Creates caller intent with deterministic defaults for runtime tests.
 *
 * @since 0.5.0
 * @category fixtures
 */
export const request = (
  options: typeof RequestOptions.Type = {}
): RuntimeRequest.RuntimeRequest => ({
  model: { modelRef: Option.getOrElse(Option.fromNullable(options.modelRef), () => "testing/model") },
  ...Option.match(Option.fromNullable(options.route), {
    onNone: () => ({}),
    onSome: (route) => ({ route })
  }),
  ...Option.match(Option.fromNullable(options.capabilities), {
    onNone: () => ({}),
    onSome: (capabilities) => ({ capabilities })
  })
})

/**
 * Creates deterministic pre-execution route provenance for tests.
 *
 * @since 0.5.0
 * @category fixtures
 */
export const resolvedRoute = (
  options: typeof ResolvedRouteOptions.Type = {}
): Route.Resolved => {
  const runtimeRequest = Option.getOrElse(Option.fromNullable(options.request), request)
  const selectedRoute: Route.Route = Option.getOrElse(
    Option.fromNullable(options.route).pipe(Option.orElse(() => Option.fromNullable(runtimeRequest.route))),
    (): Route.Route => ({
      family: Route.defaultFamily,
      serveMode: "local-runtime",
      authMethod: "none",
      baseUrl: "in-memory://runtime",
      runtimeFlavorHint: Route.defaultFlavor
    })
  )
  return {
    route: selectedRoute,
    providerModel: Option.getOrElse(Option.fromNullable(options.providerModel), () => runtimeRequest.model.modelRef),
    selectionReason: Option.getOrElse(Option.fromNullable(options.selectionReason), () => "testing-static-resolution"),
    schemaVersion: Option.getOrElse(Option.fromNullable(options.schemaVersion), () => Route.provenanceVersion),
    ...Option.match(Option.fromNullable(options.selectedProvider), {
      onNone: () => ({}),
      onSome: (selectedProvider) => ({ selectedProvider })
    }),
    ...Option.match(Option.fromNullable(options.selectedDeployment), {
      onNone: () => ({}),
      onSome: (selectedDeployment) => ({ selectedDeployment })
    }),
    ...Option.fromNullable(options.runtimeFlavor).pipe(
      Option.orElse(() => Option.fromNullable(selectedRoute.runtimeFlavorHint)),
      Option.match({
        onNone: () => ({}),
        onSome: (runtimeFlavor) => ({ runtimeFlavor })
      })
    )
  }
}

/**
 * Creates a pre-execution resolution without executable model layers.
 *
 * @since 0.5.0
 * @category fixtures
 */
export const resolution = (options: typeof ResolutionOptions.Type): Runtime.Resolution => {
  const route = Option.getOrElse(Option.fromNullable(options.route), () => resolvedRoute({ request: options.request }))
  return new Runtime.Resolution({
    request: options.request,
    route,
    capabilities: Option.getOrElse(
      Option.fromNullable(options.capabilities),
      () => defaultCapabilities({ route: route.route })
    ),
    models: Runtime.emptyModelLayers()
  })
}

/**
 * Creates post-execution response observations with deterministic defaults.
 *
 * @since 0.5.0
 * @category fixtures
 */
export const response = (
  options: typeof ResponseOptions.Type = {}
): RuntimeEvidence.Response => ({
  responseModel: Option.getOrElse(Option.fromNullable(options.responseModel), () => "testing/model"),
  ...Option.match(Option.fromNullable(options.responseId), {
    onNone: () => ({}),
    onSome: (responseId) => ({ responseId })
  }),
  ...Option.match(Option.fromNullable(options.startedAtMs), {
    onNone: () => ({}),
    onSome: (startedAtMs) => ({ startedAtMs })
  }),
  ...Option.match(Option.fromNullable(options.completedAtMs), {
    onNone: () => ({}),
    onSome: (completedAtMs) => ({ completedAtMs })
  }),
  ...Option.match(Option.fromNullable(options.finishReason), {
    onNone: () => ({}),
    onSome: (finishReason) => ({ finishReason })
  }),
  ...Option.match(Option.fromNullable(options.systemFingerprint), {
    onNone: () => ({}),
    onSome: (systemFingerprint) => ({ systemFingerprint })
  }),
  ...Option.match(Option.fromNullable(options.usage), {
    onNone: () => ({}),
    onSome: (usage) => ({ usage })
  }),
  ...Option.match(Option.fromNullable(options.providerMetadata), {
    onNone: () => ({}),
    onSome: (providerMetadata) => ({ providerMetadata })
  })
})

/**
 * Combines deterministic resolution and response fixtures into evidence.
 *
 * @since 0.5.0
 * @category fixtures
 */
export const evidence = (options: typeof EvidenceOptions.Type): RuntimeEvidence.RuntimeEvidence =>
  RuntimeEvidence.make(
    resolution({
      request: options.request,
      ...Option.match(Option.fromNullable(options.route), {
        onNone: () => ({}),
        onSome: (route) => ({ route })
      }),
      ...Option.match(Option.fromNullable(options.capabilities), {
        onNone: () => ({}),
        onSome: (capabilities) => ({ capabilities })
      })
    }),
    Option.getOrElse(Option.fromNullable(options.response), response)
  )

/**
 * Installs a fixed runtime resolution for deterministic tests.
 *
 * @since 0.5.0
 * @category layers
 */
export const runtimeLayer = (value: Runtime.Resolution): Layer.Layer<Runtime.Runtime> =>
  Runtime.layerWith(() => Effect.succeed(value))

const defaultUsage = () =>
  new Response.Usage({
    inputTokens: undefined,
    outputTokens: undefined,
    totalTokens: undefined,
    reasoningTokens: undefined,
    cachedInputTokens: undefined
  })

/**
 * Provides a deterministic text-generating native language model.
 *
 * @since 0.5.0
 * @category layers
 */
export const languageModel = (value = "testing-response"): Layer.Layer<LanguageModel.LanguageModel> =>
  Layer.effect(
    LanguageModel.LanguageModel,
    LanguageModel.make({
      generateText: () =>
        Effect.succeed(Arr.make(
          Response.textPart({ text: value, metadata: {} }),
          Response.finishPart({ reason: "stop", usage: defaultUsage(), metadata: {} })
        )),
      streamText: () => Stream.empty
    })
  )

/**
 * Provides a deterministic native embedding model.
 *
 * @since 0.5.0
 * @category layers
 */
export const embeddingModel = (
  embedding: Iterable<number> = Arr.make(0.1, 0.2, 0.3)
): Layer.Layer<EmbeddingModel.EmbeddingModel> =>
  Layer.effect(
    EmbeddingModel.EmbeddingModel,
    EmbeddingModel.make({
      embedMany: (input) =>
        Effect.succeed(Arr.map(input, (_, index) => ({
          index,
          embeddings: Arr.fromIterable(embedding)
        })))
    })
  )
