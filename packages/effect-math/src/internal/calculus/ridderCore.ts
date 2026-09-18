/**
 * Ridder extrapolation core.
 *
 * @since 0.1.0
 * @category internal
 */
import { Array, Boolean, Chunk, Data, Iterable, MutableRef, Number, Option, Schema, Tuple } from "effect"

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

const isFinite = Schema.is(Schema.Finite)
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

const normalizeIterationBudget = (iterations: number): Numeric.IterationBudget =>
  Option.getOrElse(Option.liftPredicate(Schema.is(Numeric.IterationBudget))(iterations), () => minimumIterationBudget)

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
  readonly row: Chunk.Chunk<number>
  readonly rowError: number
}> {}

const lastOr = (values: Chunk.Chunk<number>, fallback: number): number =>
  Option.getOrElse(Chunk.last(values), () => fallback)

const refineRow = (
  previousRow: Chunk.Chunk<number>,
  firstColumn: number,
  contractionSquared: number
): RowRefinement => {
  const factor = MutableRef.make(contractionSquared)
  const rowError = MutableRef.make(positiveInfinity)
  const row = Array.scan(
    Chunk.toReadonlyArray(previousRow),
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

  return new RowRefinement({ row: Chunk.fromIterable(row), rowError: MutableRef.get(rowError) })
}

const selectBetterEstimate = (
  current: DerivativeLimitEstimate,
  candidate: DerivativeLimitEstimate
): DerivativeLimitEstimate =>
  Boolean.match(Number.lessThan(candidate.absoluteError, current.absoluteError), {
    onTrue: () => candidate,
    onFalse: () => current
  })

class RidderState<State> extends Data.Class<{
  readonly depth: number
  readonly currentStep: number
  readonly previousRow: Chunk.Chunk<number>
  readonly best: DerivativeLimitEstimate
  readonly result: Option.Option<DerivativeLimitEstimate>
  readonly kernelState: State
}> {}

const finish = <State>(
  state: RidderState<State>,
  result: DerivativeLimitEstimate,
  kernelState: State = state.kernelState
): RidderState<State> =>
  new RidderState({
    depth: state.depth,
    currentStep: state.currentStep,
    previousRow: state.previousRow,
    best: state.best,
    result: Option.some(result),
    kernelState
  })

const advance = <State>(
  kernel: StatefulStepKernel<State>,
  normalized: NormalizedRidderConfig,
  contractionSquared: number,
  state: RidderState<State>
): RidderState<State> =>
  Boolean.match(Number.greaterThanOrEqualTo(state.depth, normalized.maxIterations), {
    onTrue: () => finish(state, state.best),
    onFalse: () => {
      const nextStep = Number.unsafeDivide(state.currentStep, normalized.contractionFactor)
      return Boolean.match(Number.lessThanOrEqualTo(nextStep, normalized.minimumStep), {
        onTrue: () => finish(state, state.best),
        onFalse: () => {
          const stepResult = kernel(nextStep, state.kernelState)
          return Boolean.match(isFinite(stepResult.value), {
            onFalse: () => finish(state, state.best, stepResult.state),
            onTrue: () => {
              const firstColumn = stepResult.value
              const refinement = refineRow(state.previousRow, firstColumn, contractionSquared)
              const diagonal = lastOr(refinement.row, firstColumn)
              const previousDiagonal = Option.getOrElse(
                Chunk.get(state.previousRow, Number.decrement(state.depth)),
                () => lastOr(state.previousRow, diagonal)
              )
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
                onTrue: () => finish(state, candidate, stepResult.state),
                onFalse: () =>
                  Boolean.match(runaway, {
                    onTrue: () => finish(state, bestCandidate, stepResult.state),
                    onFalse: () =>
                      new RidderState({
                        depth: Number.increment(state.depth),
                        currentStep: nextStep,
                        previousRow: refinement.row,
                        best: bestCandidate,
                        result: Option.none(),
                        kernelState: stepResult.state
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
): DerivativeLimitEstimate =>
  ridderExtrapolationWithState(
    (step, state) => new StatefulStepResult({ value: kernel(step), state }),
    true,
    config
  ).estimate

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
  const normalized = normalizeConfig(config)
  const contractionSquared = Number.multiply(normalized.contractionFactor, normalized.contractionFactor)
  const initialStepResult = kernel(normalized.initialStep, initialKernelState)
  const initialValue = initialStepResult.value
  const initialEstimate = makeEstimate(initialValue, positiveInfinity, 1, false)
  const initial = new RidderState({
    depth: 1,
    currentStep: normalized.initialStep,
    previousRow: Chunk.of(initialValue),
    best: initialEstimate,
    result: Option.none(),
    kernelState: initialStepResult.state
  })
  const final = Iterable.reduce(
    Iterable.unfold(initial, (state) =>
      Option.match(state.result, {
        onSome: Option.none,
        onNone: () => {
          const next = advance(kernel, normalized, contractionSquared, state)
          return Option.some(Tuple.make(next, next))
        }
      })),
    initial,
    (_state, next) => next
  )
  const result = Option.getOrElse(final.result, () => final.best)

  return new StatefulRidderResult({
    estimate: Boolean.match(isFinite(result.value), {
      onTrue: () => result,
      onFalse: () => makeEstimate(result.value, positiveInfinity, result.iterations, false)
    }),
    state: final.kernelState
  })
}
