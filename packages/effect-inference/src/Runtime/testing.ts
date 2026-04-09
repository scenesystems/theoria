/**
 * Testing helpers for deterministic runtime resolution.
 *
 * @since 0.1.0
 */
import * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Response from "@effect/ai/Response"
import { Effect, Layer, Option, Stream } from "effect"

import {
  DesiredRuntimeDescriptor as DesiredRuntimeDescriptorContract,
  type DesiredRuntimeDescriptor as DesiredRuntimeDescriptorModel
} from "../contracts/DesiredRuntimeDescriptor.js"
import type { ExecutionRoute } from "../contracts/ExecutionRoute.js"
import {
  ResolvedRouteDescriptor as ResolvedRouteDescriptorContract,
  type ResolvedRouteDescriptor as ResolvedRouteDescriptorModel,
  ResolvedRouteProvenanceVersion
} from "../contracts/ResolvedRouteDescriptor.js"
import {
  ResolvedRuntimeDescriptor as ResolvedRuntimeDescriptorContract,
  type ResolvedRuntimeDescriptor as ResolvedRuntimeDescriptorModel
} from "../contracts/ResolvedRuntimeDescriptor.js"
import { defaultRouteFamily } from "../contracts/RouteFamily.js"
import type { RuntimeCapabilities } from "../contracts/RuntimeCapabilities.js"
import { defaultRuntimeFlavor } from "../contracts/RuntimeFlavor.js"
import { defaultRuntimeCapabilities } from "../internal/defaultCapabilities.js"
import { testingSelectionReason } from "../internal/resolvedRoute.js"
import { RuntimeEvidence as RuntimeEvidenceRuntime } from "./evidence.js"
import {
  emptyResolvedModelLayers,
  layer,
  RuntimeResolution as RuntimeResolutionClass,
  type RuntimeResolver,
  RuntimeResolverApi
} from "./services.js"

const defaultTestingUsage = () =>
  new Response.Usage({
    inputTokens: undefined,
    outputTokens: undefined,
    totalTokens: undefined,
    reasoningTokens: undefined,
    cachedInputTokens: undefined
  })

const fromOptional = <A>(option: Option.Option<A>, field: (value: A) => Record<string, A>) =>
  option.pipe(
    Option.match({
      onNone: () => ({}),
      onSome: field
    })
  )

/**
 * Deterministic desired-runtime descriptor helpers for tests and examples.
 *
 * @since 0.1.0
 * @category constructors
 */
export const DesiredRuntimeDescriptor = {
  fromTesting: (options?: {
    readonly modelRef?: string
    readonly route?: ExecutionRoute
    readonly capabilities?: RuntimeCapabilities
    readonly role?: DesiredRuntimeDescriptorModel["role"]
    readonly tags?: DesiredRuntimeDescriptorModel["tags"]
  }): DesiredRuntimeDescriptorModel =>
    DesiredRuntimeDescriptorContract.make({
      artifact: {
        modelRef: options?.modelRef ?? "testing/model"
      },
      ...fromOptional(Option.fromNullable(options?.route), (route) => ({ route })),
      ...fromOptional(Option.fromNullable(options?.capabilities), (capabilities) => ({ capabilities })),
      ...fromOptional(Option.fromNullable(options?.role), (role) => ({ role })),
      ...fromOptional(Option.fromNullable(options?.tags), (tags) => ({ tags }))
    })
}

/**
 * Deterministic resolved-route descriptor helpers for tests and examples.
 *
 * @since 0.1.0
 * @category constructors
 */
export const ResolvedRouteDescriptor = {
  fromTesting: (options?: {
    readonly desired?: DesiredRuntimeDescriptorModel
    readonly route?: ExecutionRoute
    readonly selectedProvider?: string
    readonly selectedDeployment?: string
    readonly providerModel?: string
    readonly runtimeFlavor?: ResolvedRouteDescriptorModel["runtimeFlavor"]
    readonly selectionReason?: string
    readonly schemaVersion?: ResolvedRouteDescriptorModel["schemaVersion"]
  }): ResolvedRouteDescriptorModel => {
    const desired = options?.desired ?? DesiredRuntimeDescriptor.fromTesting()
    const route = options?.route ?? desired.route ?? {
      family: defaultRouteFamily(),
      serveMode: "local-runtime",
      authMethod: "none",
      baseUrl: "in-memory://runtime",
      runtimeFlavorHint: defaultRuntimeFlavor()
    }

    return ResolvedRouteDescriptorContract.make({
      route,
      ...fromOptional(Option.fromNullable(options?.selectedProvider), (selectedProvider) => ({ selectedProvider })),
      ...fromOptional(
        Option.fromNullable(options?.selectedDeployment),
        (selectedDeployment) => ({ selectedDeployment })
      ),
      ...fromOptional(
        Option.fromNullable(options?.providerModel ?? desired.artifact.modelRef),
        (providerModel) => ({ providerModel })
      ),
      ...fromOptional(
        Option.fromNullable(options?.runtimeFlavor ?? route.runtimeFlavorHint),
        (runtimeFlavor) => ({ runtimeFlavor })
      ),
      selectionReason: options?.selectionReason ?? testingSelectionReason,
      schemaVersion: options?.schemaVersion ?? ResolvedRouteProvenanceVersion
    })
  }
}

