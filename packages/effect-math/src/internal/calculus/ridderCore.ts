/**
 * Ridder extrapolation core.
 *
 * @since 0.1.0
 * @category internal
 */
import { Array, Boolean, Data, Iterable, MutableRef, Number, Option, Schema } from "effect"

import type { DerivativeLimitEstimate, RidderMethodInput } from "../../Calculus.js"
import * as Numeric from "../../Numeric.js"

class NormalizedRidderConfig extends Data.Class<{
  readonly initialStep: number
  readonly contractionFactor: number
  readonly maxIterations: number
  readonly absoluteTolerance: number
  readonly relativeTolerance: number
  readonly minimumStep: number
  readonly safetyFactor: number
}> {}

const defaultConfig = new NormalizedRidderConfig({
  initialStep: 1e-2,
  contractionFactor: 1.4,
  maxIterations: 12,
  absoluteTolerance: 1e-12,
  relativeTolerance: 1e-10,
  minimumStep: 1e-14,
  safetyFactor: 2.5
})

const positiveInfinity = Number.unsafeDivide(1, 0)

/**
 * Produces one central-difference estimate for a positive step.
 *
 * @since 0.1.0
 * @category internal
 */
export type StepKernel = (step: number) => number

/**
 * Carries a step estimate together with immutable callback state.
 *
 * @since 0.1.0
 * @category internal
 */
export class StatefulStepResult<State> extends Data.Class<{
  readonly value: number
  readonly state: State
}> {}

/**
 * Produces one estimate while threading immutable callback state.
 *
 * @since 0.1.0
 * @category internal
 */
export type StatefulStepKernel<State> = (step: number, state: State) => StatefulStepResult<State>

/**
 * Carries the selected estimate and final callback state.
 *
 * @since 0.1.0
 * @category internal
 */
export class StatefulRidderResult<State> extends Data.Class<{
  readonly estimate: DerivativeLimitEstimate
  readonly state: State
}> {}

const isFinite = Numeric.isFinite
const isInteger = Schema.is(Schema.Int)

const isFinitePositive = (value: number): boolean => Boolean.and(isFinite(value), Number.greaterThan(value, 0))

const isFiniteGreaterThanOne = (value: number): boolean => Boolean.and(isFinite(value), Number.greaterThan(value, 1))

const isPositiveInteger = (value: number): boolean => Boolean.and(isInteger(value), Number.greaterThan(value, 0))

const selectOrDefault = (
  value: Option.Option<number>,
  isValid: (candidate: number) => boolean,
  fallback: number
): number => Option.getOrElse(Option.filter(value, isValid), () => fallback)

const normalizeConfig = (config?: RidderMethodInput): NormalizedRidderConfig => {
  const decoded = Option.fromNullable(config)

  return Option.match(decoded, {
    onNone: () => defaultConfig,
    onSome: (value) =>
      new NormalizedRidderConfig({
        initialStep: selectOrDefault(
          Option.fromNullable(value.initialStep),
          isFinitePositive,
          defaultConfig.initialStep
        ),
        contractionFactor: selectOrDefault(
          Option.fromNullable(value.contractionFactor),
          isFiniteGreaterThanOne,
          defaultConfig.contractionFactor
        ),
        maxIterations: selectOrDefault(
          Option.fromNullable(value.maxIterations),
          isPositiveInteger,
          defaultConfig.maxIterations
        ),
        absoluteTolerance: selectOrDefault(
          Option.fromNullable(value.absoluteTolerance),
          isFinitePositive,
          defaultConfig.absoluteTolerance
        ),
        relativeTolerance: selectOrDefault(
          Option.fromNullable(value.relativeTolerance),
          isFinitePositive,
          defaultConfig.relativeTolerance
        ),
        minimumStep: selectOrDefault(
          Option.fromNullable(value.minimumStep),
          isFinitePositive,
          defaultConfig.minimumStep
        ),
        safetyFactor: selectOrDefault(
          Option.fromNullable(value.safetyFactor),
          isFiniteGreaterThanOne,
          defaultConfig.safetyFactor
        )
      })
  })
}

const toleranceFor = (value: number, config: NormalizedRidderConfig): number =>
  Number.max(config.absoluteTolerance, Number.multiply(Numeric.abs(value), config.relativeTolerance))

const minimumIterationBudget = Schema.decodeSync(Numeric.IterationBudget)(1)
const validIterationBudget = Option.liftPredicate(Schema.is(Numeric.IterationBudget))

const normalizeIterationBudget = (iterations: number): Numeric.IterationBudget =>
  Option.getOrElse(validIterationBudget(iterations), () => minimumIterationBudget)

const makeEstimate = (
  value: number,
  absoluteError: number,
  iterations: number,
  converged: boolean
): DerivativeLimitEstimate => ({
  value,
  absoluteError,
  iterations: normalizeIterationBudget(iterations),
  converged
})

class RowRefinement extends Data.Class<{
  readonly row: Array.NonEmptyReadonlyArray<number>
  readonly rowError: number
}> {}

const refineRow = (
  previousRow: Array.NonEmptyReadonlyArray<number>,
  firstColumn: number,
  contractionSquared: number
): RowRefinement => {
  const factor = MutableRef.make(contractionSquared)
  const rowError = MutableRef.make(positiveInfinity)
  const row = Array.scan(
    previousRow,
    firstColumn,
    (current, previous) => {
      const currentFactor = MutableRef.get(factor)
      const denominator = Number.subtract(currentFactor, 1)
      const refined = Number.unsafeDivide(
        Number.subtract(Number.multiply(current, currentFactor), previous),
        denominator
      )
      const localError = Number.max(
        Numeric.abs(Number.subtract(refined, current)),
        Numeric.abs(Number.subtract(refined, previous))
      )
      MutableRef.set(factor, Number.multiply(currentFactor, contractionSquared))
      MutableRef.set(rowError, Number.min(MutableRef.get(rowError), localError))
      return refined
    }
  )

  return new RowRefinement({ row, rowError: MutableRef.get(rowError) })
}

