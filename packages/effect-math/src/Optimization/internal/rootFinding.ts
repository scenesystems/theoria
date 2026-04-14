/**
 * Shared nonlinear root-finding iteration kernel.
 *
 * @since 0.3.0
 * @category internal
 */
import { Match, Number as N, Option } from "effect"
import * as Arr from "effect/Array"

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

type RootFindingRunningState<State> = Readonly<{
  readonly _tag: "Running"
  readonly iterationCount: number
  readonly state: RootFindingIterationState<State>
}>

type RootFindingFinishedState = Readonly<{
  readonly _tag: "Finished"
  readonly result: RootFindingResultType
}>

type RootFindingLoopState<State> = RootFindingRunningState<State> | RootFindingFinishedState

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

const runningLoopState = <State>(options: {
  readonly iterationCount: number
  readonly state: RootFindingIterationState<State>
}): RootFindingRunningState<State> => ({
  _tag: "Running",
  iterationCount: options.iterationCount,
  state: options.state
})

const finishedLoopState = (result: RootFindingResultType): RootFindingFinishedState => ({
  _tag: "Finished",
  result
})

const duplicateLoopState = <State>(
  state: RootFindingLoopState<State>
): readonly [RootFindingLoopState<State>, RootFindingLoopState<State>] => [state, state]

const advanceRootFindingLoop = <State>(options: {
  readonly method: RootFindingMethodType
  readonly absoluteTolerance: number
  readonly relativeTolerance: number
  readonly maxIterations: number
  readonly advance: (state: RootFindingIterationState<State>) => RootFindingStep<State>
  readonly loopState: RootFindingLoopState<State>
}): RootFindingLoopState<State> =>
  Match.value(options.loopState).pipe(
    Match.tag("Finished", () => options.loopState),
    Match.tag("Running", ({ iterationCount, state }) =>
      Match.value(
        isConverged({
          state,
          absoluteTolerance: options.absoluteTolerance,
          relativeTolerance: options.relativeTolerance
        })
      ).pipe(
        Match.when(true, () =>
          finishedLoopState(
            makeRootFindingResult({
              method: options.method,
              status: "converged",
              estimate: state.estimate,
              residual: state.residual,
              iterationCount,
              functionEvaluationCount: state.functionEvaluationCount
            })
          )),
        Match.when(false, () =>
          Match.value(iterationCount >= options.maxIterations).pipe(
            Match.when(true, () =>
              finishedLoopState(
                makeRootFindingResult({
                  method: options.method,
                  status: "maxIterationsExceeded",
                  estimate: state.estimate,
                  residual: state.residual,
                  iterationCount,
                  functionEvaluationCount: state.functionEvaluationCount
                })
              )),
            Match.when(false, () =>
              Match.value(options.advance(state)).pipe(
                Match.tag("Stop", (step) =>
                  finishedLoopState(
                    makeRootFindingResult({
                      method: options.method,
                      status: step.status,
                      estimate: step.state.estimate,
                      residual: step.state.residual,
                      iterationCount,
                      functionEvaluationCount: step.state.functionEvaluationCount
                    })
                  )),
                Match.tag("Continue", (step) =>
                  runningLoopState({
                    iterationCount: N.sum(iterationCount, 1),
                    state: step.nextState
                  })),
                Match.exhaustive
              )),
            Match.exhaustive
          )),
        Match.exhaustive
      )),
    Match.exhaustive
  )

const unfoldRootFindingLoopState = <State>(options: {
  readonly method: RootFindingMethodType
  readonly absoluteTolerance: number
  readonly relativeTolerance: number
  readonly maxIterations: number
  readonly advance: (state: RootFindingIterationState<State>) => RootFindingStep<State>
  readonly loopState: RootFindingLoopState<State>
}): Option.Option<readonly [RootFindingLoopState<State>, RootFindingLoopState<State>]> =>
  Match.value(options.loopState).pipe(
    Match.tag("Finished", () => Option.none()),
    Match.tag("Running", () => {
      const nextLoopState = advanceRootFindingLoop(options)

      return Option.some(duplicateLoopState(nextLoopState))
    }),
    Match.exhaustive
  )

const makeRunningLoopFallbackResult = <State>(options: {
  readonly method: RootFindingMethodType
  readonly loopState: RootFindingRunningState<State>
}): RootFindingResultType =>
  makeRootFindingResult({
    method: options.method,
    status: "maxIterationsExceeded",
    estimate: options.loopState.state.estimate,
    residual: options.loopState.state.residual,
    iterationCount: options.loopState.iterationCount,
    functionEvaluationCount: options.loopState.state.functionEvaluationCount
  })

export const iterateRootFinding = <State>(options: {
  readonly method: RootFindingMethodType
  readonly initialState: RootFindingIterationState<State>
  readonly absoluteTolerance?: number
  readonly relativeTolerance?: number
  readonly maxIterations?: number
  readonly advance: (state: RootFindingIterationState<State>) => RootFindingStep<State>
}): RootFindingResultType => {
  const { absoluteTolerance, relativeTolerance, maxIterations } = convergenceOptionsFromInput(options)
  const loopStates = Arr.unfold<RootFindingLoopState<State>, RootFindingLoopState<State>>(
    runningLoopState({
      iterationCount: 0,
      state: options.initialState
    }),
    (loopState) =>
      unfoldRootFindingLoopState({
        method: options.method,
        absoluteTolerance,
        relativeTolerance,
        maxIterations,
        advance: options.advance,
        loopState
      })
  )
  const finalLoopState = loopStates[loopStates.length - 1]!

  return Match.value(finalLoopState).pipe(
    Match.tag("Finished", ({ result }) => result),
    Match.tag("Running", (loopState) =>
      makeRunningLoopFallbackResult({
        method: options.method,
        loopState
      })),
    Match.exhaustive
  )
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
