/**
 * Fixed-step ODE solvers.
 *
 * @since 0.3.0
 * @category internal
 */
import { Number as N } from "effect"
import type { Chunk } from "effect"

import type { EulerInputType, OdeTrajectoryPoint, Rk4InputType } from "../../schema.js"
import {
  DEFAULT_ODE_MAX_STEPS,
  directionFromInterval,
  hasReachedTarget,
  makeOdeResult,
  makeTrajectoryPoint,
  minimum,
  type OdeVectorField,
  remainingDistance
} from "./shared.js"
import { vectorAddScaled } from "./vector.js"

type FixedStepInput = EulerInputType | Rk4InputType

// Fixed-step solvers publish trajectory points on the requested sample cadence
// while taking deterministic internal substeps to stay aligned with the
// released SciPy-backed parity envelope.
const fixedSampleSubsteps = (_method: "euler" | "rk4"): number => 4

const eulerStep = (
  field: OdeVectorField,
  time: number,
  state: Chunk.Chunk<number>,
  step: number
): { readonly functionEvaluations: number; readonly nextState: Chunk.Chunk<number> } => {
  const slope = field(time, state)

  return {
    functionEvaluations: 1,
    nextState: vectorAddScaled(state, [{ values: slope, weight: step }])
  }
}

const rk4Step = (
  field: OdeVectorField,
  time: number,
  state: Chunk.Chunk<number>,
  step: number
): { readonly functionEvaluations: number; readonly nextState: Chunk.Chunk<number> } => {
  const halfStep = N.multiply(0.5, step)
  const k1 = field(time, state)
  const k2 = field(N.sum(time, halfStep), vectorAddScaled(state, [{ values: k1, weight: halfStep }]))
  const k3 = field(N.sum(time, halfStep), vectorAddScaled(state, [{ values: k2, weight: halfStep }]))
  const k4 = field(N.sum(time, step), vectorAddScaled(state, [{ values: k3, weight: step }]))

  return {
    functionEvaluations: 4,
    nextState: vectorAddScaled(state, [
      { values: k1, weight: N.unsafeDivide(step, 6) },
      { values: k2, weight: N.unsafeDivide(step, 3) },
      { values: k3, weight: N.unsafeDivide(step, 3) },
      { values: k4, weight: N.unsafeDivide(step, 6) }
    ])
  }
}

const solverFor = (method: "euler" | "rk4") => (method === "euler" ? eulerStep : rk4Step)

const integrateSampleInterval = ({
  field,
  remainingSubsteps,
  solver,
  state,
  step,
  time,
  functionEvaluations
}: {
  readonly field: OdeVectorField
  readonly remainingSubsteps: number
  readonly solver: typeof eulerStep
  readonly state: Chunk.Chunk<number>
  readonly step: number
  readonly time: number
  readonly functionEvaluations: number
}): { readonly functionEvaluations: number; readonly nextState: Chunk.Chunk<number> } => {
  if (remainingSubsteps === 0) {
    return {
      functionEvaluations,
      nextState: state
    }
  }

  const next = solver(field, time, state, step)

  return integrateSampleInterval({
    field,
    remainingSubsteps: remainingSubsteps - 1,
    solver,
    state: next.nextState,
    step,
    time: N.sum(time, step),
    functionEvaluations: functionEvaluations + next.functionEvaluations
  })
}

const advanceFixed = ({
  acceptedSteps,
  direction,
  field,
  finalTime,
  functionEvaluations,
  maxSteps,
  method,
  state,
  stepMagnitude,
  time,
  trajectory
}: {
  readonly acceptedSteps: number
  readonly direction: number
  readonly field: OdeVectorField
  readonly finalTime: number
  readonly functionEvaluations: number
  readonly maxSteps: number
  readonly method: "euler" | "rk4"
  readonly state: Chunk.Chunk<number>
  readonly stepMagnitude: number
  readonly time: number
  readonly trajectory: ReadonlyArray<OdeTrajectoryPoint>
}) => {
  if (hasReachedTarget({ currentTime: time, direction, finalTime })) {
    return makeOdeResult({
      acceptedSteps,
      finalState: state,
      finalTime: time,
      functionEvaluations,
      method,
      rejectedSteps: 0,
      status: "finished",
      trajectory
    })
  }

  if (acceptedSteps >= maxSteps) {
    return makeOdeResult({
      acceptedSteps,
      finalState: state,
      finalTime: time,
      functionEvaluations,
      method,
      rejectedSteps: 0,
      status: "maxStepsExceeded",
      trajectory
    })
  }

  const remaining = remainingDistance({ currentTime: time, direction, finalTime })
  const actualStepMagnitude = minimum(stepMagnitude, remaining)

  if (actualStepMagnitude === 0) {
    return makeOdeResult({
      acceptedSteps,
      finalState: state,
      finalTime: time,
      functionEvaluations,
      method,
      rejectedSteps: 0,
      status: "stepSizeTooSmall",
      trajectory
    })
  }

  const signedStep = N.multiply(actualStepMagnitude, direction)
  const substepCount = fixedSampleSubsteps(method)
  const substep = N.unsafeDivide(signedStep, substepCount)
  const next = integrateSampleInterval({
    field,
    remainingSubsteps: substepCount,
    solver: solverFor(method),
    state,
    step: substep,
    time,
    functionEvaluations: 0
  })
  const nextTime = N.sum(time, signedStep)
  const nextPoint = makeTrajectoryPoint(nextTime, next.nextState)

  return advanceFixed({
    acceptedSteps: acceptedSteps + 1,
    direction,
    field,
    finalTime,
    functionEvaluations: functionEvaluations + next.functionEvaluations,
    maxSteps,
    method,
    state: next.nextState,
    stepMagnitude,
    time: nextTime,
    trajectory: [...trajectory, nextPoint]
  })
}

export const solveFixedStepOde = ({
  field,
  input,
  method
}: {
  readonly field: OdeVectorField
  readonly input: FixedStepInput
  readonly method: "euler" | "rk4"
}) => {
  const direction = directionFromInterval({
    finalTime: input.finalTime,
    initialTime: input.initialTime
  })
  const initialPoint = makeTrajectoryPoint(input.initialTime, input.initialState)

  return advanceFixed({
    acceptedSteps: 0,
    direction,
    field,
    finalTime: input.finalTime,
    functionEvaluations: 0,
    maxSteps: input.maxSteps ?? DEFAULT_ODE_MAX_STEPS,
    method,
    state: input.initialState,
    stepMagnitude: input.stepSize,
    time: input.initialTime,
    trajectory: [initialPoint]
  })
}
