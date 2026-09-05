/**
 * Plans scalar, backend, differentiation, and uncertainty metadata from runtime authorities.
 *
 * @remarks
 * Planning selects labels and provenance. It does not execute a kernel,
 * install an autodiff engine, or construct an uncertainty envelope.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Context, Effect, Layer, Match, Option, Schema } from "effect"

import type {
  AutodiffUnavailableError,
  BackendUnavailableError,
  PrecisionEscalationExhaustedError,
  ScalarLaneUnsupportedError
} from "./AdvancedComputationErrors.js"
import { ComputationDispatchDecodeError } from "./AdvancedComputationErrors.js"
import {
  AutodiffAuthorityLive,
  AutodiffMode,
  AutodiffResolutionMethod,
  resolveAutodiffMode
} from "./AutodiffAuthority.js"
import type { AutodiffAuthorityService, AutodiffModeType } from "./AutodiffAuthority.js"
import { BackendKind, resolveBackendKind } from "./BackendAuthority.js"
import {
  ConvergenceObservation,
  PrecisionEscalationDecisionSource,
  PrecisionEscalationLive,
  resolveEscalatedScalarKind
} from "./PrecisionEscalation.js"
import type { PrecisionEscalationDecisionType, PrecisionEscalationService } from "./PrecisionEscalation.js"
import { BackendPolicyService } from "./RuntimePolicies.js"
import {
  resolveScalarKind,
  ScalarAuthorityLive,
  ScalarKind,
  ScalarOperationCategory,
  ScalarResolutionSource
} from "./ScalarAuthority.js"
import type { ScalarAuthorityService } from "./ScalarAuthority.js"

const ComputationDifferentiationMethod = Schema.Union(Schema.Literal("none"), AutodiffResolutionMethod)
const NO_AUTODIFF_RESOLUTION: {
  readonly method: "none"
  readonly mode: Option.Option<AutodiffModeType>
  readonly usedFiniteDifferenceFallback: false
} = {
  method: "none",
  mode: Option.none(),
  usedFiniteDifferenceFallback: false
}

/**
 * Accepts the operation identity, caller preferences, convergence state, and output requirements used for planning.
 *
 * @remarks
 * `operationName` is diagnostic metadata. `escalationAttempt` is required even
 * when `convergence` is absent. Backend preference affects only failure
 * diagnostics. Autodiff preference is ignored unless `requiresAutodiff` is
 * true. The uncertainty flag is copied to the plan.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ComputationDispatchRequest = Schema.Struct({
  operationCategory: ScalarOperationCategory,
  operationName: Schema.String,
  requestedScalarKind: Schema.optional(ScalarKind),
  preferredBackend: Schema.optional(BackendKind),
  preferredAutodiff: Schema.optional(AutodiffMode),
  escalationAttempt: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  convergence: Schema.optional(ConvergenceObservation),
  requiresAutodiff: Schema.Boolean,
  requiresUncertaintyEnvelope: Schema.Boolean
})

/**
 * A decoded computation-planning request.
 *
 * @since 0.1.0
 * @category models
 */
export type ComputationDispatchRequestType = typeof ComputationDispatchRequest.Type

/**
 * Accepts selected planning lanes and their scalar-escalation provenance.
 *
 * @remarks
 * The Schema validates each field independently. It does not enforce that an
 * autodiff method has a mode, that finite-difference fallback has `None`, or
 * that escalation and convergence flags agree. The exported planner
 * establishes those relationships. The decoded `autodiffMode` is an `Option`;
 * its encoded form omits the field when absent.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ComputationDispatchPlan = Schema.Struct({
  scalarKind: ScalarKind,
  scalarResolutionSource: ScalarResolutionSource,
  precisionEscalationSource: PrecisionEscalationDecisionSource,
  backendKind: BackendKind,
  autodiffMode: Schema.optionalWith(AutodiffMode, { as: "Option" }),
  differentiationMethod: ComputationDifferentiationMethod,
  finiteDifferenceFallback: Schema.Boolean,
  escalated: Schema.Boolean,
  convergenceSatisfied: Schema.Boolean,
  uncertaintyEnvelope: Schema.Boolean
})

/**
 * A decoded computation plan containing selected labels and provenance.
 *
 * @since 0.1.0
 * @category models
 */
