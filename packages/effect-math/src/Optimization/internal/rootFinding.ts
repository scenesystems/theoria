/**
 * Shared nonlinear root-finding iteration kernel.
 *
 * @since 0.3.0
 * @category internal
 */
import { Match, Number as N, Option } from "effect"

import { abs } from "../../Numeric/operations.js"
import { RootFindingResult } from "../schema.js"
import type { RootFindingMethodType, RootFindingResultType, RootFindingStatusType } from "../schema.js"

const DEFAULT_ABSOLUTE_TOLERANCE = 1e-12
const DEFAULT_RELATIVE_TOLERANCE = 1e-10
const DEFAULT_MAX_ITERATIONS = 100

export type RootFindingIterationState<State> = Readonly<{
  readonly solverState: State
  readonly estimate: number
  readonly residual: number
  readonly delta: number
  readonly functionEvaluationCount: number
}>

type RootFindingContinue<State> = Readonly<{
  readonly _tag: "Continue"
  readonly nextState: RootFindingIterationState<State>
}>

type RootFindingStop<State> = Readonly<{
  readonly _tag: "Stop"
  readonly state: RootFindingIterationState<State>
  readonly status: Exclude<RootFindingStatusType, "converged" | "maxIterationsExceeded">
}>

export type RootFindingStep<State> = RootFindingContinue<State> | RootFindingStop<State>

export const convergenceScale = (estimate: number, absoluteTolerance: number, relativeTolerance: number): number =>
  N.sum(absoluteTolerance, N.multiply(relativeTolerance, abs(estimate)))

export const makeRootFindingResult = (options: {
  readonly method: RootFindingMethodType
  readonly status: RootFindingStatusType
  readonly estimate: number
  readonly residual: number
  readonly iterationCount: number
  readonly functionEvaluationCount: number
}): RootFindingResultType =>
  new RootFindingResult({
    method: options.method,
    status: options.status,
    root: options.estimate,
    residual: options.residual,
    iterationCount: options.iterationCount,
    functionEvaluationCount: options.functionEvaluationCount
  })

const isConverged = (options: {
  readonly state: RootFindingIterationState<unknown>
  readonly absoluteTolerance: number
  readonly relativeTolerance: number
}): boolean => {
  const scale = convergenceScale(options.state.estimate, options.absoluteTolerance, options.relativeTolerance)

  return options.state.residual <= scale || options.state.delta <= scale
}

export const distinctPoints = (left: number, right: number): boolean => left !== right

export const sameSign = (left: number, right: number): boolean =>
  (N.greaterThan(left, 0) && N.greaterThan(right, 0)) || (N.lessThan(left, 0) && N.lessThan(right, 0))

export const signedStep = (value: number, magnitude: number): number => value >= 0 ? magnitude : N.negate(magnitude)

export const iterateRootFinding = <State>(options: {
  readonly method: RootFindingMethodType
  readonly initialState: RootFindingIterationState<State>
  readonly absoluteTolerance?: number
  readonly relativeTolerance?: number
  readonly maxIterations?: number
  readonly advance: (state: RootFindingIterationState<State>) => RootFindingStep<State>
}): RootFindingResultType => {
  const { absoluteTolerance, relativeTolerance, maxIterations } = convergenceOptionsFromInput(options)

  const loop = (state: RootFindingIterationState<State>, iterationCount: number): RootFindingResultType =>
    Match.value(isConverged({ state, absoluteTolerance, relativeTolerance })).pipe(
      Match.when(true, () =>
        makeRootFindingResult({
          method: options.method,
          status: "converged",
          estimate: state.estimate,
          residual: state.residual,
          iterationCount,
          functionEvaluationCount: state.functionEvaluationCount
        })),
      Match.when(false, () =>
        Match.value(iterationCount >= maxIterations).pipe(
          Match.when(true, () =>
            makeRootFindingResult({
              method: options.method,
              status: "maxIterationsExceeded",
              estimate: state.estimate,
              residual: state.residual,
              iterationCount,
              functionEvaluationCount: state.functionEvaluationCount
            })),
          Match.when(false, () =>
            Match.value(options.advance(state)).pipe(
              Match.tag("Stop", (step) =>
                makeRootFindingResult({
                  method: options.method,
                  status: step.status,
                  estimate: step.state.estimate,
                  residual: step.state.residual,
                  iterationCount,
                  functionEvaluationCount: step.state.functionEvaluationCount
                })),
              Match.tag("Continue", (step) => loop(step.nextState, N.sum(iterationCount, 1))),
              Match.exhaustive
            )),
          Match.exhaustive
        )),
      Match.exhaustive
    )

  return loop(options.initialState, 0)
}

export const convergenceOptionsFromInput = (input: {
  readonly absoluteTolerance?: number
  readonly relativeTolerance?: number
  readonly maxIterations?: number
}) => ({
  ...Option.match(Option.fromNullable(input.absoluteTolerance), {
    onNone: () => ({ absoluteTolerance: DEFAULT_ABSOLUTE_TOLERANCE }),
    onSome: (absoluteTolerance) => ({ absoluteTolerance })
  }),
  ...Option.match(Option.fromNullable(input.relativeTolerance), {
    onNone: () => ({ relativeTolerance: DEFAULT_RELATIVE_TOLERANCE }),
    onSome: (relativeTolerance) => ({ relativeTolerance })
  }),
  ...Option.match(Option.fromNullable(input.maxIterations), {
    onNone: () => ({ maxIterations: DEFAULT_MAX_ITERATIONS }),
    onSome: (maxIterations) => ({ maxIterations })
  })
})
