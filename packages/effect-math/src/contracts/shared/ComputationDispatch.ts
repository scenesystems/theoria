/**
 * Advanced computation dispatch contracts.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Context, Effect, Layer, Match, Schema } from "effect"

import type {
  AutodiffUnavailableError,
  BackendUnavailableError,
  PrecisionEscalationExhaustedError,
  ScalarLaneUnsupportedError
} from "./AdvancedComputationErrors.js"
import { ComputationDispatchDecodeError } from "./AdvancedComputationErrors.js"
import { AutodiffAuthorityLive, AutodiffMode, resolveAutodiffMode } from "./AutodiffAuthority.js"
import type { AutodiffAuthorityService } from "./AutodiffAuthority.js"
import { BackendAuthorityLive, BackendKind, resolveBackendKind } from "./BackendAuthority.js"
import type { BackendAuthorityService } from "./BackendAuthority.js"
import { PrecisionEscalationLive, resolveEscalatedScalarKind } from "./PrecisionEscalation.js"
import type { PrecisionEscalationService } from "./PrecisionEscalation.js"
import { resolveScalarKind, ScalarAuthorityLive, ScalarKind, ScalarOperationCategory } from "./ScalarAuthority.js"
import type { ScalarAuthorityService } from "./ScalarAuthority.js"

/**
 * Advanced dispatch request contract.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ComputationDispatchRequest = Schema.Struct({
  operationCategory: ScalarOperationCategory,
  operationName: Schema.String,
  requestedScalarKind: ScalarKind,
  preferredBackend: Schema.optional(BackendKind),
  preferredAutodiff: Schema.optional(AutodiffMode),
  escalationAttempt: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  converged: Schema.Boolean,
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
 * @since 0.1.0
 * @category contracts
 */
export const ComputationDispatchPlan = Schema.Struct({
  scalarKind: ScalarKind,
  backendKind: BackendKind,
  autodiffMode: Schema.optional(AutodiffMode),
  escalated: Schema.Boolean,
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
  | BackendAuthorityService
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
 * @since 0.1.0
 * @category contracts
 */
export const planComputationFromAuthorities = (request: ComputationDispatchRequestType) =>
  Effect.gen(function*() {
    const initialScalarKind = yield* resolveScalarKind({
      operation: request.operationName,
      operationCategory: request.operationCategory,
      requestedKind: request.requestedScalarKind
    })

    const resolvedScalarKind = yield* Match.value(request.converged).pipe(
      Match.when(true, () => Effect.succeed(initialScalarKind)),
      Match.when(false, () =>
        resolveEscalatedScalarKind({
          operation: request.operationName,
          currentKind: initialScalarKind,
          attempts: request.escalationAttempt
        })),
      Match.exhaustive
    )

    const resolvedBackendKind = yield* Match.value(request.preferredBackend).pipe(
      Match.when(undefined, () =>
        resolveBackendKind({
          operation: request.operationName,
          scalarKind: resolvedScalarKind
        })),
      Match.orElse((preferredBackend) =>
        resolveBackendKind({
          operation: request.operationName,
          scalarKind: resolvedScalarKind,
          preferredBackend
        })
      )
    )

    const resolvedAutodiffMode = yield* Match.value(request.requiresAutodiff).pipe(
      Match.when(false, () => Effect.succeed(undefined)),
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
      backendKind: resolvedBackendKind,
      autodiffMode: resolvedAutodiffMode,
      escalated: resolvedScalarKind !== initialScalarKind,
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
  BackendAuthorityLive,
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
