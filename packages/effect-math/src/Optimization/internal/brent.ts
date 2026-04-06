/**
 * Brent-style bracketed root-finding kernel over scalar objectives.
 *
 * This keeps Optimization as the owner of the released bracketed solver
 * surface while using one shared convergence loop. The step rule prefers
 * a secant proposal and falls back to the bracket midpoint when the secant
 * estimate leaves the active bracket.
 *
 * @since 0.3.0
 * @category internal
 */
import { Number as N, Option } from "effect"

import { abs, EPSILON } from "../../Numeric/operations.js"
import type { BrentInputType, RootFindingResultType } from "../schema.js"
import {
  convergenceOptionsFromInput,
  iterateRootFinding,
  makeRootFindingResult,
  type RootFindingIterationState,
  type RootFindingStep,
  sameSign
} from "./rootFinding.js"

type BrentState = Readonly<{
  readonly lowerBound: number
  readonly upperBound: number
  readonly lowerValue: number
  readonly upperValue: number
}>

const midpoint = (left: number, right: number): number => N.multiply(0.5, N.sum(left, right))

const initializeState = (
  f: (x: number) => number,
  input: BrentInputType
): RootFindingIterationState<BrentState> => {
  const lowerValue = f(input.lowerBound)
  const upperValue = f(input.upperBound)

  return {
    solverState: {
      lowerBound: input.lowerBound,
      upperBound: input.upperBound,
      lowerValue,
      upperValue
    },
    estimate: input.upperBound,
    residual: abs(upperValue),
    delta: abs(N.subtract(input.upperBound, input.lowerBound)),
    functionEvaluationCount: 2
  }
}

const secantCandidate = (state: BrentState): number =>
  N.subtract(
    state.upperBound,
    N.unsafeDivide(
      N.multiply(state.upperValue, N.subtract(state.upperBound, state.lowerBound)),
      N.subtract(state.upperValue, state.lowerValue)
    )
  )

const advanceBrent = (
  f: (x: number) => number,
  state: RootFindingIterationState<BrentState>
): RootFindingStep<BrentState> => {
  const denominator = N.subtract(state.solverState.upperValue, state.solverState.lowerValue)
  const midpointValue = midpoint(state.solverState.lowerBound, state.solverState.upperBound)
  const candidate = abs(denominator) <= EPSILON
    ? midpointValue
    : (() => {
      const estimate = secantCandidate(state.solverState)

      return estimate > state.solverState.lowerBound && estimate < state.solverState.upperBound
        ? estimate
        : midpointValue
    })()
  const candidateValue = f(candidate)
  const nextBracket = sameSign(state.solverState.lowerValue, candidateValue)
    ? {
      lowerBound: candidate,
      lowerValue: candidateValue,
      upperBound: state.solverState.upperBound,
      upperValue: state.solverState.upperValue
    }
    : {
      lowerBound: state.solverState.lowerBound,
      lowerValue: state.solverState.lowerValue,
      upperBound: candidate,
      upperValue: candidateValue
    }

  return {
    _tag: "Continue",
    nextState: {
      solverState: nextBracket,
      estimate: candidate,
      residual: abs(candidateValue),
      delta: abs(N.subtract(nextBracket.upperBound, nextBracket.lowerBound)),
      functionEvaluationCount: N.sum(state.functionEvaluationCount, 1)
    }
  }
}

export const solveBrent = (
  f: (x: number) => number,
  input: BrentInputType
): RootFindingResultType => {
  const initialState = initializeState(f, input)
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

  return sameSign(initialState.solverState.lowerValue, initialState.solverState.upperValue)
    ? makeRootFindingResult({
      method: "brent",
      status: "invalidBracket",
      estimate: initialState.estimate,
      residual: initialState.residual,
      iterationCount: 0,
      functionEvaluationCount: initialState.functionEvaluationCount
    })
    : iterateRootFinding({
      method: "brent",
      initialState,
      ...convergenceOptions,
      advance: (state) => advanceBrent(f, state)
    })
}
