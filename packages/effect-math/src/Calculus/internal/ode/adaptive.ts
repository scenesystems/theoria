/**
 * Adaptive Dormand-Prince RK45 solver.
 *
 * Decomposition rationale: the RK45 tableau plus recursive acceptance loop are
 * tightly coupled around one canonical error-control story, so splitting the
 * file earlier obscures the numerical contract more than it helps.
 * Split plan: extract the Dormand-Prince tableau and step-evaluation helper if
 * later dense-output or policy-aware RK variants add a second consumer.
 *
 * @since 0.3.0
 * @category internal
 */
import { Number as N } from "effect"
import type { Chunk } from "effect"

import { exp, log } from "../../../Numeric/operations.js"
import type { AdaptiveRk45InputType, OdeTrajectoryPoint } from "../../schema.js"
import {
  ADAPTIVE_ERROR_EXPONENT,
  ADAPTIVE_MAX_FACTOR,
  ADAPTIVE_MIN_FACTOR,
  ADAPTIVE_SAFETY,
  DEFAULT_ODE_MAX_STEPS,
  directionFromInterval,
  hasReachedTarget,
  makeOdeResult,
  makeTrajectoryPoint,
  maximum,
  minimum,
  minimumAdaptiveStepMagnitude,
  type OdeVectorField,
  remainingDistance
} from "./shared.js"
import { rmsScaledError, vectorAddScaled, weightedCombination } from "./vector.js"

const rk45Step = (
  field: OdeVectorField,
  time: number,
  state: Chunk.Chunk<number>,
  step: number
): {
  readonly error: Chunk.Chunk<number>
  readonly functionEvaluations: number
  readonly nextState: Chunk.Chunk<number>
} => {
  const k1 = field(time, state)
  const k2 = field(
    N.sum(time, N.multiply(step, 1 / 5)),
    vectorAddScaled(state, [{ values: k1, weight: N.multiply(step, 1 / 5) }])
  )
  const k3 = field(
    N.sum(time, N.multiply(step, 3 / 10)),
    vectorAddScaled(state, [
      { values: k1, weight: N.multiply(step, 3 / 40) },
      { values: k2, weight: N.multiply(step, 9 / 40) }
    ])
  )
  const k4 = field(
    N.sum(time, N.multiply(step, 4 / 5)),
    vectorAddScaled(state, [
      { values: k1, weight: N.multiply(step, 44 / 45) },
      { values: k2, weight: N.multiply(step, -56 / 15) },
      { values: k3, weight: N.multiply(step, 32 / 9) }
    ])
  )
  const k5 = field(
    N.sum(time, N.multiply(step, 8 / 9)),
    vectorAddScaled(state, [
      { values: k1, weight: N.multiply(step, 19372 / 6561) },
      { values: k2, weight: N.multiply(step, -25360 / 2187) },
      { values: k3, weight: N.multiply(step, 64448 / 6561) },
      { values: k4, weight: N.multiply(step, -212 / 729) }
    ])
  )
  const k6 = field(
    N.sum(time, step),
    vectorAddScaled(state, [
      { values: k1, weight: N.multiply(step, 9017 / 3168) },
      { values: k2, weight: N.multiply(step, -355 / 33) },
      { values: k3, weight: N.multiply(step, 46732 / 5247) },
      { values: k4, weight: N.multiply(step, 49 / 176) },
      { values: k5, weight: N.multiply(step, -5103 / 18656) }
    ])
  )

  const nextState = vectorAddScaled(state, [
    { values: k1, weight: N.multiply(step, 35 / 384) },
    { values: k3, weight: N.multiply(step, 500 / 1113) },
    { values: k4, weight: N.multiply(step, 125 / 192) },
    { values: k5, weight: N.multiply(step, -2187 / 6784) },
    { values: k6, weight: N.multiply(step, 11 / 84) }
  ])
  const k7 = field(N.sum(time, step), nextState)

  return {
    error: weightedCombination([
      { values: k1, weight: N.multiply(step, -71 / 57600) },
      { values: k3, weight: N.multiply(step, 71 / 16695) },
      { values: k4, weight: N.multiply(step, -71 / 1920) },
      { values: k5, weight: N.multiply(step, 17253 / 339200) },
      { values: k6, weight: N.multiply(step, -22 / 525) },
      { values: k7, weight: N.multiply(step, 1 / 40) }
    ]),
    functionEvaluations: 7,
    nextState
  }
}

const adaptiveFactor = (errorNorm: number): number =>
  errorNorm === 0
    ? ADAPTIVE_MAX_FACTOR
    : minimum(
      ADAPTIVE_MAX_FACTOR,
      N.multiply(ADAPTIVE_SAFETY, exp(N.multiply(ADAPTIVE_ERROR_EXPONENT, log(errorNorm))))
    )

