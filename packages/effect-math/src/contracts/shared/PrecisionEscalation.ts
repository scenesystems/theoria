/**
 * Precision escalation contracts for deterministic scalar promotion.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Context, Effect, Layer, Number as N, Option, Schema } from "effect"

import { PrecisionEscalationExhaustedError } from "./AdvancedComputationErrors.js"
import { ScalarKind, type ScalarKindType } from "./ScalarAuthority.js"

const PositiveFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0))

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

/**
 * Resolves the next scalar lane when convergence gates fail.
 *
 * @since 0.1.0
 * @category contracts
 */
export const resolveEscalatedScalarKind = (request: {
  readonly operation: string
  readonly currentKind: ScalarKindType
  readonly attempts: number
}) =>
  Effect.gen(function*() {
    const policy = yield* PrecisionEscalationService

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

    const currentIndex = policy.escalationOrder.findIndex((kind) => kind === request.currentKind)

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

    const nextKind = Option.fromNullable(policy.escalationOrder.at(N.increment(resolvedIndex)))

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
      onSome: (kind) => Effect.succeed(kind)
    })
  })
