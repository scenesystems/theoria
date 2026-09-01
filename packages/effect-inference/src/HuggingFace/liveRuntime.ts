/**
 * Access-token-aware live runtime helpers for Hugging Face routed-provider and
 * dedicated-endpoint execution.
 *
 * @since 0.1.0
 */
import type * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { Effect, type Layer, Option } from "effect"

import { CapabilityMismatch } from "../Errors/Capability.js"
import type { InvalidRuntimeConfig } from "../Errors/Config.js"
import { ensureCapabilityRequirements } from "../internal/capabilityValidation.js"
import type { RuntimeResolution } from "../Runtime/services.js"
import { makeHuggingFaceEndpointResolution } from "./endpoint.js"
import {
  descriptorForLiveRuntime,
  type LiveRuntimeConfigOptions,
  type LiveRuntimeOptions,
  resolveLiveRuntimeConfig
} from "./liveRuntimeConfig.js"
import { makeHuggingFaceRoutedResolution } from "./routed.js"

const resolutionForLiveRuntime = (options: LiveRuntimeOptions): RuntimeResolution => {
  const descriptor = descriptorForLiveRuntime(options)

  return options.serveMode === "routed-marketplace"
    ? makeHuggingFaceRoutedResolution(descriptor, descriptor.route.baseUrl, options.accessToken)
    : makeHuggingFaceEndpointResolution(descriptor, descriptor.route.baseUrl, options.accessToken)
}

const missingCapability = (capability: string, reason: string): CapabilityMismatch =>
  new CapabilityMismatch({ capability, reason })

/**
 * Builds route provenance and authenticated model layers from explicit
 * Hugging Face options, then checks requested capabilities against the route's
 * conservative capability matrix. This effect performs no provider request.
 *
 * @since 0.1.0
 * @category constructors
 */
export const resolveLiveRuntime = (
  options: LiveRuntimeOptions
): Effect.Effect<RuntimeResolution, CapabilityMismatch> =>
  Effect.gen(function*() {
    const resolution = resolutionForLiveRuntime(options)

    yield* ensureCapabilityRequirements(Option.fromNullable(resolution.desired.capabilities), resolution.capabilities)

    return resolution
  })

/**
 * Decodes Hugging Face config with explicit options taking precedence over the
 * selected `ConfigProvider`, then delegates to {@link resolveLiveRuntime}.
 *
 * @since 0.1.0
 * @category constructors
 */
export const resolveLiveRuntimeFromConfig = (
  options: LiveRuntimeConfigOptions = {}
): Effect.Effect<RuntimeResolution, InvalidRuntimeConfig | CapabilityMismatch> =>
  resolveLiveRuntimeConfig(options).pipe(Effect.flatMap(resolveLiveRuntime))

/**
 * Extracts the authenticated live `LanguageModel` layer from a Hugging Face
 * runtime resolution.
 *
 * @since 0.1.0
 * @category constructors
 */
export const languageModelLayer = (
  resolution: RuntimeResolution
): Effect.Effect<Layer.Layer<LanguageModel.LanguageModel, never, never>, CapabilityMismatch> =>
  Option.match(resolution.layers.languageModel, {
    onNone: () =>
      Effect.fail(
        missingCapability("textGeneration", "resolved runtime does not support text generation")
      ),
    onSome: Effect.succeed
  })

/**
 * Extracts the authenticated live `EmbeddingModel` layer from a Hugging Face
 * runtime resolution.
 *
 * @since 0.1.0
 * @category constructors
 */
export const embeddingModelLayer = (
  resolution: RuntimeResolution
): Effect.Effect<Layer.Layer<EmbeddingModel.EmbeddingModel, never, never>, CapabilityMismatch> =>
  Option.match(resolution.layers.embeddingModel, {
    onNone: () =>
      Effect.fail(
        missingCapability("embeddings", "resolved runtime does not support embeddings")
      ),
    onSome: Effect.succeed
  })
