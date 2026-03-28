/**
 * Scalar authority contracts for advanced computation dispatch.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Context, Effect, Layer, Match, Option, Schema } from "effect"

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
 * Scalar dispatch policy with explicit primary and fallback order.
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
 * Source for scalar lane resolution decisions.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ScalarResolutionSource = Schema.Literal("requested", "policy-primary", "policy-fallback")

/**
 * Source for scalar lane resolution decisions.
 *
 * @since 0.1.0
 * @category models
 */
export type ScalarResolutionSourceType = typeof ScalarResolutionSource.Type

/**
 * Scalar resolution result contract.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ScalarResolution = Schema.Struct({
  kind: ScalarKind,
  source: ScalarResolutionSource
})

/**
 * Scalar resolution result type.
 *
 * @since 0.1.0
 * @category models
 */
export type ScalarResolutionType = typeof ScalarResolution.Type

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

type ScalarCandidate = ScalarResolutionType

const EMPTY_CANDIDATES: ReadonlyArray<ScalarCandidate> = []
const REQUESTED_SOURCE: ScalarResolutionSourceType = "requested"
const POLICY_PRIMARY_SOURCE: ScalarResolutionSourceType = "policy-primary"
const POLICY_FALLBACK_SOURCE: ScalarResolutionSourceType = "policy-fallback"

const makeRequestedCandidate = (kind: ScalarKindType): ScalarCandidate => ({
  kind,
  source: REQUESTED_SOURCE
})

const sourceFromPolicyKind = (kind: ScalarKindType, primaryKind: ScalarKindType): ScalarResolutionSourceType =>
  Match.value(kind === primaryKind).pipe(
    Match.when(true, () => POLICY_PRIMARY_SOURCE),
    Match.when(false, () => POLICY_FALLBACK_SOURCE),
    Match.exhaustive
  )

const dedupeCandidates = (candidates: ReadonlyArray<ScalarCandidate>): ReadonlyArray<ScalarCandidate> =>
  candidates.filter((candidate, index, all) => all.findIndex((entry) => entry.kind === candidate.kind) === index)

const supportsOperationCategory = (
  capability: ScalarCapabilityType,
  operationCategory: ScalarOperationCategoryType
): boolean => capability.supportedCategories.includes(operationCategory)

/**
 * Resolves scalar lane for an operation category.
 *
 * **Details**
 * Explicit `requestedKind` is attempted first. When
 * `enforceRequestedKind` is `true`, policy fallback is disabled and failures
 * surface as typed authority errors. Successful resolution returns source
 * provenance so dispatch plans can prove which authority selected the lane.
 *
 * @since 0.1.0
 * @category contracts
 */
export const resolveScalarKind = (request: {
  readonly operation: string
  readonly operationCategory: ScalarOperationCategoryType
  readonly requestedKind?: ScalarKindType
  readonly enforceRequestedKind?: boolean
}) =>
  Effect.gen(function*() {
    const authority = yield* ScalarAuthorityService
    const availableKinds = authority.capabilities
      .filter((capability) => supportsOperationCategory(capability, request.operationCategory))
      .map((capability) => capability.kind)

    const requestedCandidates = Option.match(Option.fromNullable(request.requestedKind), {
      onNone: () => EMPTY_CANDIDATES,
      onSome: (requestedKind) => [makeRequestedCandidate(requestedKind)]
    })

    const policyCandidates = dedupeCandidates([
      {
        kind: authority.policy.primaryKind,
        source: POLICY_PRIMARY_SOURCE
      },
      ...authority.policy.fallbackOrder.map((kind) => ({
        kind,
        source: sourceFromPolicyKind(kind, authority.policy.primaryKind)
      }))
    ])

    const hasRequestedKind = Option.isSome(Option.fromNullable(request.requestedKind))

    // `enforceRequestedKind` is used by precision escalation to ensure a
    // policy-selected lane cannot silently fall back again.
    const orderedCandidates = Match.value(request.enforceRequestedKind === true && hasRequestedKind).pipe(
      Match.when(true, () => requestedCandidates),
      Match.when(false, () => dedupeCandidates([...requestedCandidates, ...policyCandidates])),
      Match.exhaustive
    )

    const resolved = Option.fromNullable(orderedCandidates.find((candidate) =>
      authority.capabilities.some((capability) =>
        capability.kind === candidate.kind && supportsOperationCategory(capability, request.operationCategory)
      )
    ))

    const attemptedOrder = orderedCandidates.map((candidate) =>
      candidate.kind
    ).join(" -> ")

    return yield* Option.match(resolved, {
      onNone: () =>
        Effect.fail(
          new ScalarLaneUnsupportedError({
            operation: request.operation,
            requestedKind: request.requestedKind ?? authority.policy.primaryKind,
            availableKinds,
            message: `No scalar lane resolved for ${request.operationCategory}; attempted order: ${attemptedOrder}`
          })
        ),
      onSome: (candidate) =>
        Effect.succeed({
          kind: candidate.kind,
          source: candidate.source
        })
    })
  })