export type ComputationDispatchPlanType = typeof ComputationDispatchPlan.Type

/**
 * Typed failures emitted while decoding or planning a computation request.
 *
 * @since 0.1.0
 * @category errors
 */
export type ComputationDispatchError =
  | ScalarLaneUnsupportedError
  | PrecisionEscalationExhaustedError
  | BackendUnavailableError
  | AutodiffUnavailableError
  | ComputationDispatchDecodeError

/**
 * Context services required by the exported authority-based planner.
 *
 * @since 0.1.0
 * @category models
 */
export type ComputationDispatchRequirements =
  | ScalarAuthorityService
  | PrecisionEscalationService
  | BackendPolicyService
  | AutodiffAuthorityService

/**
 * Supplies a computation-plan implementation to callers of {@link planAdvancedComputation}.
 *
 * @remarks
 * A dispatcher receives an already decoded request. Its planning Effect may
 * still require the four authority services represented by
 * {@link ComputationDispatchRequirements}.
 *
 * @since 0.1.0
 * @category contracts
 */
export class ComputationDispatcher extends Context.Tag("effect-math/contracts/shared/ComputationDispatcher")<
  ComputationDispatcher,
  {
    readonly plan: (
      request: ComputationDispatchRequestType
    ) => Effect.Effect<ComputationDispatchPlanType, ComputationDispatchError, ComputationDispatchRequirements>
  }
>() {}

const decodeComputationDispatchRequest = (input: unknown) =>
  Schema.decodeUnknown(ComputationDispatchRequest)(input, {
    onExcessProperty: "error"
  }).pipe(
    Effect.mapError(
      (error) =>
        new ComputationDispatchDecodeError({
          operation: "ComputationDispatchRequest",
          message: error.message
        })
    )
  )

/**
 * Builds a computation plan directly from the configured authority services.
 *
 * @remarks
 * The request is already typed and is not decoded. Scalar selection occurs
 * before optional convergence escalation, then the resulting lane is checked
 * against scalar capabilities again. An absent convergence observation is
 * recorded as satisfied. Backend policy determines backend order. Autodiff
 * resolution runs only when requested. The uncertainty requirement is copied
 * unchanged.
 *
 * @param request - Already decoded planning request.
 * @returns Selected planning labels and decision provenance.
 * @throws {@link ScalarLaneUnsupportedError}, {@link PrecisionEscalationExhaustedError},
 * {@link BackendUnavailableError}, or {@link AutodiffUnavailableError} in the
 * Effect error channel when an authority cannot satisfy the request.
 *
 * @since 0.1.0
 * @category contracts
 */
export const planComputationFromAuthorities = (request: ComputationDispatchRequestType) =>
  Effect.gen(function*() {
    const initialScalarRequest = {
      operation: request.operationName,
      operationCategory: request.operationCategory,
      ...Option.match(Option.fromNullable(request.requestedScalarKind), {
        onNone: () => ({}),
        onSome: (requestedKind) => ({ requestedKind })
      })
    }

    const initialScalarResolution = yield* resolveScalarKind(initialScalarRequest)

    const precisionDecision = yield* Option.match(Option.fromNullable(request.convergence), {
      onNone: () =>
        Effect.succeed<PrecisionEscalationDecisionType>({
          scalarKind: initialScalarResolution.kind,
          converged: true,
          escalated: false,
          source: "none"
        }),
      onSome: (convergence) =>
        resolveEscalatedScalarKind({
          operation: request.operationName,
          currentKind: initialScalarResolution.kind,
          attempts: request.escalationAttempt,
          convergence,
          scalarResolutionSource: initialScalarResolution.source
        })
    })

    const resolvedScalarKind = yield* resolveScalarKind({
      operation: request.operationName,
      operationCategory: request.operationCategory,
      requestedKind: precisionDecision.scalarKind,
      enforceRequestedKind: true
    }).pipe(Effect.map((resolution) => resolution.kind))

    // Runtime backend policy remains authoritative; caller preference is
    // carried for diagnostics only.
    const backendRequest = {
      operation: request.operationName,
      scalarKind: resolvedScalarKind,
      ...Option.match(Option.fromNullable(request.preferredBackend), {
        onNone: () => ({}),
        onSome: (preferredBackend) => ({ preferredBackend })
      })
    }

    const resolvedBackendKind = yield* resolveBackendKind(backendRequest)

    const autodiffResolution = yield* Match.value(request.requiresAutodiff).pipe(
      Match.when(false, () => Effect.succeed(NO_AUTODIFF_RESOLUTION)),
      Match.when(true, () =>
        Option.match(Option.fromNullable(request.preferredAutodiff), {
          onNone: () =>
            resolveAutodiffMode({
              operation: request.operationName
            }),
          onSome: (preferredMode) =>
            resolveAutodiffMode({
              operation: request.operationName,
              preferredMode
            })
        })),
      Match.exhaustive
    )

    return {
      scalarKind: resolvedScalarKind,
      scalarResolutionSource: initialScalarResolution.source,
      precisionEscalationSource: precisionDecision.source,
      backendKind: resolvedBackendKind,
      autodiffMode: autodiffResolution.mode,
      differentiationMethod: autodiffResolution.method,
      finiteDifferenceFallback: autodiffResolution.usedFiniteDifferenceFallback,
      escalated: precisionDecision.escalated,
      convergenceSatisfied: precisionDecision.converged,
      uncertaintyEnvelope: request.requiresUncertaintyEnvelope
    }
  })

