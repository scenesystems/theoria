/**
 * Defines autodiff capability metadata and fallback selection for computation planning.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Array, Boolean, Context, Effect, Layer, Match, Option, Schema, String } from "effect"

import { AutodiffUnavailableError } from "./AdvancedComputationErrors.js"

/**
 * Accepts forward- and reverse-mode routing labels.
 *
 * @remarks
 * A mode label does not supply an autodiff implementation.
 *
 * @since 0.1.0
 * @category contracts
 */
export const AutodiffMode = Schema.Literal("forward", "reverse")

/**
 * A decoded autodiff mode used in planning metadata.
 *
 * @since 0.1.0
 * @category models
 */
export type AutodiffModeType = typeof AutodiffMode.Type

/**
 * Describes whether a mode may be selected and its optional input-size limit.
 *
 * @remarks
 * {@link resolveAutodiffMode} consults `mode` and `available`; it does not
 * inspect `maxInputDimension` because its request has no input dimension.
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
 * Decoded capability metadata for one autodiff mode.
 *
 * @since 0.1.0
 * @category models
 */
export type AutodiffCapabilityType = typeof AutodiffCapability.Type

/**
 * Accepts planner results for autodiff or finite-difference execution.
 *
 * @since 0.1.0
 * @category contracts
 */
export const AutodiffResolutionMethod = Schema.Literal("autodiff", "finite-difference")

/**
 * The differentiation method selected during planning.
 *
 * @since 0.1.0
 * @category models
 */
export type AutodiffResolutionMethodType = typeof AutodiffResolutionMethod.Type

const AUTODIFF_METHOD: AutodiffResolutionMethodType = "autodiff"
const FINITE_DIFFERENCE_METHOD: AutodiffResolutionMethodType = "finite-difference"

const dedupeModes = Array.dedupeWith(String.Equivalence)

/**
 * Describes the differentiation method and fallback provenance selected by a resolver.
 *
 * @remarks
 * The decoded `mode` is an `Option`; its encoded form omits the field when
 * absent. The Schema does not couple `method`, `mode`, and
 * `usedFiniteDifferenceFallback`. {@link resolveAutodiffMode} establishes the
 * consistent combinations.
 *
 * @since 0.1.0
 * @category contracts
 */
export const AutodiffResolution = Schema.Struct({
  method: AutodiffResolutionMethod,
  mode: Schema.optionalWith(AutodiffMode, { as: "Option" }),
  usedFiniteDifferenceFallback: Schema.Boolean
})

/**
 * A decoded differentiation selection result.
 *
 * @since 0.1.0
 * @category models
 */
export type AutodiffResolutionType = typeof AutodiffResolution.Type

/**
 * Orders candidate modes and controls finite-difference fallback.
 *
 * @since 0.1.0
 * @category contracts
 */
export const AutodiffSelectionPolicy = Schema.Struct({
  preferredOrder: Schema.NonEmptyArray(AutodiffMode),
  allowFiniteDifferenceFallback: Schema.Boolean
})

/**
 * Decoded autodiff selection policy.
 *
 * @since 0.1.0
 * @category models
 */
export type AutodiffSelectionPolicyType = typeof AutodiffSelectionPolicy.Type

/**
 * Combines autodiff selection policy with a non-empty capability table.
 *
 * @remarks
 * The Schema permits duplicate modes and does not require policy modes to
 * appear in the capability table.
 *
 * @since 0.1.0
 * @category contracts
 */
export const AutodiffAuthorityState = Schema.Struct({
  policy: AutodiffSelectionPolicy,
  capabilities: Schema.NonEmptyArray(AutodiffCapability)
})

/**
 * Decoded state consumed by autodiff selection.
 *
 * @since 0.1.0
 * @category models
 */
export type AutodiffAuthorityStateType = typeof AutodiffAuthorityState.Type

/**
 * Accepts an operation identity and an optional preferred autodiff mode.
 *
 * @since 0.1.0
 * @category contracts
 */
