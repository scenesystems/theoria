/**
 * Brent bracketed root-finding kernel over scalar objectives.
 *
 * This keeps Optimization as the owner of the released bracketed solver
 * surface while using one shared convergence loop. Each step follows the
 * classic Brent strategy: maintain a valid bracket, prefer inverse quadratic
 * interpolation when it is safe, and fall back to bisection when it is not.
 *
 * @since 0.3.0
 * @category internal
 */
import { Number as N, Option } from "effect"

import { abs } from "../../Numeric/operations.js"
import type { BrentInputType, RootFindingResultType } from "../schema.js"
import {
  convergenceOptionsFromInput,
  convergenceScale,
  distinctPoints,
  iterateRootFinding,
  makeRootFindingResult,
  type RootFindingIterationState,
  type RootFindingStep,
  sameSign,
  signedStep
} from "./rootFinding.js"

type BrentState = Readonly<{
  readonly previousPoint: number
  readonly currentPoint: number
  readonly bracketPoint: number
  readonly previousValue: number
  readonly currentValue: number
  readonly bracketValue: number
  readonly previousStep: number
  readonly currentStep: number
}>

const bracketWidth = (state: BrentState): number => abs(N.subtract(state.bracketPoint, state.currentPoint))

const halfInterval = (state: BrentState): number => N.multiply(0.5, N.subtract(state.bracketPoint, state.currentPoint))

const toIterationState = (
  solverState: BrentState,
  functionEvaluationCount: number
): RootFindingIterationState<BrentState> => ({
  solverState,
  estimate: solverState.currentPoint,
  residual: abs(solverState.currentValue),
  delta: bracketWidth(solverState),
  functionEvaluationCount
})

const activateBracket = (state: BrentState): BrentState =>
  state.previousValue !== 0 && state.currentValue !== 0 && !sameSign(state.previousValue, state.currentValue)
    ? {
      ...state,
      bracketPoint: state.previousPoint,
      bracketValue: state.previousValue,
      previousStep: N.subtract(state.currentPoint, state.previousPoint),
      currentStep: N.subtract(state.currentPoint, state.previousPoint)
    }
    : state

const prioritizeLowerResidual = (state: BrentState): BrentState =>
  abs(state.bracketValue) < abs(state.currentValue)
    ? {
      previousPoint: state.currentPoint,
      currentPoint: state.bracketPoint,
      bracketPoint: state.currentPoint,
      previousValue: state.currentValue,
      currentValue: state.bracketValue,
      bracketValue: state.currentValue,
      previousStep: state.previousStep,
      currentStep: state.currentStep
    }
    : state

const normalizeBrentState = (state: BrentState): BrentState => prioritizeLowerResidual(activateBracket(state))

const divideOption = (numerator: number, denominator: number): Option.Option<number> =>
  denominator === 0 ? Option.none() : Option.some(N.unsafeDivide(numerator, denominator))

const initializeState = (
  f: (x: number) => number,
  input: BrentInputType
): RootFindingIterationState<BrentState> => {
  const lowerValue = f(input.lowerBound)
  const upperValue = f(input.upperBound)

  return toIterationState(
    normalizeBrentState({
      previousPoint: input.lowerBound,
      currentPoint: input.upperBound,
      bracketPoint: input.lowerBound,
      previousValue: lowerValue,
      currentValue: upperValue,
      bracketValue: lowerValue,
      previousStep: N.subtract(input.upperBound, input.lowerBound),
      currentStep: N.subtract(input.upperBound, input.lowerBound)
    }),
    2
  )
}

const secantStep = (state: BrentState): Option.Option<number> =>
  divideOption(
    N.multiply(N.negate(state.currentValue), N.subtract(state.currentPoint, state.previousPoint)),
    N.subtract(state.currentValue, state.previousValue)
  )

const inverseQuadraticStep = (state: BrentState): Option.Option<number> =>
  Option.all({
    previousSlope: divideOption(
      N.subtract(state.previousValue, state.currentValue),
      N.subtract(state.previousPoint, state.currentPoint)
    ),
    bracketSlope: divideOption(
      N.subtract(state.bracketValue, state.currentValue),
      N.subtract(state.bracketPoint, state.currentPoint)
    )
  }).pipe(
    Option.flatMap(({ previousSlope, bracketSlope }) =>
      divideOption(
        N.multiply(
          N.negate(state.currentValue),
          N.subtract(
            N.multiply(state.bracketValue, bracketSlope),
            N.multiply(state.previousValue, previousSlope)
          )
        ),
        N.multiply(N.multiply(bracketSlope, previousSlope), N.subtract(state.bracketValue, state.previousValue))
      )
    )
  )

const interpolationStep = (state: BrentState): Option.Option<number> =>
  distinctPoints(state.previousPoint, state.bracketPoint) ? inverseQuadraticStep(state) : secantStep(state)

const advanceBrent = (
  f: (x: number) => number,
  absoluteTolerance: number,
  relativeTolerance: number,
  state: RootFindingIterationState<BrentState>
): RootFindingStep<BrentState> => {
  const solverState = normalizeBrentState(state.solverState)
  const bisectStep = halfInterval(solverState)
  const stepTolerance = N.multiply(
    0.5,
    convergenceScale(solverState.currentPoint, absoluteTolerance, relativeTolerance)
  )
  const acceptedInterpolation = N.greaterThan(abs(solverState.previousStep), stepTolerance) &&
      N.lessThan(abs(solverState.currentValue), abs(solverState.previousValue))
    ? interpolationStep(solverState).pipe(
      Option.flatMap((trialStep) =>
        N.lessThan(
            N.multiply(2, abs(trialStep)),
            N.min(abs(solverState.previousStep), N.subtract(N.multiply(3, abs(bisectStep)), stepTolerance))
          )
          ? Option.some(trialStep)
          : Option.none()
      )
    )
    : Option.none()
  const nextPreviousStep = Option.match(acceptedInterpolation, {
    onNone: () => bisectStep,
    onSome: () => solverState.currentStep
  })
  const nextCurrentStep = Option.getOrElse(acceptedInterpolation, () => bisectStep)
  const candidate = N.sum(
    solverState.currentPoint,
    N.greaterThan(abs(nextCurrentStep), stepTolerance)
      ? nextCurrentStep
      : signedStep(bisectStep, stepTolerance)
  )
  const candidateValue = f(candidate)
  const nextSolverState = normalizeBrentState({
    previousPoint: solverState.currentPoint,
    currentPoint: candidate,
    bracketPoint: solverState.bracketPoint,
    previousValue: solverState.currentValue,
    currentValue: candidateValue,
    bracketValue: solverState.bracketValue,
    previousStep: nextPreviousStep,
    currentStep: nextCurrentStep
  })

  return {
    _tag: "Continue",
    nextState: toIterationState(nextSolverState, N.sum(state.functionEvaluationCount, 1))
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

  return sameSign(initialState.solverState.previousValue, initialState.solverState.currentValue)
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
      advance: (state) =>
        advanceBrent(f, convergenceOptions.absoluteTolerance, convergenceOptions.relativeTolerance, state)
    })
}