/**
 * Supplies the exported default scalar, precision, backend, and autodiff authorities.
 *
 * @remarks
 * Backend policy is `"scalar"`. The Layer acquires no resources, cannot fail,
 * and does not provide {@link ComputationDispatcher}.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ComputationDispatchAuthoritiesLive = Layer.mergeAll(
  ScalarAuthorityLive,
  PrecisionEscalationLive,
  Layer.succeed(BackendPolicyService, { policy: "scalar" }),
  AutodiffAuthorityLive
)

/**
 * Supplies an authority-based {@link ComputationDispatcher}.
 *
 * @remarks
 * The Layer acquires no resources and cannot fail. The dispatcher's `plan`
 * method still requires {@link ComputationDispatchRequirements}.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ComputationDispatcherLive = Layer.succeed(ComputationDispatcher, {
  plan: (request) => planComputationFromAuthorities(request)
})

/**
 * Supplies the default dispatcher and all authority services needed to run it.
 *
 * @remarks
 * The Layer acquires no resources and cannot fail. It produces plans only;
 * no numerical kernel is selected or executed.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ComputationDispatchLive = Layer.mergeAll(ComputationDispatcherLive, ComputationDispatchAuthoritiesLive)

/**
 * Decodes unknown input and delegates planning to the configured dispatcher.
 *
 * @remarks
 * Decoding rejects excess fields. The function requires
 * {@link ComputationDispatcher} plus any services required by its `plan`
 * method. Supply {@link ComputationDispatchLive} to use all exported defaults.
 *
 * @example
 * ```ts
 * import {
 *   ComputationDispatchLive,
 *   planAdvancedComputation
 * } from "@scenesystems/effect-math/contracts"
 * import { Effect } from "effect"
 *
 * export const program = planAdvancedComputation({
 *     operationCategory: "numeric",
 *     operationName: "scale",
 *     escalationAttempt: 0,
 *     requiresAutodiff: false,
 *     requiresUncertaintyEnvelope: true
 * }).pipe(
 *   Effect.provide(ComputationDispatchLive),
 *   Effect.filterOrFail(
 *     (plan) => plan.scalarKind === "float64" &&
 *       plan.backendKind === "scalar" && plan.uncertaintyEnvelope,
 *     () => "UnexpectedComputationPlan"
 *   )
 * )
 * ```
 *
 * @param input - Untrusted request input decoded with excess-property rejection.
 * @returns The plan produced by the configured dispatcher.
 * @throws {@link ComputationDispatchDecodeError} in the Effect error channel when request decoding fails.
 * @throws {@link ComputationDispatchError} in the Effect error channel when the configured planner cannot satisfy the request.
 *
 * @since 0.1.0
 * @category contracts
 */
export const planAdvancedComputation = (input: unknown) =>
  Effect.gen(function*() {
    const request = yield* decodeComputationDispatchRequest(input)
    const dispatcher = yield* ComputationDispatcher
    return yield* dispatcher.plan(request)
  })
