/**
 * Shared objective configuration and trial extraction for the effect-search demo.
 *
 * Provides the 2D quadratic objective, search bounds, optimum, and trial
 * extraction utilities — all as pure functions shared by the server demo
 * and the client-side optimization animation.
 *
 * @since 0.1.0
 * @module
 */
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

// ---------------------------------------------------------------------------
// Search configuration
// ---------------------------------------------------------------------------

export const searchBounds: Readonly<{
  readonly xMin: number
  readonly xMax: number
  readonly yMin: number
  readonly yMax: number
}> = {
  xMin: -5,
  xMax: 5,
  yMin: -5,
  yMax: 5
}

export type Config2D = { readonly x: number; readonly y: number }

export const optimum: Config2D = { x: 2, y: -1 }

export const objectiveExpression = "(x − 2)² + (y + 1)²"

export const defaultTrialBudget = 30

export const defaultSamplerSeed = 42

// ---------------------------------------------------------------------------
// Objective function (pure)
// ---------------------------------------------------------------------------

export const objectiveAt = (config: Config2D): number => (config.x - optimum.x) ** 2 + (config.y - optimum.y) ** 2

export const distanceToOptimum = (config: Config2D): number =>
  Math.sqrt((config.x - optimum.x) ** 2 + (config.y - optimum.y) ** 2)

// ---------------------------------------------------------------------------
// Gain computation
// ---------------------------------------------------------------------------

export const gain = (randomBestValue: number, tpeBestValue: number): number => randomBestValue - tpeBestValue

export const gainPercent = (randomBestValue: number, tpeBestValue: number): number => {
  const denominator = Math.abs(randomBestValue) < 1e-9 ? 1 : Math.abs(randomBestValue)
  return (gain(randomBestValue, tpeBestValue) / denominator) * 100
}

// ---------------------------------------------------------------------------
// Trial extraction
// ---------------------------------------------------------------------------

export type TrialPoint = {
  readonly x: number
  readonly y: number
  readonly value: number
  readonly index: number
}

type TrialState =
  | { readonly _tag: string }
  | { readonly _tag: string; readonly value: number | ReadonlyArray<number> }

type TrialSnapshot = {
  readonly config: Config2D
  readonly state: TrialState
}

const emptyTrialPoints: ReadonlyArray<TrialPoint> = []

const stateValue = (state: TrialState): Option.Option<number> =>
  "value" in state
    ? typeof state.value === "number"
      ? Option.some(state.value)
      : Option.fromNullable(state.value.at(0))
    : Option.none<number>()

export const extractTrialPoints = (trials: ReadonlyArray<TrialSnapshot>): ReadonlyArray<TrialPoint> =>
  Arr.reduce(
    trials,
    emptyTrialPoints,
    (acc, trial, index) =>
      Option.match(stateValue(trial.state), {
        onNone: () => acc,
        onSome: (value) => Arr.append(acc, { x: trial.config.x, y: trial.config.y, value, index })
      })
  )

const appendBest = (history: ReadonlyArray<number>, value: number): ReadonlyArray<number> => {
  const nextBest = Option.match(Option.fromNullable(history.at(-1)), {
    onNone: () => value,
    onSome: (previousBest) => Math.min(previousBest, value)
  })
  return [...history, nextBest]
}

export const bestHistory = (trials: ReadonlyArray<TrialSnapshot>): ReadonlyArray<number> =>
  trials.reduce<ReadonlyArray<number>>((history, trial) =>
    Option.match(stateValue(trial.state), {
      onNone: () => history,
      onSome: (nextValue) => appendBest(history, nextValue)
    }), [])

export const bestTrialPoint = (trials: ReadonlyArray<TrialPoint>): Option.Option<TrialPoint> =>
  Arr.reduce(
    trials,
    Option.none<TrialPoint>(),
    (best, trial) =>
      Option.match(best, {
        onNone: () => Option.some(trial),
        onSome: (currentBest) => Option.some(trial.value < currentBest.value ? trial : currentBest)
      })
  )