/**
 * Deterministic runtime-resolution helpers for tests and examples.
 *
 * @since 0.1.0
 * @category constructors
 */
export const RuntimeResolution = {
  fromTesting: (options: {
    readonly desired: DesiredRuntimeDescriptorModel
    readonly resolvedRoute?: ResolvedRouteDescriptorModel
    readonly capabilities?: RuntimeCapabilities
  }): RuntimeResolutionClass => {
    const resolvedRoute = options.resolvedRoute ?? ResolvedRouteDescriptor.fromTesting({ desired: options.desired })

    return new RuntimeResolutionClass({
      desired: options.desired,
      resolvedRoute,
      capabilities: options.capabilities ?? defaultRuntimeCapabilities({ route: resolvedRoute.route }),
      layers: emptyResolvedModelLayers()
    })
  }
}

/**
 * Deterministic post-execution runtime descriptor helpers for tests.
 *
 * @since 0.1.0
 * @category constructors
 */
export const ResolvedRuntimeDescriptor = {
  fromTesting: (options?: {
    readonly responseModel?: string
    readonly responseId?: string
    readonly startedAtMs?: number
    readonly completedAtMs?: number
    readonly finishReason?: ResolvedRuntimeDescriptorModel["finishReason"]
    readonly systemFingerprint?: string
    readonly usage?: ResolvedRuntimeDescriptorModel["usage"]
    readonly providerMetadata?: ResolvedRuntimeDescriptorModel["providerMetadata"]
  }): ResolvedRuntimeDescriptorModel =>
    ResolvedRuntimeDescriptorContract.make({
      responseModel: options?.responseModel ?? "testing/model",
      ...fromOptional(Option.fromNullable(options?.responseId), (responseId) => ({ responseId })),
      ...fromOptional(Option.fromNullable(options?.startedAtMs), (startedAtMs) => ({ startedAtMs })),
      ...fromOptional(Option.fromNullable(options?.completedAtMs), (completedAtMs) => ({ completedAtMs })),
      ...fromOptional(Option.fromNullable(options?.finishReason), (finishReason) => ({ finishReason })),
      ...fromOptional(Option.fromNullable(options?.systemFingerprint), (systemFingerprint) => ({ systemFingerprint })),
      ...fromOptional(Option.fromNullable(options?.usage), (usage) => ({ usage })),
      ...fromOptional(Option.fromNullable(options?.providerMetadata), (providerMetadata) => ({ providerMetadata }))
    })
}

/**
 * Deterministic runtime-evidence helpers for tests and examples.
 *
 * @since 0.1.0
 * @category constructors
 */
export const RuntimeEvidence = {
  fromTesting: (options: {
    readonly desired: DesiredRuntimeDescriptorModel
    readonly resolvedRoute?: ResolvedRouteDescriptorModel
    readonly capabilities?: RuntimeCapabilities
    readonly resolvedRuntime?: ResolvedRuntimeDescriptorModel
  }) =>
    RuntimeEvidenceRuntime.fromResolution({
      resolution: RuntimeResolution.fromTesting({
        desired: options.desired,
        ...fromOptional(Option.fromNullable(options.resolvedRoute), (resolvedRoute) => ({ resolvedRoute })),
        ...fromOptional(Option.fromNullable(options.capabilities), (capabilities) => ({ capabilities }))
      }),
      resolvedRuntime: options.resolvedRuntime ?? ResolvedRuntimeDescriptor.fromTesting()
    })
}

/**
 * Layer that always resolves to the provided static runtime-resolution record.
 *
 * @since 0.1.0
 * @category layers
 */
export const staticRuntimeResolver = (
  resolution: RuntimeResolutionClass
): Layer.Layer<RuntimeResolver> =>
  layer(
    new RuntimeResolverApi({
      resolve: () => Effect.succeed(resolution)
    })
  )

/**
 * Returns an empty optional layer set for tests that only care about runtime
 * evidence and not live model execution.
 *
 * @since 0.1.0
 * @category constructors
 */
export const emptyTestingLayers = () => emptyResolvedModelLayers()

/**
 * Deterministic language-model layer for downstream contract tests that should
 * not depend on provider adapters.
 *
 * @since 0.1.0
 * @category layers
 */
export const staticLanguageModel = (value = "testing-response") =>
  Layer.effect(
    LanguageModel.LanguageModel,
    LanguageModel.make({
      generateText: () =>
        Effect.succeed([
          Response.textPart({ text: value, metadata: {} }),
          Response.finishPart({
            reason: "stop",
            usage: defaultTestingUsage(),
            metadata: {}
          })
        ]),
      streamText: () => Stream.empty
    })
  )

/**
 * Deterministic embedding-model layer for downstream contract tests that only
 * need stable vectors.
 *
 * @since 0.1.0
 * @category layers
 */
export const staticEmbeddingModel = (embedding: ReadonlyArray<number> = [0.1, 0.2, 0.3]) =>
  Layer.effect(
    EmbeddingModel.EmbeddingModel,
    EmbeddingModel.make({
      embedMany: (input) =>
        Effect.succeed(
          input.map((_, index) => ({
            index,
            embeddings: [...embedding]
          }))
        )
    })
  )
