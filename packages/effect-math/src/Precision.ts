/**
 * Evaluates convergence and selects scalar precision escalation.
 *
 * @since 0.1.0
 * @module
 */
import { Array, Boolean, Context, Effect, Layer, Match, Number, Option, Schema, String } from "effect"

import * as Numeric from "./Numeric.js"
import * as Scalar from "./Scalar.js"

const NonNegativeFiniteNumber = Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))

/**
 * Accepts convergence limits for absolute error, relative error, and iterations.
 *
 * Absolute tolerance uses the result's units, relative tolerance is unitless,
 * and all three inclusive limits must pass for convergence.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ConvergenceGate = Schema.Struct({
  absoluteTolerance: Numeric.AbsoluteTolerance,
  relativeTolerance: Numeric.RelativeTolerance,
  maxIterations: Numeric.IterationBudget
}).annotations({ identifier: "@scenesystems/effect-math/Precision/ConvergenceGate" })

/**
 * Decoded limits used to evaluate a convergence observation.
 *
 * @since 0.1.0
 * @category models
 */
export type ConvergenceGate = typeof ConvergenceGate.Type

/**
 * Accepts non-negative finite errors and a completed iteration count.
 *
 * `absoluteError` has the result's units; `relativeError` is unitless.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ConvergenceObservation = Schema.Struct({
  absoluteError: NonNegativeFiniteNumber,
  relativeError: NonNegativeFiniteNumber,
  iterations: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}).annotations({ identifier: "@scenesystems/effect-math/Precision/ConvergenceObservation" })

/**
 * A decoded convergence observation reported by a numerical kernel.
 *
 * @since 0.1.0
 * @category models
 */
export type ConvergenceObservation = typeof ConvergenceObservation.Type

/**
 * Accepts provenance for retention, promotion to primary, or ordered escalation.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ResolutionSource = Schema.Literal("none", "primary-kind", "escalation-order").annotations({
  identifier: "@scenesystems/effect-math/Precision/ResolutionSource"
})

/**
 * The policy branch that selected a precision resolution.
 *
 * @since 0.1.0
 * @category models
 */
export type ResolutionSource = typeof ResolutionSource.Type

/**
 * Describes convergence and the retained or promoted scalar lane.
 *
 * The schema validates fields independently; {@link resolve} establishes the
 * relationships among `converged`, `escalated`, and `source`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Resolution = Schema.Struct({
  scalarKind: Scalar.Kind,
  converged: Schema.Boolean,
  escalated: Schema.Boolean,
  source: ResolutionSource
}).annotations({ identifier: "@scenesystems/effect-math/Precision/Resolution" })

/**
 * A decoded precision escalation result.
 *
 * @since 0.1.0
 * @category models
 */
export type Resolution = typeof Resolution.Type

/**
 * Sets convergence limits, scalar order, and the failed-gate budget.
 *
 * Duplicate lanes are permitted and the primary need not occur in
 * `escalationOrder`; resolution prepends and deduplicates the primary.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Policy = Schema.Struct({
  primaryKind: Scalar.Kind,
  escalationOrder: Schema.NonEmptyArray(Scalar.Kind),
  maxEscalations: Numeric.IterationBudget,
  convergenceGate: ConvergenceGate
}).annotations({ identifier: "@scenesystems/effect-math/Precision/Policy" })

/**
 * A decoded convergence and scalar-escalation policy.
 *
 * @since 0.1.0
 * @category models
 */
export type Policy = typeof Policy.Type

/**
 * Accepts the current lane, failed-gate count, observation, and scalar provenance.
 *
 * `attempts` is caller-maintained and is compared directly with the policy
 * budget; resolution does not infer attempts from any execution history.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Request = Schema.Struct({
  operation: Schema.String,
  currentKind: Scalar.Kind,
  attempts: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  convergence: ConvergenceObservation,
  scalarResolutionSource: Scalar.ResolutionSource
}).annotations({ identifier: "@scenesystems/effect-math/Precision/Request" })

/**
 * A decoded scalar precision escalation request.
 *
 * @since 0.1.0
 * @category models
 */
export type Request = typeof Request.Type

/**
 * Reports that failed convergence cannot advance to another scalar lane.
 *
 * Exhaustion occurs when the attempt budget is reached, the current lane is
 * absent from the configured order, or no later lane remains.
 *
 * @since 0.1.0
 * @category errors
 */
