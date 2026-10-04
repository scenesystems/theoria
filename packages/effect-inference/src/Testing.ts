/**
 * Deterministic model layers and runtime fixtures for tests.
 *
 * @since 0.5.0
 * @module
 */
import * as EmbeddingModel from "effect/ai/EmbeddingModel"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Response from "effect/ai/Response"
import * as Arr from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as Struct from "effect/Struct"

import { defaultCapabilities, Options as DefaultCapabilitiesOptions } from "./internal/defaultCapabilities.js"
import * as Model from "./Model.js"
import * as Route from "./Route.js"
import * as Runtime from "./Runtime.js"
import * as RuntimeEvidence from "./RuntimeEvidence.js"
import * as RuntimeRequest from "./RuntimeRequest.js"

const RequestOptions = Schema.Struct({
  modelRef: Schema.optionalKey(Model.Model.fields.modelRef),
  ...Struct.pick(RuntimeRequest.RuntimeRequest.fields, ["route", "capabilities"])
})

const ResolvedRouteOptions = Schema.Struct({
  request: Schema.optionalKey(RuntimeRequest.RuntimeRequest),
  ...Struct.map(Route.Resolved.fields, Schema.optionalKey)
})

const ResolutionOptions = Schema.Struct({
  request: RuntimeRequest.RuntimeRequest,
  route: Schema.optionalKey(Route.Resolved),
  capabilities: Schema.optionalKey(RuntimeEvidence.RuntimeEvidence.fields.capabilities)
})

const ResponseOptions = RuntimeEvidence.Response.mapFields(Struct.map(Schema.optionalKey))

const EvidenceOptions = Schema.Struct({
  ...ResolutionOptions.fields,
  response: Schema.optionalKey(RuntimeEvidence.Response)
})

/**
 * Creates caller intent with deterministic defaults for runtime tests.
 *
 * @since 0.5.0
 * @category fixtures
 */
export const request = (
  options: typeof RequestOptions.Type = {}
): RuntimeRequest.RuntimeRequest => ({
  model: { modelRef: Option.getOrElse(Option.fromNullishOr(options.modelRef), () => "testing/model") },
  ...Option.match(Option.fromNullishOr(options.route), {
    onNone: () => ({}),
    onSome: (route) => ({ route })
  }),
  ...Option.match(Option.fromNullishOr(options.capabilities), {
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
  const runtimeRequest = Option.getOrElse(Option.fromNullishOr(options.request), request)
  const selectedRoute: Route.Route = Option.getOrElse(
    Option.fromNullishOr(options.route).pipe(Option.orElse(() => Option.fromNullishOr(runtimeRequest.route))),
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
    providerModel: Option.getOrElse(Option.fromNullishOr(options.providerModel), () => runtimeRequest.model.modelRef),
    selectionReason: Option.getOrElse(Option.fromNullishOr(options.selectionReason), () => "testing-static-resolution"),
    schemaVersion: Option.getOrElse(Option.fromNullishOr(options.schemaVersion), () => Route.provenanceVersion),
    ...Option.match(Option.fromNullishOr(options.selectedProvider), {
      onNone: () => ({}),
      onSome: (selectedProvider) => ({ selectedProvider })
    }),
    ...Option.match(Option.fromNullishOr(options.selectedDeployment), {
      onNone: () => ({}),
      onSome: (selectedDeployment) => ({ selectedDeployment })
    }),
    ...Option.fromNullishOr(options.runtimeFlavor).pipe(
      Option.orElse(() => Option.fromNullishOr(selectedRoute.runtimeFlavorHint)),
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
  const route = Option.getOrElse(
    Option.fromNullishOr(options.route),
    () => resolvedRoute({ request: options.request })
  )
  return new Runtime.Resolution({
    request: options.request,
    route,
    capabilities: Option.getOrElse(
      Option.fromNullishOr(options.capabilities),
      () => defaultCapabilities(new DefaultCapabilitiesOptions({ route: route.route }))
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
  responseModel: Option.getOrElse(Option.fromNullishOr(options.responseModel), () => "testing/model"),
  ...Option.match(Option.fromNullishOr(options.responseId), {
    onNone: () => ({}),
    onSome: (responseId) => ({ responseId })
  }),
  ...Option.match(Option.fromNullishOr(options.startedAtMs), {
    onNone: () => ({}),
    onSome: (startedAtMs) => ({ startedAtMs })
  }),
  ...Option.match(Option.fromNullishOr(options.completedAtMs), {
    onNone: () => ({}),
    onSome: (completedAtMs) => ({ completedAtMs })
  }),
  ...Option.match(Option.fromNullishOr(options.finishReason), {
    onNone: () => ({}),
    onSome: (finishReason) => ({ finishReason })
  }),
  ...Option.match(Option.fromNullishOr(options.systemFingerprint), {
    onNone: () => ({}),
    onSome: (systemFingerprint) => ({ systemFingerprint })
  }),
  ...Option.match(Option.fromNullishOr(options.usage), {
    onNone: () => ({}),
    onSome: (usage) => ({ usage })
  }),
  ...Option.match(Option.fromNullishOr(options.providerMetadata), {
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
    resolution(
      {
        request: options.request,
        ...Option.match(Option.fromNullishOr(options.route), {
          onNone: () => ({}),
          onSome: (route) => ({ route })
        }),
        ...Option.match(Option.fromNullishOr(options.capabilities), {
          onNone: () => ({}),
          onSome: (capabilities) => ({ capabilities })
        })
      }
    ),
    Option.getOrElse(Option.fromNullishOr(options.response), response)
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
    inputTokens: {},
    outputTokens: {}
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
          Response.makePart("text", { text: value, metadata: {} }),
          Response.makePart("finish", { reason: "stop", usage: defaultUsage(), metadata: {} })
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
      embedMany: (options) =>
        Effect.succeed({
          results: Arr.map(options.inputs, () => Arr.fromIterable(embedding)),
          usage: { inputTokens: undefined }
        })
    })
  )