const selectBetterEstimate = (
  current: DerivativeLimitEstimate,
  candidate: DerivativeLimitEstimate
): DerivativeLimitEstimate =>
  Boolean.match(Number.lessThan(candidate.absoluteError, current.absoluteError), {
    onTrue: () => candidate,
    onFalse: () => current
  })

class RidderState extends Data.Class<{
  readonly depth: number
  readonly currentStep: number
  readonly previousRow: Array.NonEmptyReadonlyArray<number>
  readonly best: DerivativeLimitEstimate
  readonly result: Option.Option<DerivativeLimitEstimate>
}> {}

const finish = (
  state: RidderState,
  result: DerivativeLimitEstimate
): RidderState =>
  new RidderState({
    depth: state.depth,
    currentStep: state.currentStep,
    previousRow: state.previousRow,
    best: state.best,
    result: Option.some(result)
  })

const advance = (
  kernel: StepKernel,
  normalized: NormalizedRidderConfig,
  contractionSquared: number,
  state: RidderState
): RidderState =>
  Boolean.match(Number.greaterThanOrEqualTo(state.depth, normalized.maxIterations), {
    onTrue: () => finish(state, state.best),
    onFalse: () => {
      const nextStep = Number.unsafeDivide(state.currentStep, normalized.contractionFactor)
      return Boolean.match(Number.lessThanOrEqualTo(nextStep, normalized.minimumStep), {
        onTrue: () => finish(state, state.best),
        onFalse: () => {
          const firstColumn = kernel(nextStep)
          return Boolean.match(isFinite(firstColumn), {
            onFalse: () => finish(state, state.best),
            onTrue: () => {
              const refinement = refineRow(state.previousRow, firstColumn, contractionSquared)
              // The initial row has one entry; each refinement appends one
              // extrapolation column. Depth is always the previous row's size.
              const diagonal = Array.unsafeGet(refinement.row, state.depth)
              const previousDiagonal = Array.unsafeGet(state.previousRow, Number.decrement(state.depth))
              const diagonalShift = Numeric.abs(Number.subtract(diagonal, previousDiagonal))
              const candidateError = Number.min(diagonalShift, refinement.rowError)
              const converged = Number.lessThanOrEqualTo(candidateError, toleranceFor(diagonal, normalized))
              const candidate = makeEstimate(diagonal, candidateError, Number.increment(state.depth), converged)
              const bestCandidate = selectBetterEstimate(state.best, candidate)
              const runaway = Boolean.and(
                Number.greaterThan(state.depth, 1),
                Number.greaterThanOrEqualTo(
                  diagonalShift,
                  Number.multiply(bestCandidate.absoluteError, normalized.safetyFactor)
                )
              )

              return Boolean.match(converged, {
                onTrue: () => finish(state, candidate),
                onFalse: () =>
                  Boolean.match(runaway, {
                    onTrue: () => finish(state, bestCandidate),
                    onFalse: () =>
                      new RidderState({
                        depth: Number.increment(state.depth),
                        currentStep: nextStep,
                        previousRow: refinement.row,
                        best: bestCandidate,
                        result: Option.none()
                      })
                  })
              })
            }
          })
        }
      })
    }
  })

/**
 * Generic Ridder extrapolation over a step kernel `k(h)` as `h → 0`.
 *
 * @since 0.1.0
 * @category internal
 */
export const ridderExtrapolation = (
  kernel: StepKernel,
  config?: RidderMethodInput
): DerivativeLimitEstimate => {
  const normalized = normalizeConfig(config)
  const contractionSquared = Number.multiply(normalized.contractionFactor, normalized.contractionFactor)
  const initialValue = kernel(normalized.initialStep)
  const initialEstimate = makeEstimate(initialValue, positiveInfinity, 1, false)
  const initial = new RidderState({
    depth: 1,
    currentStep: normalized.initialStep,
    previousRow: Array.of(initialValue),
    best: initialEstimate,
    result: Option.none()
  })
  const state = MutableRef.make(initial)
  Iterable.some(Iterable.range(0), () => {
    const next = advance(kernel, normalized, contractionSquared, MutableRef.get(state))
    MutableRef.set(state, next)
    return Option.isSome(next.result)
  })
  const final = MutableRef.get(state)
  const result = Option.getOrElse(final.result, () => final.best)

  return Boolean.match(isFinite(result.value), {
    onTrue: () => result,
    onFalse: () => makeEstimate(result.value, positiveInfinity, result.iterations, false)
  })
}

/**
 * Ridder extrapolation that preserves immutable state between kernel calls.
 *
 * @since 0.1.0
 * @category internal
 */
export const ridderExtrapolationWithState = <State>(
  kernel: StatefulStepKernel<State>,
  initialKernelState: State,
  config?: RidderMethodInput
): StatefulRidderResult<State> => {
  const state = MutableRef.make(initialKernelState)
  const estimate = ridderExtrapolation((step) => {
    const next = kernel(step, MutableRef.get(state))
    MutableRef.set(state, next.state)
    return next.value
  }, config)

  return new StatefulRidderResult({
    estimate,
    state: MutableRef.get(state)
  })
}