const initialStepMagnitude = (input: AdaptiveRk45InputType): number => {
  const totalSpan = abs(N.subtract(input.finalTime, input.initialTime))
  const cappedDefault = minimum(input.maxStep ?? totalSpan, maximum(N.unsafeDivide(totalSpan, 10), Number.MIN_VALUE))

  return minimum(input.maxStep ?? cappedDefault, input.initialStep ?? cappedDefault)
}

const abs = (value: number): number => N.max(value, N.negate(value))

const advanceAdaptive = ({
  acceptedSteps,
  currentStepMagnitude,
  direction,
  field,
  finalTime,
  functionEvaluations,
  input,
  rejectedSteps,
  state,
  stepRejected,
  time,
  trajectory
}: {
  readonly acceptedSteps: number
  readonly currentStepMagnitude: number
  readonly direction: number
  readonly field: OdeVectorField
  readonly finalTime: number
  readonly functionEvaluations: number
  readonly input: AdaptiveRk45InputType
  readonly rejectedSteps: number
  readonly state: Chunk.Chunk<number>
  readonly stepRejected: boolean
  readonly time: number
  readonly trajectory: ReadonlyArray<OdeTrajectoryPoint>
}) => {
  if (hasReachedTarget({ currentTime: time, direction, finalTime })) {
    return makeOdeResult({
      acceptedSteps,
      finalState: state,
      finalTime: time,
      functionEvaluations,
      method: "rk45",
      rejectedSteps,
      status: "finished",
      trajectory
    })
  }

  if (acceptedSteps + rejectedSteps >= (input.maxSteps ?? DEFAULT_ODE_MAX_STEPS)) {
    return makeOdeResult({
      acceptedSteps,
      finalState: state,
      finalTime: time,
      functionEvaluations,
      method: "rk45",
      rejectedSteps,
      status: "maxStepsExceeded",
      trajectory
    })
  }

  const remaining = remainingDistance({ currentTime: time, direction, finalTime })
  const nextStepMagnitude = minimum(currentStepMagnitude, input.maxStep ?? remaining)
  const stepMagnitude = minimum(nextStepMagnitude, remaining)

  if (stepMagnitude < minimumAdaptiveStepMagnitude(time)) {
    return makeOdeResult({
      acceptedSteps,
      finalState: state,
      finalTime: time,
      functionEvaluations,
      method: "rk45",
      rejectedSteps,
      status: "stepSizeTooSmall",
      trajectory
    })
  }

  const signedStep = N.multiply(stepMagnitude, direction)
  const attempted = rk45Step(field, time, state, signedStep)
  const errorNorm = rmsScaledError({
    absoluteTolerance: input.absoluteTolerance ?? 1e-6,
    current: state,
    error: attempted.error,
    next: attempted.nextState,
    relativeTolerance: input.relativeTolerance ?? 1e-3
  })

  if (errorNorm < 1) {
    const factor = adaptiveFactor(errorNorm)
    const boundedFactor = stepRejected ? minimum(1, factor) : factor
    const nextTime = N.sum(time, signedStep)
    const nextPoint = makeTrajectoryPoint(nextTime, attempted.nextState)

    return advanceAdaptive({
      acceptedSteps: acceptedSteps + 1,
      currentStepMagnitude: N.multiply(stepMagnitude, boundedFactor),
      direction,
      field,
      finalTime,
      functionEvaluations: functionEvaluations + attempted.functionEvaluations,
      input,
      rejectedSteps,
      state: attempted.nextState,
      stepRejected: false,
      time: nextTime,
      trajectory: [...trajectory, nextPoint]
    })
  }

  return advanceAdaptive({
    acceptedSteps,
    currentStepMagnitude: N.multiply(stepMagnitude, maximum(ADAPTIVE_MIN_FACTOR, adaptiveFactor(errorNorm))),
    direction,
    field,
    finalTime,
    functionEvaluations: functionEvaluations + attempted.functionEvaluations,
    input,
    rejectedSteps: rejectedSteps + 1,
    state,
    stepRejected: true,
    time,
    trajectory
  })
}

export const solveAdaptiveRk45Internal = ({
  field,
  input
}: {
  readonly field: OdeVectorField
  readonly input: AdaptiveRk45InputType
}) => {
  const direction = directionFromInterval({
    finalTime: input.finalTime,
    initialTime: input.initialTime
  })
  const initialPoint = makeTrajectoryPoint(input.initialTime, input.initialState)

  return advanceAdaptive({
    acceptedSteps: 0,
    currentStepMagnitude: initialStepMagnitude(input),
    direction,
    field,
    finalTime: input.finalTime,
    functionEvaluations: 0,
    input,
    rejectedSteps: 0,
    state: input.initialState,
    stepRejected: false,
    time: input.initialTime,
    trajectory: [initialPoint]
  })
}
