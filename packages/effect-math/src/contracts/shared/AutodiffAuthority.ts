/**
 * Autodiff authority contracts for advanced differential routing.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Context, Effect, Layer, Match, Option, Schema } from "effect"

import { AutodiffUnavailableError } from "./AdvancedComputationErrors.js"

/**
 * Restricts differentiation routing to forward or reverse accumulation.
 *
 * @since 0.1.0
 * @category contracts
 */
export const AutodiffMode = Schema.Literal("forward", "reverse")

/**
 * A caller-selectable forward- or reverse-mode differentiation lane.
 *
 * @since 0.1.0
 * @category models
 */
export type AutodiffModeType = typeof AutodiffMode.Type

/**
 * Associates one differentiation mode with its runtime availability.
 *
 * @since 0.1.0
 * @category contracts
 */
export const AutodiffCapability = Schema.Struct({
  mode: AutodiffMode,
  available: Schema.Boolean,
  maxInputDimension: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)))
})

/**
 * A mode and the availability flag consulted during differentiation routing.
 *
 * @since 0.1.0
 * @category models
 */
export type AutodiffCapabilityType = typeof AutodiffCapability.Type

/**
 * Resolved differentiation method.
 *
 * @since 0.1.0
 * @category contracts
 */
export const AutodiffResolutionMethod = Schema.Literal("autodiff", "finite-difference")

/**
 * Whether routing selected native autodiff or finite differences.
 *
 * @since 0.1.0
 * @category models
 */
export type AutodiffResolutionMethodType = typeof AutodiffResolutionMethod.Type

const AUTODIFF_METHOD: AutodiffResolutionMethodType = "autodiff"
const FINITE_DIFFERENCE_METHOD: AutodiffResolutionMethodType = "finite-difference"

const dedupeModes = (modes: ReadonlyArray<AutodiffModeType>): ReadonlyArray<AutodiffModeType> =>
  modes.filter((mode, index, all) => all.findIndex((candidate) => candidate === mode) === index)

/**
 * Records the selected method, its mode when native autodiff won, and whether
 * finite differences were used as the configured fallback.
 *
 * @since 0.1.0
 * @category contracts
 */
export const AutodiffResolution = Schema.Struct({
  method: AutodiffResolutionMethod,
  mode: Schema.optional(AutodiffMode),
  usedFiniteDifferenceFallback: Schema.Boolean
})

/**
 * The selected differentiation method and fallback provenance returned to dispatch.
 *
 * @since 0.1.0
 * @category models
 */
export type AutodiffResolutionType = typeof AutodiffResolution.Type

/**
 * Orders candidate modes and controls whether their joint unavailability may
 * degrade to finite differences.
 *
 * @since 0.1.0
 * @category contracts
 */
export const AutodiffSelectionPolicy = Schema.Struct({
  preferredOrder: Schema.NonEmptyArray(AutodiffMode),
  allowFiniteDifferenceFallback: Schema.Boolean
})

/**
 * Preferred mode order plus the finite-difference fallback boundary.
 *
 * @since 0.1.0
 * @category models
 */
export type AutodiffSelectionPolicyType = typeof AutodiffSelectionPolicy.Type

/**
 * Combines routing policy with the non-empty mode availability table consulted
 * by {@link resolveAutodiffMode}.
 *
 * @since 0.1.0
 * @category contracts
 */
export const AutodiffAuthorityState = Schema.Struct({
  policy: AutodiffSelectionPolicy,
  capabilities: Schema.NonEmptyArray(AutodiffCapability)
})

/**
 * The policy and capability snapshot supplied through {@link AutodiffAuthorityService}.
 *
 * @since 0.1.0
 * @category models
 */
export type AutodiffAuthorityStateType = typeof AutodiffAuthorityState.Type

/**
 * Autodiff authority service seam.
 *
 * @since 0.1.0
 * @category contracts
 */
export class AutodiffAuthorityService extends Context.Tag("effect-math/contracts/shared/AutodiffAuthorityService")<
  AutodiffAuthorityService,
  AutodiffAuthorityStateType
>() {}

/**
 * Default state preferring reverse mode, with finite-difference fallback.
 *
 * @since 0.1.0
 * @category contracts
 */
export const DefaultAutodiffAuthority: AutodiffAuthorityStateType = {
  policy: {
    preferredOrder: ["reverse", "forward"],
    allowFiniteDifferenceFallback: true
  },
  capabilities: [{
    mode: "reverse",
    available: true
  }, {
    mode: "forward",
    available: true
  }]
}

/**
 * Ready-to-use layer for the exported default autodiff capabilities and order.
 *
 * @since 0.1.0
 * @category contracts
 */
export const AutodiffAuthorityLive = Layer.succeed(AutodiffAuthorityService, DefaultAutodiffAuthority)

/**
 * Resolves autodiff mode from authority capabilities and policy.
 *
 * @remarks
 * **Details**
 * Caller preference is evaluated first, then policy order.
 * When no lane is available, `allowFiniteDifferenceFallback` decides whether
 * dispatch degrades to finite-difference or fails with a typed contract error.
 *
 * @since 0.1.0
 * @category contracts
 */
export const resolveAutodiffMode = (request: {
  readonly operation: string
  readonly preferredMode?: AutodiffModeType
}) =>
  Effect.gen(function*() {
    const authority = yield* AutodiffAuthorityService

    const orderedModes = dedupeModes(
      Option.match(Option.fromNullable(request.preferredMode), {
        onNone: () => authority.policy.preferredOrder,
        onSome: (preferredMode) => [preferredMode, ...authority.policy.preferredOrder]
      })
    )

    const resolved = Option.fromNullable(orderedModes.find((mode) =>
      authority.capabilities.some((candidate) => candidate.mode === mode && candidate.available)
    ))

    const availableModes = authority.capabilities
      .filter((candidate) =>
        candidate.available
      )
      .map((candidate) => candidate.mode)

    return yield* Option.match(resolved, {
      onNone: () =>
        Match.value(authority.policy.allowFiniteDifferenceFallback).pipe(
          Match.when(true, () =>
            Effect.succeed<AutodiffResolutionType>({
              method: FINITE_DIFFERENCE_METHOD,
              mode: undefined,
              usedFiniteDifferenceFallback: true
            })),
          Match.when(false, () =>
            Effect.fail(
              new AutodiffUnavailableError({
                operation: request.operation,
                requestedMode: request.preferredMode ?? "policy-default",
                availableModes,
                message: "No autodiff mode is currently available"
              })
            )),
          Match.exhaustive
        ),
      onSome: (mode) =>
        Effect.succeed<AutodiffResolutionType>({
          method: AUTODIFF_METHOD,
          mode,
          usedFiniteDifferenceFallback: false
        })
    })
  })
