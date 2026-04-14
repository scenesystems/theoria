/**
 * Secant root-finding kernel over scalar objectives.
 *
 * @since 0.3.0
 * @category internal
 */
import { Number as N, Option } from "effect"

import { abs, EPSILON } from "../../Numeric/operations.js"
import type { RootFindingResultType, SecantInputType } from "../schema.js"
import {
  convergenceOptionsFromInput,
  iterateRootFinding,
  type RootFindingIterationState,
  type RootFindingStep
} from "./rootFinding.js"

type SecantState = Readonly<{
  readonly previousEstimate: number
  readonly previousValue: number
  readonly currentEstimate: number
  readonly currentValue: number
}>

const initializeState = (
  f: (x: number) => number,
  input: SecantInputType
): RootFindingIterationState<SecantState> => {
  const previousValue = f(input.previousEstimate)
  const currentValue = f(input.currentEstimate)

  return {
    solverState: {
      previousEstimate: input.previousEstimate,
      previousValue,
      currentEstimate: input.currentEstimate,
      currentValue
    },
    estimate: input.currentEstimate,
    residual: abs(currentValue),
    delta: abs(N.subtract(input.currentEstimate, input.previousEstimate)),
    functionEvaluationCount: 2
  }
}

const advanceSecant = (
  f: (x: number) => number,
  state: RootFindingIterationState<SecantState>
): RootFindingStep<SecantState> => {
  const denominator = N.subtract(state.solverState.currentValue, state.solverState.previousValue)

  return abs(denominator) <= EPSILON
    ? {
      _tag: "Stop",
      status: "zeroDerivative",
      state
    }
    : (() => {
      const nextEstimate = N.subtract(
        state.solverState.currentEstimate,
        N.unsafeDivide(
          N.multiply(
            state.solverState.currentValue,
            N.subtract(state.solverState.currentEstimate, state.solverState.previousEstimate)
          ),
          denominator
        )
      )
      const nextValue = f(nextEstimate)

      const nextStep: RootFindingStep<SecantState> = {
        _tag: "Continue",
        nextState: {
          solverState: {
            previousEstimate: state.solverState.currentEstimate,
            previousValue: state.solverState.currentValue,
            currentEstimate: nextEstimate,
            currentValue: nextValue
          },
          estimate: nextEstimate,
          residual: abs(nextValue),
          delta: abs(N.subtract(nextEstimate, state.solverState.currentEstimate)),
          functionEvaluationCount: N.sum(state.functionEvaluationCount, 1)
        }
      }

      return nextStep
    })()
}

export const solveSecant = (
  f: (x: number) => number,
  input: SecantInputType
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
    method: "secant",
    initialState: initializeState(f, input),
    ...convergenceOptions,
    advance: (state) => advanceSecant(f, state)
  })
}
