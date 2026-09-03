/**
 * Defines scalar-lane capability metadata and selection policy for computation planning.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Context, Effect, Layer, Match, Option, Schema } from "effect"

import { ScalarLaneUnsupportedError } from "./AdvancedComputationErrors.js"

/**
 * Accepts the scalar-lane labels understood by the dispatch planner.
 *
 * @remarks
 * These labels do not supply Float64 or BigDecimal kernels.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ScalarKind = Schema.Literal("float64", "bigdecimal")

/**
 * A decoded scalar-lane label used in dispatch metadata.
 *
 * @since 0.1.0
 * @category models
 */
export type ScalarKindType = typeof ScalarKind.Type

/**
 * Accepts the operation families that scalar capabilities may declare.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ScalarOperationCategory = Schema.Literal("numeric", "linear-algebra", "calculus", "optimization")

/**
 * An operation family used to select scalar capabilities.
 *
 * @since 0.1.0
 * @category models
 */
export type ScalarOperationCategoryType = typeof ScalarOperationCategory.Type

/**
 * Describes a lane's operation families and arithmetic claims.
 *
 * @remarks
 * Resolution consults `kind` and `supportedCategories`. It does not verify or
 * act on `deterministic` or `supportsExactArithmetic`.
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
 * Decoded capability metadata for one scalar lane.
 *
 * @since 0.1.0
 * @category models
 */
export type ScalarCapabilityType = typeof ScalarCapability.Type

/**
 * Sets the primary scalar lane and ordered fallback candidates.
 *
 * @remarks
 * The Schema requires at least one fallback entry but permits duplicates and
 * permits the primary lane to be absent from `fallbackOrder`.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ScalarAuthorityPolicy = Schema.Struct({
  primaryKind: ScalarKind,
  fallbackOrder: Schema.NonEmptyArray(ScalarKind)
})

/**
 * Decoded scalar selection policy.
 *
 * @since 0.1.0
 * @category models
 */
export type ScalarAuthorityPolicyType = typeof ScalarAuthorityPolicy.Type

/**
 * Accepts the provenance labels returned by scalar selection.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ScalarResolutionSource = Schema.Literal("requested", "policy-primary", "policy-fallback")

/**
 * The policy branch that selected a scalar lane.
 *
 * @since 0.1.0
 * @category models
 */
export type ScalarResolutionSourceType = typeof ScalarResolutionSource.Type

/**
 * Describes a selected scalar lane and its policy provenance.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ScalarResolution = Schema.Struct({
  kind: ScalarKind,
  source: ScalarResolutionSource
})

/**
 * A decoded scalar selection result.
 *
 * @since 0.1.0
 * @category models
 */
export type ScalarResolutionType = typeof ScalarResolution.Type

/**
 * Combines scalar selection policy with a non-empty capability table.
 *
 * @remarks
 * The Schema does not require unique capability kinds or verify that policy
 * lanes appear in the capability table.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ScalarAuthorityState = Schema.Struct({
  policy: ScalarAuthorityPolicy,
  capabilities: Schema.NonEmptyArray(ScalarCapability)
})

/**
 * Decoded state consumed by scalar selection.
 *
 * @since 0.1.0
 * @category models
 */
export type ScalarAuthorityStateType = typeof ScalarAuthorityState.Type

/**
 * Supplies scalar policy and capabilities to computation planning.
 *
 * @since 0.1.0
 * @category contracts
 */
export class ScalarAuthorityService extends Context.Tag("effect-math/contracts/shared/ScalarAuthorityService")<
  ScalarAuthorityService,
  ScalarAuthorityStateType
>() {}

/**
 * Selects Float64 first and BigDecimal second for every declared operation family.
 *
 * @remarks
 * The capability flags describe intended arithmetic properties. This state
 * does not install kernels for either lane.
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
 * Supplies {@link DefaultScalarAuthority} as {@link ScalarAuthorityService}.
 *
 * @remarks
 * The Layer acquires no resources and cannot fail.
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
 * Selects the first declared scalar lane that supports an operation family.
 *
 * @remarks
 * An explicit `requestedKind` precedes policy candidates. Setting
 * `enforceRequestedKind` to `true` restricts selection to that explicit lane.
 * Candidate kinds are deduplicated by their first occurrence. Resolution
 * ignores the deterministic and exact-arithmetic capability flags.
 *
 * @param request - Operation identity, operation family, and optional caller preference.
 * @returns The selected lane and the policy branch that selected it.
 * @throws {@link ScalarLaneUnsupportedError} in the Effect error channel when no candidate capability includes the operation family.
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
