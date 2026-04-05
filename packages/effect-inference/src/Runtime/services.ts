/**
 * Runtime resolver service tags and resolution result types.
 *
 * @since 0.1.0
 */
import type * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { Data, Effect, Layer, Option } from "effect"

import type { DesiredRuntimeDescriptor } from "../contracts/DesiredRuntimeDescriptor.js"
import type { ResolvedRouteDescriptor } from "../contracts/ResolvedRouteDescriptor.js"
import type { RuntimeCapabilities } from "../contracts/RuntimeCapabilities.js"
import type { InferenceError } from "../Errors/index.js"

/**
 * Optional language-model and embedding-model layers resolved for a runtime.
 *
 * @since 0.1.0
 * @category models
 */
export class ResolvedModelLayers extends Data.Class<{
  readonly languageModel: Option.Option<Layer.Layer<LanguageModel.LanguageModel, never, never>>
  readonly embeddingModel: Option.Option<Layer.Layer<EmbeddingModel.EmbeddingModel, never, never>>
}> {}

/**
 * Full resolution result returned by {@link RuntimeResolver}.
 *
 * @since 0.1.0
 * @category models
 */
export class RuntimeResolution extends Data.Class<{
  readonly desired: DesiredRuntimeDescriptor
  readonly resolvedRoute: ResolvedRouteDescriptor
  readonly capabilities: RuntimeCapabilities
  readonly layers: ResolvedModelLayers
}> {}

/**
 * Public API for runtime resolution services.
 *
 * @since 0.1.0
 * @category models
 */
export class RuntimeResolverApi extends Data.Class<{
  readonly resolve: (
    descriptor: DesiredRuntimeDescriptor
  ) => Effect.Effect<RuntimeResolution, InferenceError>
}> {}

/**
 * Package-owned service tag for provider-blind runtime resolution.
 *
 * @since 0.1.0
 * @category services
 */
export class RuntimeResolver extends Effect.Tag("effect-inference/Runtime/RuntimeResolver")<
  RuntimeResolver,
  RuntimeResolverApi
>() {}

/**
 * Lifts a resolver implementation into a layer.
 *
 * @since 0.1.0
 * @category layers
 */
export const layer = (api: RuntimeResolverApi): Layer.Layer<RuntimeResolver> => Layer.succeed(RuntimeResolver, api)

/**
 * Returns an empty layer set for descriptor states that do not yet bind a live
 * model.
 *
 * @since 0.1.0
 * @category constructors
 */
export const emptyResolvedModelLayers = (): ResolvedModelLayers =>
  new ResolvedModelLayers({
    languageModel: Option.none(),
    embeddingModel: Option.none()
  })
