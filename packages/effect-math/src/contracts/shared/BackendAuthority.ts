/**
 * Backend authority contracts for deterministic execution dispatch.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Context, Effect, Layer, Option, Schema } from "effect"

import { BackendUnavailableError } from "./AdvancedComputationErrors.js"
import { ScalarKind, type ScalarKindType } from "./ScalarAuthority.js"

/**
 * Compute backend kinds participating in contract dispatch.
 *
 * @since 0.1.0
 * @category contracts
 */
export const BackendKind = Schema.Literal("scalar", "typed-array", "accelerated")

/**
 * Backend kind type.
 *
 * @since 0.1.0
 * @category models
 */
export type BackendKindType = typeof BackendKind.Type

/**
 * Backend capability contract.
 *
 * @since 0.1.0
 * @category contracts
 */
export const BackendCapability = Schema.Struct({
  kind: BackendKind,
  available: Schema.Boolean,
  supportedScalarKinds: Schema.NonEmptyArray(ScalarKind)
})

/**
 * Backend capability type.
 *
 * @since 0.1.0
 * @category models
 */
export type BackendCapabilityType = typeof BackendCapability.Type

/**
 * Backend selection policy contract.
 *
 * @since 0.1.0
 * @category contracts
 */
export const BackendSelectionPolicy = Schema.Struct({
  preferredOrder: Schema.NonEmptyArray(BackendKind)
})

/**
 * Backend selection policy type.
 *
 * @since 0.1.0
 * @category models
 */
export type BackendSelectionPolicyType = typeof BackendSelectionPolicy.Type

/**
 * Backend authority state.
 *
 * @since 0.1.0
 * @category contracts
 */
export const BackendAuthorityState = Schema.Struct({
  policy: BackendSelectionPolicy,
  capabilities: Schema.NonEmptyArray(BackendCapability)
})

/**
 * Backend authority state type.
 *
 * @since 0.1.0
 * @category models
 */
export type BackendAuthorityStateType = typeof BackendAuthorityState.Type

/**
 * Backend authority service seam.
 *
 * @since 0.1.0
 * @category contracts
 */
export class BackendAuthorityService extends Context.Tag("effect-math/contracts/shared/BackendAuthorityService")<
  BackendAuthorityService,
  BackendAuthorityStateType
>() {}

/**
 * Baseline backend authority for RED-first execution.
 *
 * @since 0.1.0
 * @category contracts
 */
export const DefaultBackendAuthority: BackendAuthorityStateType = {
  policy: {
    preferredOrder: ["scalar", "typed-array", "accelerated"]
  },
  capabilities: [{
    kind: "accelerated",
    available: false,
    supportedScalarKinds: ["float64"]
  }, {
    kind: "typed-array",
    available: true,
    supportedScalarKinds: ["float64"]
  }, {
    kind: "scalar",
    available: true,
    supportedScalarKinds: ["float64", "bigdecimal"]
  }]
}

/**
 * Live backend authority layer.
 *
 * @since 0.1.0
 * @category contracts
 */
export const BackendAuthorityLive = Layer.succeed(BackendAuthorityService, DefaultBackendAuthority)

/**
 * Resolves backend kind from authority capabilities and deterministic fallback.
 *
 * @since 0.1.0
 * @category contracts
 */
export const resolveBackendKind = (request: {
  readonly operation: string
  readonly scalarKind: ScalarKindType
  readonly preferredBackend?: BackendKindType
}) =>
  Effect.gen(function*() {
    const authority = yield* BackendAuthorityService

    const orderedKinds = Option.match(Option.fromNullable(request.preferredBackend), {
      onNone: () => authority.policy.preferredOrder,
      onSome: (preferredBackend) => {
        const preferredIndex = authority.policy.preferredOrder.findIndex((kind) => kind === preferredBackend)

        return preferredIndex < 0
          ? [preferredBackend, ...authority.policy.preferredOrder]
          : authority.policy.preferredOrder.slice(0, preferredIndex + 1).reverse()
      }
    })

    const backendSupportsScalarKind = (kind: BackendKindType) =>
      Option.match(Option.fromNullable(authority.capabilities.find((candidate) => candidate.kind === kind)), {
        onNone: () => false,
        onSome: (capability) => capability.available && capability.supportedScalarKinds.includes(request.scalarKind)
      })

    const resolved = Option.fromNullable(orderedKinds.find((kind) => backendSupportsScalarKind(kind)))

    const availableBackends = authority.capabilities
      .filter((candidate) => candidate.available)
      .map((candidate) => candidate.kind)

    return yield* Option.match(resolved, {
      onNone: () =>
        Effect.fail(
          new BackendUnavailableError({
            operation: request.operation,
            requestedBackend: request.preferredBackend ?? "policy-default",
            availableBackends,
            message: `No backend can satisfy scalar lane ${request.scalarKind}`
          })
        ),
      onSome: (kind) => Effect.succeed(kind)
    })
  })
