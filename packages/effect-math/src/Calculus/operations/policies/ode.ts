/**
 * Policy-aware wrappers for ODE solver surfaces.
 *
 * @since 0.3.0
 * @category operations
 */
import { Chunk, Effect } from "effect"

import { AutodiffAuthorityLive } from "../../../contracts/shared/AutodiffAuthority.js"
import {
  type ComputationDispatchPlanType,
  planComputationFromAuthorities
} from "../../../contracts/shared/ComputationDispatch.js"
import { withCustomPolicyGuards } from "../../../contracts/shared/PolicyGuards.js"
import { PrecisionEscalationLive } from "../../../contracts/shared/PrecisionEscalation.js"
import { ScalarAuthorityLive } from "../../../contracts/shared/ScalarAuthority.js"
import { CalculusDomainViolationError } from "../../errors.js"
import type { AdaptiveRk45InputType, EulerInputType, OdeSolveResult, Rk4InputType } from "../../schema.js"
import { solveAdaptiveRk45, solveEuler, solveRk4 } from "../pure.js"
import { executeKernel, vectorIsFinite } from "../shared.js"

const calculusDispatchPlan = (operation: string) =>
  planComputationFromAuthorities({
    operationCategory: "calculus",
    operationName: `Calculus.${operation}`,
    escalationAttempt: 0,
    requiresAutodiff: false,
    requiresUncertaintyEnvelope: false
  }).pipe(
    Effect.provide(AutodiffAuthorityLive),
    Effect.provide(PrecisionEscalationLive),
    Effect.provide(ScalarAuthorityLive)
  )

const dispatchAnnotations = (plan: ComputationDispatchPlanType): Record<string, string> => ({
  backend: plan.backendKind,
  scalarKind: plan.scalarKind,
  scalarResolution: plan.scalarResolutionSource,
  escalated: String(plan.escalated),
  convergenceSatisfied: String(plan.convergenceSatisfied)
})

const computeWithDispatchPlan = <A>(
  _plan: ComputationDispatchPlanType,
  compute: () => A
): A => compute()

const odeResultIsFinite = (result: OdeSolveResult): boolean =>
  Number.isFinite(result.finalTime) &&
  vectorIsFinite(result.finalState) &&
  Chunk.reduce(
    result.trajectory,
    true,
    (acc, point) => acc && Number.isFinite(point.time) && vectorIsFinite(point.state)
  )

const withOdePolicyGuards = (options: {
  readonly operation: "solveEulerWithPolicies" | "solveRk4WithPolicies" | "solveAdaptiveRk45WithPolicies"
  readonly compute: (plan: ComputationDispatchPlanType) => OdeSolveResult
}) =>
  Effect.gen(function*() {
    const plan = yield* calculusDispatchPlan(options.operation)
    const result = yield* executeKernel(
      options.operation,
      () => computeWithDispatchPlan(plan, () => options.compute(plan))
    )

    return yield* withCustomPolicyGuards({
      operation: `Calculus.${options.operation}`,
      compute: () => result,
      isValid: odeResultIsFinite,
      makeError: (message) =>
        new CalculusDomainViolationError({
          operation: options.operation,
          message
        }),
      annotations: (value) => ({
        ...dispatchAnnotations(plan),
        method: value.method,
        status: value.status,
        acceptedSteps: String(value.acceptedSteps),
        rejectedSteps: String(value.rejectedSteps),
        functionEvaluations: String(value.functionEvaluations),
        trajectoryPoints: String(Chunk.size(value.trajectory))
      })
    })
  })

/**
 * Policy-aware fixed-step Euler solver.
 *
 * @since 0.3.0
 * @category operations
 */
export const solveEulerWithPolicies = (
  f: (time: number, state: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  input: EulerInputType
) =>
  withOdePolicyGuards({
    operation: "solveEulerWithPolicies",
    compute: () => solveEuler(f, input)
  })

/**
 * Policy-aware fixed-step RK4 solver.
 *
 * @since 0.3.0
 * @category operations
 */
export const solveRk4WithPolicies = (
  f: (time: number, state: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  input: Rk4InputType
) =>
  withOdePolicyGuards({
    operation: "solveRk4WithPolicies",
    compute: () => solveRk4(f, input)
  })

/**
 * Policy-aware adaptive RK45 solver.
 *
 * @since 0.3.0
 * @category operations
 */
export const solveAdaptiveRk45WithPolicies = (
  f: (time: number, state: Chunk.Chunk<number>) => Chunk.Chunk<number>,
  input: AdaptiveRk45InputType
) =>
  withOdePolicyGuards({
    operation: "solveAdaptiveRk45WithPolicies",
    compute: () => solveAdaptiveRk45(f, input)
  })
