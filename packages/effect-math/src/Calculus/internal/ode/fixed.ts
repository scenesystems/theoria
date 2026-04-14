/**
 * Fixed-step ODE solvers.
 *
 * @since 0.3.0
 * @category internal
 */
import { Chunk, Number as N, Option } from "effect"
import * as Arr from "effect/Array"

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

type FixedAdvanceState = Readonly<{
  readonly acceptedSteps: number
  readonly done: boolean
  readonly functionEvaluations: number
  readonly state: Chunk.Chunk<number>
  readonly status: "finished" | "maxStepsExceeded" | "stepSizeTooSmall"
  readonly time: number
  readonly trajectory: Chunk.Chunk<OdeTrajectoryPoint>
}>

type SampleIntervalState = Readonly<{
  readonly currentState: Chunk.Chunk<number>
  readonly currentTime: number
  readonly functionEvaluations: number
  readonly remainingSubsteps: number
}>

const duplicateState = <State>(state: State): readonly [State, State] => [state, state]

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

const advanceFixedState = ({
  direction,
  field,
  finalTime,
  maxSteps,
  method,
  stepMagnitude,
  state
}: {
  readonly direction: number
  readonly field: OdeVectorField
  readonly finalTime: number
  readonly maxSteps: number
  readonly method: "euler" | "rk4"
  readonly stepMagnitude: number
  readonly state: FixedAdvanceState
}): FixedAdvanceState => {
  if (hasReachedTarget({ currentTime: state.time, direction, finalTime })) {
    return {
      ...state,
      done: true,
      status: "finished"
    }
  }

  if (state.acceptedSteps >= maxSteps) {
    return {
      ...state,
      done: true,
      status: "maxStepsExceeded"
    }
  }

  const remaining = remainingDistance({ currentTime: state.time, direction, finalTime })
  const actualStepMagnitude = minimum(stepMagnitude, remaining)

  if (actualStepMagnitude === 0) {
    return {
      ...state,
      done: true,
      status: "stepSizeTooSmall"
    }
  }

  const signedStep = N.multiply(actualStepMagnitude, direction)
  const substepCount = fixedSampleSubsteps(method)
  const substep = N.unsafeDivide(signedStep, substepCount)
  const next = integrateSampleInterval({
    field,
    remainingSubsteps: substepCount,
    solver: solverFor(method),
    state: state.state,
    step: substep,
    time: state.time,
    functionEvaluations: 0
  })
  const nextTime = N.sum(state.time, signedStep)

  return {
    acceptedSteps: N.sum(state.acceptedSteps, 1),
    done: false,
    functionEvaluations: N.sum(state.functionEvaluations, next.functionEvaluations),
    state: next.nextState,
    status: "finished",
    time: nextTime,
    trajectory: Chunk.append(state.trajectory, makeTrajectoryPoint(nextTime, next.nextState))
  }
}

const unfoldFixedState = ({
  direction,
  field,
  finalTime,
  maxSteps,
  method,
  stepMagnitude,
  state
}: {
  readonly direction: number
  readonly field: OdeVectorField
  readonly finalTime: number
  readonly maxSteps: number
  readonly method: "euler" | "rk4"
  readonly stepMagnitude: number
  readonly state: FixedAdvanceState
}): Option.Option<readonly [FixedAdvanceState, FixedAdvanceState]> =>
  state.done
    ? Option.none()
    : (() => {
      const nextState = advanceFixedState({
        direction,
        field,
        finalTime,
        maxSteps,
        method,
        stepMagnitude,
        state
      })

      return Option.some(duplicateState(nextState))
    })()

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
  const initialState: SampleIntervalState = {
    currentState: state,
    currentTime: time,
    functionEvaluations,
    remainingSubsteps
  }
  const result = Arr.reduce(
    Arr.range(0, remainingSubsteps - 1),
    initialState,
    ({ currentState, currentTime, functionEvaluations, remainingSubsteps }) => {
      const next = solver(field, currentTime, currentState, step)

      return {
        currentState: next.nextState,
        currentTime: N.sum(currentTime, step),
        functionEvaluations: N.sum(functionEvaluations, next.functionEvaluations),
        remainingSubsteps: N.subtract(remainingSubsteps, 1)
      }
    }
  )

  return {
    functionEvaluations: result.functionEvaluations,
    nextState: result.currentState
  }
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
  const initialState: FixedAdvanceState = {
    acceptedSteps,
    done: false,
    functionEvaluations,
    state,
    status: "finished",
    time,
    trajectory: Chunk.fromIterable(trajectory)
  }
  const advancedStates = Arr.unfold(initialState, (currentState) =>
    unfoldFixedState({
      direction,
      field,
      finalTime,
      maxSteps,
      method,
      stepMagnitude,
      state: currentState
    }))
  const finalState = advancedStates[advancedStates.length - 1]!

  return makeOdeResult({
    acceptedSteps: finalState.acceptedSteps,
    finalState: finalState.state,
    finalTime: finalState.time,
    functionEvaluations: finalState.functionEvaluations,
    method,
    rejectedSteps: 0,
    status: finalState.status,
    trajectory: Chunk.toReadonlyArray(finalState.trajectory)
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
