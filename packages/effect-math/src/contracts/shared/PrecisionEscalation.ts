/**
 * Precision escalation contracts for deterministic scalar promotion.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Context, Effect, Layer, Match, Number as N, Option, Schema } from "effect"

import { PrecisionEscalationExhaustedError } from "./AdvancedComputationErrors.js"
import { ScalarKind, type ScalarKindType, type ScalarResolutionSourceType } from "./ScalarAuthority.js"

const PositiveFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))
const NonNegativeFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))

/**
 * Convergence gate contract used by escalation authority.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ConvergenceGate = Schema.Struct({
  absoluteTolerance: PositiveFiniteNumber,
  relativeTolerance: PositiveFiniteNumber,
  maxIterations: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1))
})

/**
 * Convergence gate type.
 *
 * @since 0.1.0
 * @category models
 */
export type ConvergenceGateType = typeof ConvergenceGate.Type

/**
 * Convergence observation produced by runtime kernels.
 *
 * @since 0.1.0
 * @category contracts
 */
export const ConvergenceObservation = Schema.Struct({
  absoluteError: NonNegativeFiniteNumber,
  relativeError: NonNegativeFiniteNumber,
  iterations: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
})

/**
 * Convergence observation type.
 *
 * @since 0.1.0
 * @category models
 */
export type ConvergenceObservationType = typeof ConvergenceObservation.Type

/**
 * Source for precision escalation decisions.
 *
 * @since 0.1.0
 * @category contracts
 */
export const PrecisionEscalationDecisionSource = Schema.Literal("none", "primary-kind", "escalation-order")

/**
 * Source for precision escalation decisions.
 *
 * @since 0.1.0
 * @category models
 */
export type PrecisionEscalationDecisionSourceType = typeof PrecisionEscalationDecisionSource.Type

const PRECISION_SOURCE_NONE: PrecisionEscalationDecisionSourceType = "none"
const PRECISION_SOURCE_PRIMARY_KIND: PrecisionEscalationDecisionSourceType = "primary-kind"
const PRECISION_SOURCE_ESCALATION_ORDER: PrecisionEscalationDecisionSourceType = "escalation-order"

/**
 * Precision escalation decision contract.
 *
 * @since 0.1.0
 * @category contracts
 */
export const PrecisionEscalationDecision = Schema.Struct({
  scalarKind: ScalarKind,
  converged: Schema.Boolean,
  escalated: Schema.Boolean,
  source: PrecisionEscalationDecisionSource
})

/**
 * Precision escalation decision type.
 *
 * @since 0.1.0
 * @category models
 */
export type PrecisionEscalationDecisionType = typeof PrecisionEscalationDecision.Type

/**
 * Precision escalation policy contract.
 *
 * @since 0.1.0
 * @category contracts
 */
export const PrecisionEscalationPolicy = Schema.Struct({
  primaryKind: ScalarKind,
  escalationOrder: Schema.NonEmptyArray(ScalarKind),
  maxEscalations: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  convergenceGate: ConvergenceGate
})

/**
 * Precision escalation policy type.
 *
 * @since 0.1.0
 * @category models
 */
export type PrecisionEscalationPolicyType = typeof PrecisionEscalationPolicy.Type

/**
 * Precision escalation service seam.
 *
 * @since 0.1.0
 * @category contracts
 */
export class PrecisionEscalationService extends Context.Tag(
  "effect-math/contracts/shared/PrecisionEscalationService"
)<PrecisionEscalationService, PrecisionEscalationPolicyType>() {}

/**
 * Baseline escalation policy used during RED-first execution.
 *
 * @since 0.1.0
 * @category contracts
 */
export const DefaultPrecisionEscalationPolicy: PrecisionEscalationPolicyType = {
  primaryKind: "float64",
  escalationOrder: ["float64", "bigdecimal"],
  maxEscalations: 2,
  convergenceGate: {
    absoluteTolerance: 1e-10,
    relativeTolerance: 1e-8,
    maxIterations: 16
  }
}

/**
 * Live precision escalation layer.
 *
 * @since 0.1.0
 * @category contracts
 */
export const PrecisionEscalationLive = Layer.succeed(PrecisionEscalationService, DefaultPrecisionEscalationPolicy)

