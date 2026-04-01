/**
 * Advanced computation dispatch contracts.
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
import type { AutodiffAuthorityService } from "./AutodiffAuthority.js"
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
  readonly mode: undefined
  readonly usedFiniteDifferenceFallback: false
} = {
  method: "none",
  mode: undefined,
  usedFiniteDifferenceFallback: false
}

/**
 * Advanced dispatch request contract.
 *
 * `preferredBackend` and `preferredAutodiff` express caller intent while
 * runtime policy services stay authoritative for final lane selection.
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
 * Advanced dispatch request type.
 *
 * @since 0.1.0
 * @category models
 */
export type ComputationDispatchRequestType = typeof ComputationDispatchRequest.Type

/**
 * Advanced dispatch plan contract.
 *
 * Includes both resolved execution lanes and provenance fields so tests can
 * assert which authority produced each decision.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ComputationDispatchPlan = Schema.Struct({
  scalarKind: ScalarKind,
  scalarResolutionSource: ScalarResolutionSource,
  precisionEscalationSource: PrecisionEscalationDecisionSource,
  backendKind: BackendKind,
  autodiffMode: Schema.optional(AutodiffMode),
  differentiationMethod: ComputationDifferentiationMethod,
  finiteDifferenceFallback: Schema.Boolean,
  escalated: Schema.Boolean,
  convergenceSatisfied: Schema.Boolean,
  uncertaintyEnvelope: Schema.Boolean
})

/**
 * Advanced dispatch plan type.
 *
 * @since 0.1.0
 * @category models
 */
export type ComputationDispatchPlanType = typeof ComputationDispatchPlan.Type

/**
 * Advanced dispatch error union.
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
 * Authority requirements used by dispatch planning.
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
 * Advanced dispatcher service seam.
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
 * Contract-level plan builder wired directly to authority services.
 *
 * **Details**
 * Scalar, precision, backend, and autodiff decisions are all resolved through
 * runtime policy services so there is a single observable dispatch authority.
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
        Match.value(request.preferredAutodiff).pipe(
          Match.when(undefined, () =>
            resolveAutodiffMode({
              operation: request.operationName
            })),
          Match.orElse((preferredMode) =>
            resolveAutodiffMode({
              operation: request.operationName,
              preferredMode
            })
          )
        )),
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
 * Default authority composition for advanced dispatch planning.
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
 * Default dispatcher layer for RED-first target-state tests.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ComputationDispatcherLive = Layer.succeed(ComputationDispatcher, {
  plan: (request) => planComputationFromAuthorities(request)
})

/**
 * Default runtime wiring for advanced dispatch planning.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ComputationDispatchLive = Layer.mergeAll(ComputationDispatcherLive, ComputationDispatchAuthoritiesLive)

/**
 * Boundary-decoded advanced dispatch entrypoint.
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
