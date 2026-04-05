/**
 * Testing helpers for deterministic runtime resolution.
 *
 * @since 0.1.0
 */
import * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Response from "@effect/ai/Response"
import { Effect, Layer, Option, Stream } from "effect"

import type { DesiredRuntimeDescriptor } from "../contracts/DesiredRuntimeDescriptor.js"
import type { ExecutionRoute } from "../contracts/ExecutionRoute.js"
import { type ResolvedRouteDescriptor, ResolvedRouteProvenanceVersion } from "../contracts/ResolvedRouteDescriptor.js"
import type { ResolvedRuntimeDescriptor } from "../contracts/ResolvedRuntimeDescriptor.js"
import { defaultRouteFamily } from "../contracts/RouteFamily.js"
import type { RuntimeCapabilities } from "../contracts/RuntimeCapabilities.js"
import { defaultRuntimeFlavor } from "../contracts/RuntimeFlavor.js"
import { defaultRuntimeCapabilities } from "../internal/defaultCapabilities.js"
import { testingSelectionReason } from "../internal/resolvedRoute.js"
import { makeRuntimeEvidence } from "./evidence.js"
import {
  emptyResolvedModelLayers,
  layer,
  RuntimeResolution,
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

/**
 * Constructs a deterministic requested-runtime fixture with one package-owned
 * source of truth for tests and examples.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeDesiredRuntimeDescriptor = (options?: {
  readonly modelRef?: string
  readonly route?: ExecutionRoute
  readonly capabilities?: RuntimeCapabilities
}): DesiredRuntimeDescriptor => ({
  artifact: {
    modelRef: options?.modelRef ?? "testing/model"
  },
  ...Option.fromNullable(options?.route).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (route) => ({ route })
    })
  ),
  ...Option.fromNullable(options?.capabilities).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (capabilities) => ({ capabilities })
    })
  )
})

/**
 * Constructs deterministic route-provenance fixtures without requiring a live
 * resolver.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeResolvedRouteDescriptor = (options?: {
  readonly desired?: DesiredRuntimeDescriptor
  readonly route?: ExecutionRoute
  readonly selectedProvider?: string
  readonly selectedDeployment?: string
  readonly providerModel?: string
  readonly runtimeFlavor?: ResolvedRouteDescriptor["runtimeFlavor"]
  readonly selectionReason?: string
  readonly schemaVersion?: ResolvedRouteDescriptor["schemaVersion"]
}): ResolvedRouteDescriptor => {
  const desired = options?.desired ?? makeDesiredRuntimeDescriptor()
  const route = options?.route ?? desired.route ?? {
    family: defaultRouteFamily(),
    serveMode: "local-runtime",
    authMethod: "none",
    baseUrl: "in-memory://runtime",
    runtimeFlavorHint: defaultRuntimeFlavor()
  }

  return {
    route,
    ...Option.fromNullable(options?.selectedProvider).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (selectedProvider) => ({ selectedProvider })
      })
    ),
    ...Option.fromNullable(options?.selectedDeployment).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (selectedDeployment) => ({ selectedDeployment })
      })
    ),
    ...Option.fromNullable(options?.providerModel ?? desired.artifact.modelRef).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (providerModel) => ({ providerModel })
      })
    ),
    ...Option.fromNullable(options?.runtimeFlavor ?? route.runtimeFlavorHint).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (runtimeFlavor) => ({ runtimeFlavor })
      })
    ),
    selectionReason: options?.selectionReason ?? testingSelectionReason,
    schemaVersion: options?.schemaVersion ?? ResolvedRouteProvenanceVersion
  }
}

/**
 * Construct a deterministic runtime-resolution record for tests and examples.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeRuntimeResolution = (options: {
  readonly desired: DesiredRuntimeDescriptor
  readonly resolvedRoute?: ResolvedRouteDescriptor
  readonly capabilities?: RuntimeCapabilities
}): RuntimeResolution => {
  const resolvedRoute = options.resolvedRoute ?? makeResolvedRouteDescriptor({ desired: options.desired })

  return new RuntimeResolution({
    desired: options.desired,
    resolvedRoute,
    capabilities: options.capabilities ?? defaultRuntimeCapabilities({ route: resolvedRoute.route }),
    layers: emptyResolvedModelLayers()
  })
}

/**
 * Constructs deterministic post-execution runtime truth for tests that need
 * replay-safe evidence without a live provider call.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeResolvedRuntimeDescriptor = (options?: {
  readonly responseModel?: string
  readonly responseId?: string
  readonly startedAtMs?: number
  readonly completedAtMs?: number
  readonly finishReason?: ResolvedRuntimeDescriptor["finishReason"]
  readonly systemFingerprint?: string
  readonly usage?: ResolvedRuntimeDescriptor["usage"]
  readonly providerMetadata?: ResolvedRuntimeDescriptor["providerMetadata"]
}): ResolvedRuntimeDescriptor => {
  const responseId = Option.fromNullable(options?.responseId).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (value) => ({ responseId: value })
    })
  )
  const startedAtMs = Option.fromNullable(options?.startedAtMs).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (value) => ({ startedAtMs: value })
    })
  )
  const completedAtMs = Option.fromNullable(options?.completedAtMs).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (value) => ({ completedAtMs: value })
    })
  )
  const finishReason = Option.fromNullable(options?.finishReason).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (value) => ({ finishReason: value })
    })
  )
  const systemFingerprint = Option.fromNullable(options?.systemFingerprint).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (value) => ({ systemFingerprint: value })
    })
  )
  const usage = Option.fromNullable(options?.usage).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (value) => ({ usage: value })
    })
  )
  const providerMetadata = Option.fromNullable(options?.providerMetadata).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (value) => ({ providerMetadata: value })
    })
  )

  return {
    responseModel: options?.responseModel ?? "testing/model",
    ...responseId,
    ...startedAtMs,
    ...completedAtMs,
    ...finishReason,
    ...systemFingerprint,
    ...usage,
    ...providerMetadata
  }
}

/**
 * Constructs deterministic runtime evidence from package-owned requested,
 * resolved-route, and resolved-runtime fixtures.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeRuntimeEvidenceFixture = (options: {
  readonly desired: DesiredRuntimeDescriptor
  readonly resolvedRoute?: ResolvedRouteDescriptor
  readonly capabilities?: RuntimeCapabilities
  readonly resolvedRuntime?: ResolvedRuntimeDescriptor
}) =>
  makeRuntimeEvidence({
    resolution: makeRuntimeResolution({
      desired: options.desired,
      ...Option.fromNullable(options.resolvedRoute).pipe(
        Option.match({
          onNone: () => ({}),
          onSome: (value) => ({ resolvedRoute: value })
        })
      ),
      ...Option.fromNullable(options.capabilities).pipe(
        Option.match({
          onNone: () => ({}),
          onSome: (value) => ({ capabilities: value })
        })
      )
    }),
    resolvedRuntime: options.resolvedRuntime ?? makeResolvedRuntimeDescriptor()
  })

/**
 * Layer that always resolves to the provided static runtime-resolution record.
 *
 * @since 0.1.0
 * @category layers
 */
export const staticRuntimeResolver = (
  resolution: RuntimeResolution
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
