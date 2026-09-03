/**
 * Defines convergence gates and scalar-lane escalation policy for computation planning.
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
 * Supplies {@link DefaultPrecisionEscalationPolicy} as {@link PrecisionEscalationService}.
 *
 * @remarks
 * The Layer acquires no resources and cannot fail.
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
