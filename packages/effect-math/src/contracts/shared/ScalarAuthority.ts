/**
 * Scalar authority contracts for advanced computation dispatch.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Context, Effect, Layer, Option, Schema } from "effect"

import { ScalarLaneUnsupportedError } from "./AdvancedComputationErrors.js"

/**
 * Supported scalar lanes in the native computation contract.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ScalarKind = Schema.Literal("float64", "bigdecimal")

/**
 * Scalar lane type.
 *
 * @since 0.1.0
 * @category models
 */
export type ScalarKindType = typeof ScalarKind.Type

/**
 * Operation families participating in scalar authority dispatch.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ScalarOperationCategory = Schema.Literal("numeric", "linear-algebra", "calculus", "optimization")

/**
 * Scalar operation category type.
 *
 * @since 0.1.0
 * @category models
 */
export type ScalarOperationCategoryType = typeof ScalarOperationCategory.Type

/**
 * Scalar capability declaration for a lane.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ScalarCapability = Schema.Struct({
  kind: ScalarKind,
  supportedCategories: Schema.NonEmptyArray(ScalarOperationCategory),
  deterministic: Schema.Boolean,
  supportsExactArithmetic: Schema.Boolean
})

/**
 * Scalar capability type.
 *
 * @since 0.1.0
 * @category models
 */
export type ScalarCapabilityType = typeof ScalarCapability.Type

/**
 * Scalar dispatch policy with explicit fallback order.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ScalarAuthorityPolicy = Schema.Struct({
  primaryKind: ScalarKind,
  fallbackOrder: Schema.NonEmptyArray(ScalarKind)
})

/**
 * Scalar dispatch policy type.
 *
 * @since 0.1.0
 * @category models
 */
export type ScalarAuthorityPolicyType = typeof ScalarAuthorityPolicy.Type

/**
 * Scalar authority state.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ScalarAuthorityState = Schema.Struct({
  policy: ScalarAuthorityPolicy,
  capabilities: Schema.NonEmptyArray(ScalarCapability)
})

/**
 * Scalar authority state type.
 *
 * @since 0.1.0
 * @category models
 */
export type ScalarAuthorityStateType = typeof ScalarAuthorityState.Type

/**
 * Scalar authority service seam.
 *
 * @since 0.1.0
 * @category contracts
 */
export class ScalarAuthorityService extends Context.Tag("effect-math/contracts/shared/ScalarAuthorityService")<
  ScalarAuthorityService,
  ScalarAuthorityStateType
>() {}

/**
 * Current baseline scalar authority used during RED-first execution.
 *
 * @since 0.1.0
 * @category contracts
 */
export const DefaultScalarAuthority: ScalarAuthorityStateType = {
  policy: {
    primaryKind: "float64",
    fallbackOrder: ["float64", "bigdecimal"]
  },
  capabilities: [{
    kind: "float64",
    supportedCategories: ["numeric", "linear-algebra", "calculus", "optimization"],
    deterministic: true,
    supportsExactArithmetic: false
  }, {
    kind: "bigdecimal",
    supportedCategories: ["numeric", "linear-algebra", "calculus", "optimization"],
    deterministic: true,
    supportsExactArithmetic: true
  }]
}

/**
 * Live scalar authority layer.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ScalarAuthorityLive = Layer.succeed(ScalarAuthorityService, DefaultScalarAuthority)

/**
 * Resolves scalar lane for an operation category.
 *
 * @since 0.1.0
 * @category contracts
 */
export const resolveScalarKind = (request: {
  readonly operation: string
  readonly operationCategory: ScalarOperationCategoryType
  readonly requestedKind: ScalarKindType
}) =>
  Effect.gen(function*() {
    const authority = yield* ScalarAuthorityService
    const availableKinds = authority.capabilities.map((capability) => capability.kind)

    const resolved = Option.fromNullable(authority.capabilities.find((capability) =>
      capability.kind === request.requestedKind && capability.supportedCategories.includes(request.operationCategory)
    ))

    return yield* Option.match(resolved, {
      onNone: () =>
        Effect.fail(
          new ScalarLaneUnsupportedError({
            operation: request.operation,
            requestedKind: request.requestedKind,
            availableKinds,
            message: `Scalar lane ${request.requestedKind} is unavailable for ${request.operationCategory}`
          })
        ),
      onSome: (capability) =>
        Effect.succeed(capability.kind)
    })
  })
