/**
 * Runtime resolution service and executable model-layer relationships.
 *
 * @since 0.5.0
 * @module
 */
import type * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"

import type * as Capabilities from "./Capabilities.js"
import type { InferenceError } from "./InferenceError.js"
import { UnsupportedRoute } from "./InferenceError.js"
import { ensureCapabilityRequirements } from "./internal/capabilityValidation.js"
import { defaultCapabilities } from "./internal/defaultCapabilities.js"
import * as modelLayers from "./internal/modelLayers.js"
import * as resolvedRoute from "./internal/resolvedRoute.js"
import type * as Route from "./Route.js"
import type * as RuntimeRequest from "./RuntimeRequest.js"

/**
 * Optional model layers admitted by capability resolution.
 *
 * @since 0.5.0
 * @category models
 */
export class ModelLayers extends Data.Class<{
  readonly languageModel: Option.Option<Layer.Layer<LanguageModel.LanguageModel>>
  readonly embeddingModel: Option.Option<Layer.Layer<EmbeddingModel.EmbeddingModel>>
}> {}

/**
 * Pre-execution route decision and executable model layers.
 *
 * @since 0.5.0
 * @category models
 */
export class Resolution extends Data.Class<{
  readonly request: RuntimeRequest.RuntimeRequest
  readonly route: Route.Resolved
  readonly capabilities: Capabilities.Capabilities
  readonly models: ModelLayers
}> {}

/**
 * Runtime service contract. This executable relationship is
 * deliberately modeled as Data rather than a serialization schema.
 *
 * @since 0.5.0
 * @category models
 */
export class Service extends Data.Class<{
  readonly resolve: (request: RuntimeRequest.RuntimeRequest) => Effect.Effect<Resolution, InferenceError>
}> {}

/**
 * Runtime resolution service.
 *
 * @since 0.5.0
 * @category services
 */
export class Runtime extends Context.Tag("@scenesystems/effect-inference/Runtime")<Runtime, Service>() {}

/**
 * Resolves caller intent with the active Runtime service.
 *
 * @since 0.5.0
 * @category accessors
 */
export const resolve = (request: RuntimeRequest.RuntimeRequest): Effect.Effect<Resolution, InferenceError, Runtime> =>
  Effect.flatMap(Runtime, (runtime) => runtime.resolve(request))

/** Creates an empty set of executable model layers. @since 0.5.0 @category constructors */
export const emptyModelLayers = (): ModelLayers =>
  new ModelLayers({ languageModel: Option.none(), embeddingModel: Option.none() })

const requireRoute = (request: RuntimeRequest.RuntimeRequest): Effect.Effect<Route.Route, UnsupportedRoute> =>
  Option.match(Option.fromNullable(request.route), {
    onSome: Effect.succeed,
    onNone: () =>
      Effect.fail(new UnsupportedRoute({ reason: "RuntimeRequest.route is required for default runtime resolution" }))
  })

const defaultService = new Service({
  resolve: (request) =>
    Effect.gen(function*() {
      const route = yield* requireRoute(request)
      const capabilities = defaultCapabilities({ route })
      yield* ensureCapabilityRequirements(Option.fromNullable(request.capabilities), capabilities)
      return new Resolution({
        request,
        route: resolvedRoute.make(request, route),
        capabilities,
        models: modelLayers.make({ request, route, capabilities })
      })
    })
})

/**
 * Default runtime resolver for stable route families.
 *
 * @since 0.5.0
 * @category layers
 */
export const layer: Layer.Layer<Runtime> = Layer.succeed(Runtime, defaultService)

/**
 * Installs a caller-owned runtime implementation.
 *
 * @since 0.5.0
 * @category layers
 */
export const layerWith = (
  resolve: Service["resolve"]
): Layer.Layer<Runtime> => Layer.succeed(Runtime, new Service({ resolve }))
