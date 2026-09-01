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
 * Optional, fully provided Effect AI model layers selected during resolution.
 * `None` means the conservative capability matrix does not expose that model
 * lane; it is not evidence that a provider lacks the capability.
 *
 * @since 0.1.0
 * @category models
 */
export class ResolvedModelLayers extends Data.Class<{
  readonly languageModel: Option.Option<Layer.Layer<LanguageModel.LanguageModel, never, never>>
  readonly embeddingModel: Option.Option<Layer.Layer<EmbeddingModel.EmbeddingModel, never, never>>
}> {}

/**
 * Pre-execution result returned by {@link RuntimeResolver}. `resolvedRoute`
 * and `capabilities` describe package resolution only; provider response model,
 * usage, and finish metadata belong in post-execution runtime evidence.
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
 * Service implementation contract for runtime resolution. `resolve` requires
 * no ambient services, and failures remain in the package-owned
 * {@link InferenceError} channel.
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
 * Context tag used by effects that acquire a runtime resolution. Provide
 * {@link RuntimeResolverLive}, {@link layer}, or a testing resolver for the
 * lifetime of the consuming effect.
 *
 * @since 0.1.0
 * @category services
 */
export class RuntimeResolver extends Effect.Tag("effect-inference/Runtime/RuntimeResolver")<
  RuntimeResolver,
  RuntimeResolverApi
>() {}

/**
 * Lifts a caller-owned resolver implementation into an unscoped service layer.
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
