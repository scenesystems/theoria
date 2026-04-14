/**
 * Newton-Raphson root-finding kernel over scalar objectives.
 *
 * @since 0.3.0
 * @category internal
 */
import { Number as N, Option } from "effect"

import { abs, EPSILON } from "../../Numeric/operations.js"
import type { NewtonRaphsonInputType, RootFindingResultType } from "../schema.js"
import {
  convergenceOptionsFromInput,
  iterateRootFinding,
  type RootFindingIterationState,
  type RootFindingStep
} from "./rootFinding.js"

type NewtonRaphsonState = Readonly<{
  readonly estimate: number
  readonly value: number
}>

const initializeState = (
  f: (x: number) => number,
  input: NewtonRaphsonInputType
): RootFindingIterationState<NewtonRaphsonState> => {
  const value = f(input.initialGuess)

  return {
    solverState: {
      estimate: input.initialGuess,
      value
    },
    estimate: input.initialGuess,
    residual: abs(value),
    delta: N.sum(abs(input.initialGuess), 1),
    functionEvaluationCount: 1
  }
}

const advanceNewtonRaphson = (
  f: (x: number) => number,
  derivative: (x: number) => number,
  state: RootFindingIterationState<NewtonRaphsonState>
): RootFindingStep<NewtonRaphsonState> => {
  const derivativeValue = derivative(state.solverState.estimate)

  return abs(derivativeValue) <= EPSILON
    ? {
      _tag: "Stop",
      status: "zeroDerivative",
      state
    }
    : (() => {
      const nextEstimate = N.subtract(
        state.solverState.estimate,
        N.unsafeDivide(state.solverState.value, derivativeValue)
      )
      const nextValue = f(nextEstimate)

      const nextStep: RootFindingStep<NewtonRaphsonState> = {
        _tag: "Continue",
        nextState: {
          solverState: {
            estimate: nextEstimate,
            value: nextValue
          },
          estimate: nextEstimate,
          residual: abs(nextValue),
          delta: abs(N.subtract(nextEstimate, state.solverState.estimate)),
          functionEvaluationCount: N.sum(state.functionEvaluationCount, 1)
        }
      }

      return nextStep
    })()
}

export const solveNewtonRaphson = (
  f: (x: number) => number,
  derivative: (x: number) => number,
  input: NewtonRaphsonInputType
): RootFindingResultType => {
  const convergenceOptions = convergenceOptionsFromInput({
    ...Option.match(Option.fromNullable(input.absoluteTolerance), {
      onNone: () => ({}),
      onSome: (absoluteTolerance) => ({ absoluteTolerance })
    }),
    ...Option.match(Option.fromNullable(input.relativeTolerance), {
      onNone: () => ({}),
      onSome: (relativeTolerance) => ({ relativeTolerance })
    }),
    ...Option.match(Option.fromNullable(input.maxIterations), {
      onNone: () => ({}),
      onSome: (maxIterations) => ({ maxIterations })
    })
  })

  return iterateRootFinding({
    method: "newtonRaphson",
    initialState: initializeState(f, input),
    ...convergenceOptions,
    advance: (state) => advanceNewtonRaphson(f, derivative, state)
  })
}
