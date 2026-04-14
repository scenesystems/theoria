/**
 * Shared ODE solver helpers.
 *
 * @since 0.3.0
 * @category internal
 */
import { Chunk, Number as N } from "effect"

import type { OdeMethodType, OdeSolveResult, OdeSolveStatusType, OdeTrajectoryPoint } from "../../schema.js"

const abs = (value: number): number => N.max(value, N.negate(value))

export type OdeVectorField = (time: number, state: Chunk.Chunk<number>) => Chunk.Chunk<number>

export const DEFAULT_ODE_MAX_STEPS = 10_000
export const ADAPTIVE_SAFETY = 0.9
export const ADAPTIVE_MIN_FACTOR = 0.2
export const ADAPTIVE_MAX_FACTOR = 10
export const ADAPTIVE_ERROR_EXPONENT = -0.2

export const minimum = (left: number, right: number): number => N.lessThanOrEqualTo(left, right) ? left : right

export const maximum = (left: number, right: number): number => N.lessThanOrEqualTo(left, right) ? right : left

export const directionFromInterval = ({
  finalTime,
  initialTime
}: {
  readonly finalTime: number
  readonly initialTime: number
}): number => (N.lessThanOrEqualTo(initialTime, finalTime) ? 1 : -1)

export const hasReachedTarget = ({
  currentTime,
  direction,
  finalTime
}: {
  readonly currentTime: number
  readonly direction: number
  readonly finalTime: number
}): boolean => {
  const remaining = direction > 0 ? N.subtract(finalTime, currentTime) : N.subtract(currentTime, finalTime)
  const tolerance = N.multiply(10, N.multiply(Number.EPSILON, maximum(maximum(abs(currentTime), abs(finalTime)), 1)))

  return remaining <= tolerance
}

export const remainingDistance = ({
  currentTime,
  direction,
  finalTime
}: {
  readonly currentTime: number
  readonly direction: number
  readonly finalTime: number
}): number => direction > 0 ? N.subtract(finalTime, currentTime) : N.subtract(currentTime, finalTime)

export const minimumAdaptiveStepMagnitude = (time: number): number =>
  N.multiply(
    10,
    maximum(
      N.multiply(Number.EPSILON, maximum(abs(time), 1)),
      Number.MIN_VALUE
    )
  )

export const makeTrajectoryPoint = (
  time: number,
  state: Chunk.Chunk<number>
): OdeTrajectoryPoint => ({
  state,
  time
})

export const makeOdeResult = ({
  acceptedSteps,
  finalState,
  finalTime,
  functionEvaluations,
  method,
  rejectedSteps,
  status,
  trajectory
}: {
  readonly acceptedSteps: number
  readonly finalState: Chunk.Chunk<number>
  readonly finalTime: number
  readonly functionEvaluations: number
  readonly method: OdeMethodType
  readonly rejectedSteps: number
  readonly status: OdeSolveStatusType
  readonly trajectory: ReadonlyArray<OdeTrajectoryPoint>
}): OdeSolveResult => ({
  acceptedSteps,
  finalState,
  finalTime,
  functionEvaluations,
  method,
  rejectedSteps,
  status,
  trajectory: Chunk.fromIterable(trajectory)
})