export const AutodiffResolutionRequest = Schema.Struct({
  operation: Schema.String,
  preferredMode: Schema.optional(AutodiffMode)
})

/**
 * A decoded autodiff selection request.
 *
 * @since 0.1.0
 * @category models
 */
export type AutodiffResolutionRequestType = typeof AutodiffResolutionRequest.Type

/**
 * Supplies autodiff policy and capabilities to computation planning.
 *
 * @since 0.1.0
 * @category contracts
 */
export class AutodiffAuthorityService extends Context.Tag("effect-math/contracts/shared/AutodiffAuthorityService")<
  AutodiffAuthorityService,
  AutodiffAuthorityStateType
>() {}

/**
 * Prefers reverse mode, then forward mode, and permits finite-difference fallback.
 *
 * @remarks
 * Both autodiff modes are marked available for planning. This value does not
 * install differentiation engines.
 *
 * @since 0.1.0
 * @category contracts
 */
export const DefaultAutodiffAuthority = Schema.decodeUnknownSync(AutodiffAuthorityState)({
  policy: {
    preferredOrder: Array.make("reverse", "forward"),
    allowFiniteDifferenceFallback: true
  },
  capabilities: Array.make(
    {
      mode: "reverse",
      available: true
    },
    {
      mode: "forward",
      available: true
    }
  )
})

/**
 * Supplies {@link DefaultAutodiffAuthority} as {@link AutodiffAuthorityService}.
 *
 * @remarks
 * The Layer acquires no resources and cannot fail.
 *
 * @since 0.1.0
 * @category contracts
 */
export const AutodiffAuthorityLive = Layer.succeed(AutodiffAuthorityService, DefaultAutodiffAuthority)

/**
 * Selects the first available autodiff mode or the configured finite-difference fallback.
 *
 * @remarks
 * A caller preference precedes policy order, and duplicate modes retain their
 * first position. Capability input-dimension limits are not consulted. The
 * result is planning metadata and does not execute differentiation.
 *
 * @param request - Operation identity and optional preferred autodiff mode.
 * @returns The selected mode, or a finite-difference result with no mode.
 * @throws {@link AutodiffUnavailableError} in the Effect error channel when no mode is available and fallback is disabled.
 *
 * @since 0.1.0
 * @category contracts
 */
export const resolveAutodiffMode = (request: AutodiffResolutionRequestType) =>
  Effect.gen(function*() {
    const authority = yield* AutodiffAuthorityService

    const orderedModes = dedupeModes(
      Option.match(Option.fromNullable(request.preferredMode), {
        onNone: () => authority.policy.preferredOrder,
        onSome: (preferredMode) => Array.prepend(authority.policy.preferredOrder, preferredMode)
      })
    )

    const resolved = Array.findFirst(orderedModes, (mode) =>
      Array.some(
        authority.capabilities,
        (candidate) => Boolean.and(String.Equivalence(candidate.mode, mode), candidate.available)
      ))

    const availableModes = Array.map(
      Array.filter(authority.capabilities, (candidate) => candidate.available),
      (candidate) => candidate.mode
    )

    return yield* Option.match(resolved, {
      onNone: () =>
        Match.value(authority.policy.allowFiniteDifferenceFallback).pipe(
          Match.when(true, () =>
            Effect.succeed<AutodiffResolutionType>({
              method: FINITE_DIFFERENCE_METHOD,
              mode: Option.none(),
              usedFiniteDifferenceFallback: true
            })),
          Match.when(false, () =>
            Effect.fail(
              new AutodiffUnavailableError({
                operation: request.operation,
                requestedMode: Option.getOrElse(
                  Option.fromNullable(request.preferredMode),
                  () => "policy-default"
                ),
                availableModes,
                message: "No autodiff mode is currently available"
              })
            )),
          Match.exhaustive
        ),
      onSome: (mode) =>
        Effect.succeed<AutodiffResolutionType>({
          method: AUTODIFF_METHOD,
          mode: Option.some(mode),
          usedFiniteDifferenceFallback: false
        })
    })
  })