const orderedEscalationKinds = (policy: PrecisionEscalationPolicyType): ReadonlyArray<ScalarKindType> =>
  [policy.primaryKind, ...policy.escalationOrder].filter(
    (kind, index, all) => all.findIndex((candidate) => candidate === kind) === index
  )

const convergedWithinGate = (observation: ConvergenceObservationType, gate: ConvergenceGateType): boolean =>
  N.lessThanOrEqualTo(observation.absoluteError, gate.absoluteTolerance)
  && N.lessThanOrEqualTo(observation.relativeError, gate.relativeTolerance)
  && N.lessThanOrEqualTo(observation.iterations, gate.maxIterations)

// Promote on the first failed convergence only when the current lane came
// from policy resolution rather than an explicit caller request.
const shouldPromoteToPrimaryKind = (
  request: {
    readonly currentKind: ScalarKindType
    readonly attempts: number
    readonly scalarResolutionSource: ScalarResolutionSourceType
  },
  policy: PrecisionEscalationPolicyType
): boolean =>
  request.scalarResolutionSource !== "requested"
  && request.currentKind !== policy.primaryKind
  && N.Equivalence(request.attempts, 0)

/**
 * Resolves scalar lane escalation from convergence observations and policy.
 *
 * **Details**
 * If convergence passes the gate, the current scalar lane is retained.
 * On failed convergence, policy-derived lanes can promote to `primaryKind`
 * on attempt zero; otherwise resolution follows `escalationOrder`.
 *
 * @since 0.1.0
 * @category contracts
 */
export const resolveEscalatedScalarKind = (request: {
  readonly operation: string
  readonly currentKind: ScalarKindType
  readonly attempts: number
  readonly convergence: ConvergenceObservationType
  readonly scalarResolutionSource: ScalarResolutionSourceType
}) =>
  Effect.gen(function*() {
    const policy = yield* PrecisionEscalationService
    const converged = convergedWithinGate(request.convergence, policy.convergenceGate)

    return yield* Match.value(converged).pipe(
      Match.when(true, () =>
        Effect.succeed<PrecisionEscalationDecisionType>({
          scalarKind: request.currentKind,
          converged: true,
          escalated: false,
          source: PRECISION_SOURCE_NONE
        })),
      Match.when(false, () =>
        Effect.gen(function*() {
          yield* Effect.filterOrFail(
            Effect.succeed(request.attempts),
            (attempts) => N.lessThan(attempts, policy.maxEscalations),
            () =>
              new PrecisionEscalationExhaustedError({
                operation: request.operation,
                requestedKind: request.currentKind,
                attempts: request.attempts,
                message: "Precision escalation budget exhausted"
              })
          )

          const escalationOrder = orderedEscalationKinds(policy)

          return yield* Match.value(shouldPromoteToPrimaryKind(request, policy)).pipe(
            Match.when(true, () =>
              Effect.succeed<PrecisionEscalationDecisionType>({
                scalarKind: policy.primaryKind,
                converged: false,
                escalated: true,
                source: PRECISION_SOURCE_PRIMARY_KIND
              })),
            Match.when(false, () =>
              Effect.gen(function*() {
                const currentIndex = escalationOrder.findIndex((kind) => kind === request.currentKind)

                const resolvedIndex = yield* Effect.filterOrFail(
                  Effect.succeed(currentIndex),
                  (index) => N.greaterThanOrEqualTo(index, 0),
                  () =>
                    new PrecisionEscalationExhaustedError({
                      operation: request.operation,
                      requestedKind: request.currentKind,
                      attempts: request.attempts,
                      message: `Current scalar kind ${request.currentKind} is not declared in escalation order`
                    })
                )

                const nextKind = Option.fromNullable(escalationOrder.at(N.increment(resolvedIndex)))

                return yield* Option.match(nextKind, {
                  onNone: () =>
                    Effect.fail(
                      new PrecisionEscalationExhaustedError({
                        operation: request.operation,
                        requestedKind: request.currentKind,
                        attempts: request.attempts,
                        message: "No additional scalar lane is available for escalation"
                      })
                    ),
                  onSome: (kind) =>
                    Effect.succeed<PrecisionEscalationDecisionType>({
                      scalarKind: kind,
                      converged: false,
                      escalated: true,
                      source: PRECISION_SOURCE_ESCALATION_ORDER
                    })
                })
              })),
            Match.exhaustive
          )
        })),
      Match.exhaustive
    )
  })