export class EscalationExhaustedError extends Schema.TaggedError<EscalationExhaustedError>(
  "@scenesystems/effect-math/Precision/EscalationExhaustedError"
)("PrecisionEscalationExhaustedError", {
  operation: Schema.String,
  requestedKind: Schema.String,
  attempts: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  message: Schema.String
}) {}

/**
 * Supplies convergence and scalar-escalation policy.
 *
 * @since 0.1.0
 * @category services
 */
export class Precision extends Context.Tag("@scenesystems/effect-math/Precision")<Precision, Policy>() {}

/**
 * Starts with Float64 and permits promotion to BigDecimal.
 *
 * Two failed gates are allowed. Convergence requires absolute error at most
 * `1e-10` result units, relative error at most `1e-8`, and at most 16
 * iterations.
 *
 * @since 0.1.0
 * @category defaults
 */
export const defaultPolicy = Schema.decodeUnknownSync(Policy)({
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
 * Provides the default precision escalation policy.
 *
 * The layer acquires no resources and cannot fail.
 *
 * @since 0.1.0
 * @category layers
 */
export const layer = Layer.succeed(Precision, defaultPolicy)

const orderedKinds = (policy: Policy) =>
  Array.dedupeWith(Array.prepend(policy.escalationOrder, policy.primaryKind), String.Equivalence)

const convergedWithin = (observation: ConvergenceObservation, gate: ConvergenceGate): boolean =>
  Boolean.and(
    Boolean.and(
      Number.lessThanOrEqualTo(observation.absoluteError, gate.absoluteTolerance),
      Number.lessThanOrEqualTo(observation.relativeError, gate.relativeTolerance)
    ),
    Number.lessThanOrEqualTo(observation.iterations, gate.maxIterations)
  )

const shouldPromoteToPrimary = (request: Request, policy: Policy): boolean =>
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
 * A passing observation retains the current lane. On the first failed gate,
 * a policy-selected non-primary lane promotes to the primary. Other failures
 * advance through the deduplicated primary-plus-escalation order. The resolver
 * trusts `attempts`, does not inspect scalar capabilities, and fails only after
 * the budget or eligible order is exhausted. It plans a lane but executes no
 * numerical work.
 *
 * @since 0.1.0
 * @category resolution
 */
export const resolve = (request: Request) =>
  Effect.gen(function*() {
    const policy = yield* Precision

    return yield* Match.value(convergedWithin(request.convergence, policy.convergenceGate)).pipe(
      Match.when(true, () =>
        Effect.succeed<Resolution>({
          scalarKind: request.currentKind,
          converged: true,
          escalated: false,
          source: "none"
        })),
      Match.when(false, () =>
        Effect.gen(function*() {
          yield* Effect.filterOrFail(
            Effect.succeed(request.attempts),
            (attempts) => Number.lessThan(attempts, policy.maxEscalations),
            () =>
              new EscalationExhaustedError({
                operation: request.operation,
                requestedKind: request.currentKind,
                attempts: request.attempts,
                message: "Precision escalation budget exhausted"
              })
          )
          const order = orderedKinds(policy)

          return yield* Match.value(shouldPromoteToPrimary(request, policy)).pipe(
            Match.when(true, () =>
              Effect.succeed<Resolution>({
                scalarKind: policy.primaryKind,
                converged: false,
                escalated: true,
                source: "primary-kind"
              })),
            Match.when(false, () =>
              Effect.gen(function*() {
                const index = yield* Option.match(
                  Array.findFirstIndex(order, (kind) => String.Equivalence(kind, request.currentKind)),
                  {
                    onNone: () =>
                      Effect.fail(
                        new EscalationExhaustedError({
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

                return yield* Option.match(Array.get(order, Number.increment(index)), {
                  onNone: () =>
                    Effect.fail(
                      new EscalationExhaustedError({
                        operation: request.operation,
                        requestedKind: request.currentKind,
                        attempts: request.attempts,
                        message: "No additional scalar lane is available for escalation"
                      })
                    ),
                  onSome: (kind) =>
                    Effect.succeed<Resolution>({
                      scalarKind: kind,
                      converged: false,
                      escalated: true,
                      source: "escalation-order"
                    })
                })
              })),
            Match.exhaustive
          )
        })),
      Match.exhaustive
    )
  })
