/**
 * Defines convergence gates and scalar-lane escalation policy for computation planning.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Array, Boolean, Context, Effect, Layer, Match, Number, Option, Schema, String } from "effect"

import { PrecisionEscalationExhaustedError } from "./AdvancedComputationErrors.js"
import { ScalarKind, ScalarResolutionSource } from "./ScalarAuthority.js"

const PositiveFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))
const NonNegativeFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))

/**
 * Accepts positive error limits and a positive integer iteration ceiling.
 *
 * @remarks
 * A convergence observation passes only when both errors and the completed
 * iteration count are less than or equal to their limits.
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
 * Decoded limits used to evaluate a convergence observation.
 *
 * @since 0.1.0
 * @category models
 */
export type ConvergenceGateType = typeof ConvergenceGate.Type

/**
 * Accepts non-negative finite errors and a non-negative completed iteration count.
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
 * A decoded convergence observation reported by a kernel.
 *
 * @since 0.1.0
 * @category models
 */
export type ConvergenceObservationType = typeof ConvergenceObservation.Type

/**
 * Accepts provenance labels for retained and promoted scalar lanes.
 *
 * @since 0.1.0
 * @category contracts
 */
export const PrecisionEscalationDecisionSource = Schema.Literal("none", "primary-kind", "escalation-order")

/**
 * The policy branch that selected an escalation result.
 *
 * @since 0.1.0
 * @category models
 */
export type PrecisionEscalationDecisionSourceType = typeof PrecisionEscalationDecisionSource.Type

const PRECISION_SOURCE_NONE: PrecisionEscalationDecisionSourceType = "none"
const PRECISION_SOURCE_PRIMARY_KIND: PrecisionEscalationDecisionSourceType = "primary-kind"
const PRECISION_SOURCE_ESCALATION_ORDER: PrecisionEscalationDecisionSourceType = "escalation-order"

/**
 * Describes a convergence result and its retained or promoted scalar lane.
 *
 * @remarks
 * The Schema does not enforce relationships among `converged`, `escalated`,
 * and `source`. {@link resolveEscalatedScalarKind} establishes those invariants.
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
 * A decoded precision-escalation result.
 *
 * @since 0.1.0
 * @category models
 */
export type PrecisionEscalationDecisionType = typeof PrecisionEscalationDecision.Type

/**
 * Sets the convergence gate, scalar order, and failed-gate budget.
 *
 * @remarks
 * The Schema permits duplicate lanes and permits the primary lane to be
 * absent from `escalationOrder`.
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
 * Decoded scalar-escalation policy.
 *
 * @since 0.1.0
 * @category models
 */
export type PrecisionEscalationPolicyType = typeof PrecisionEscalationPolicy.Type

/**
 * Accepts a failed or successful convergence observation for scalar escalation.
 *
 * @since 0.1.0
 * @category contracts
 */
export const PrecisionEscalationRequest = Schema.Struct({
  operation: Schema.String,
  currentKind: ScalarKind,
  attempts: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  convergence: ConvergenceObservation,
  scalarResolutionSource: ScalarResolutionSource
})

/**
 * A decoded scalar-escalation request.
 *
 * @since 0.1.0
 * @category models
 */
export type PrecisionEscalationRequestType = typeof PrecisionEscalationRequest.Type

/**
 * Supplies convergence and scalar-escalation policy to computation planning.
 *
 * @since 0.1.0
 * @category contracts
 */
export class PrecisionEscalationService extends Context.Tag(
  "effect-math/contracts/shared/PrecisionEscalationService"
)<PrecisionEscalationService, PrecisionEscalationPolicyType>() {}

/**
 * Starts with Float64 and permits promotion to BigDecimal after a failed convergence gate.
 *
 * @remarks
 * The failed-gate budget is two. The gate requires absolute error at most
 * `1e-10`, relative error at most `1e-8`, and no more than 16 iterations.
 *
 * @since 0.1.0
 * @category contracts
 */
export const DefaultPrecisionEscalationPolicy = Schema.decodeUnknownSync(PrecisionEscalationPolicy)({
  primaryKind: "float64",
  escalationOrder: Array.make("float64", "bigdecimal"),
  maxEscalations: 2,
  convergenceGate: {
    absoluteTolerance: 1e-10,
    relativeTolerance: 1e-8,
    maxIterations: 16
  }
})

/**
 * Supplies {@link DefaultPrecisionEscalationPolicy} as {@link PrecisionEscalationService}.
 *
 * @remarks
 * The Layer acquires no resources and cannot fail.
 *
 * @since 0.1.0
 * @category contracts
 */
export const PrecisionEscalationLive = Layer.succeed(PrecisionEscalationService, DefaultPrecisionEscalationPolicy)

const orderedEscalationKinds = (policy: PrecisionEscalationPolicyType) =>
  Array.dedupeWith(
    Array.prepend(policy.escalationOrder, policy.primaryKind),
    String.Equivalence
  )

const convergedWithinGate = (observation: ConvergenceObservationType, gate: ConvergenceGateType): boolean =>
  Boolean.and(
    Boolean.and(
      Number.lessThanOrEqualTo(observation.absoluteError, gate.absoluteTolerance),
      Number.lessThanOrEqualTo(observation.relativeError, gate.relativeTolerance)
    ),
    Number.lessThanOrEqualTo(observation.iterations, gate.maxIterations)
  )

// Promote on the first failed convergence only when the current lane came
// from policy resolution rather than an explicit caller request.
const shouldPromoteToPrimaryKind = (
  request: PrecisionEscalationRequestType,
  policy: PrecisionEscalationPolicyType
): boolean =>
  Boolean.and(
    Boolean.and(
      Boolean.not(String.Equivalence(request.scalarResolutionSource, "requested")),
      Boolean.not(String.Equivalence(request.currentKind, policy.primaryKind))
    ),
    Number.Equivalence(request.attempts, 0)
  )

/**
 * Retains a converged scalar lane or selects the next configured lane.
 *
 * @remarks
 * A passing observation returns the current lane. After a failed gate, a
 * policy-selected non-primary lane first moves to `primaryKind` when
 * `attempts` is zero. Other failures advance through the deduplicated order
 * formed from the primary lane and `escalationOrder`. The resolver trusts the
 * caller's attempt count and does not consult scalar capability metadata.
 *
 * @param request - Current lane, zero-based failed-gate count, convergence observation, and scalar-selection provenance.
 * @returns A retained or promoted lane with convergence and policy provenance.
 * @throws {@link PrecisionEscalationExhaustedError} in the Effect error channel when the budget is exhausted, the current lane is absent, or no later lane exists.
 *
 * @since 0.1.0
 * @category contracts
 */
export const resolveEscalatedScalarKind = (request: PrecisionEscalationRequestType) =>
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
            (attempts) => Number.lessThan(attempts, policy.maxEscalations),
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
                const resolvedIndex = yield* Option.match(
                  Array.findFirstIndex(escalationOrder, (kind) => String.Equivalence(kind, request.currentKind)),
                  {
                    onNone: () =>
                      Effect.fail(
                        new PrecisionEscalationExhaustedError({
                          operation: request.operation,
                          requestedKind: request.currentKind,
                          attempts: request.attempts,
                          message: String.concat(
                            String.concat("Current scalar kind ", request.currentKind),
                            " is not declared in escalation order"
                          )
                        })
                      ),
                    onSome: Effect.succeed
                  }
                )

                const nextKind = Array.get(escalationOrder, Number.increment(resolvedIndex))

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
