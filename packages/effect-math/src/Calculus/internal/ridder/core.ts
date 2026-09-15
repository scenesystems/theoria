/**
 * Ridder extrapolation core.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Chunk, Data, Iterable, Number, Option, Schema, Tuple } from "effect"

import { IterationBudget } from "../../../contracts/shared/BrandedScalars.js"
import * as Numeric from "../../../Numeric/index.js"
import type { DerivativeLimitEstimate, RidderMethodInputType } from "../../schema.js"

class NormalizedRidderConfig extends Schema.Class<NormalizedRidderConfig>("NormalizedRidderConfig")({
  initialStep: Schema.Number,
  contractionFactor: Schema.Number,
  maxIterations: Schema.Number,
  absoluteTolerance: Schema.Number,
  relativeTolerance: Schema.Number,
  minimumStep: Schema.Number,
  safetyFactor: Schema.Number
}) {}

const DEFAULT_CONFIG = new NormalizedRidderConfig({
  initialStep: 1e-2,
  contractionFactor: 1.4,
  maxIterations: 12,
  absoluteTolerance: 1e-12,
  relativeTolerance: 1e-10,
  minimumStep: 1e-14,
  safetyFactor: 2.5
})

const POSITIVE_INFINITY = Number.unsafeDivide(1, 0)

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

const normalizeConfig = (config?: RidderMethodInputType): NormalizedRidderConfig => {
  const decoded = Option.fromNullable(config)

  return new NormalizedRidderConfig({
    initialStep: selectOrDefault(
      Option.flatMap(decoded, (value) => Option.fromNullable(value.initialStep)),
      isFinitePositive,
      DEFAULT_CONFIG.initialStep
    ),
    contractionFactor: selectOrDefault(
      Option.flatMap(decoded, (value) => Option.fromNullable(value.contractionFactor)),
      isFiniteGreaterThanOne,
      DEFAULT_CONFIG.contractionFactor
    ),
    maxIterations: selectOrDefault(
      Option.flatMap(decoded, (value) => Option.fromNullable(value.maxIterations)),
      isPositiveInteger,
      DEFAULT_CONFIG.maxIterations
    ),
    absoluteTolerance: selectOrDefault(
      Option.flatMap(decoded, (value) => Option.fromNullable(value.absoluteTolerance)),
      isFinitePositive,
      DEFAULT_CONFIG.absoluteTolerance
    ),
    relativeTolerance: selectOrDefault(
      Option.flatMap(decoded, (value) => Option.fromNullable(value.relativeTolerance)),
      isFinitePositive,
      DEFAULT_CONFIG.relativeTolerance
    ),
    minimumStep: selectOrDefault(
      Option.flatMap(decoded, (value) => Option.fromNullable(value.minimumStep)),
      isFinitePositive,
      DEFAULT_CONFIG.minimumStep
    ),
    safetyFactor: selectOrDefault(
      Option.flatMap(decoded, (value) => Option.fromNullable(value.safetyFactor)),
      isFiniteGreaterThanOne,
      DEFAULT_CONFIG.safetyFactor
    )
  })
}

const toleranceFor = (value: number, config: NormalizedRidderConfig): number =>
  Number.max(config.absoluteTolerance, Number.multiply(Numeric.abs(value), config.relativeTolerance))

const MINIMUM_ITERATION_BUDGET = Schema.decodeSync(IterationBudget)(1)

const normalizeIterationBudget = (iterations: number): typeof IterationBudget.Type =>
  Option.getOrElse(Option.liftPredicate(Schema.is(IterationBudget))(iterations), () => MINIMUM_ITERATION_BUDGET)

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

class RowRefinement extends Schema.Class<RowRefinement>("RowRefinement")({
  row: Schema.ChunkFromSelf(Schema.Number),
  rowError: Schema.Number
}) {}

class RowState extends Schema.Class<RowState>("RowState")({
  column: Schema.Number,
  factor: Schema.Number,
  row: Schema.ChunkFromSelf(Schema.Number),
  rowError: Schema.Number
}) {}

const lastOr = (values: Chunk.Chunk<number>, fallback: number): number =>
  Option.getOrElse(Chunk.last(values), () => fallback)

const refineRow = (
  previousRow: Chunk.Chunk<number>,
  firstColumn: number,
  depth: number,
  contractionSquared: number
): RowRefinement => {
  const initial = new RowState({
    column: 1,
    factor: contractionSquared,
    row: Chunk.of(firstColumn),
    rowError: POSITIVE_INFINITY
  })
  const final = Iterable.reduce(
    Iterable.unfold(initial, (state) =>
      Boolean.match(Number.greaterThan(state.column, depth), {
        onTrue: Option.none,
        onFalse: () => {
          const current = lastOr(state.row, firstColumn)
          const previous = Option.getOrElse(Chunk.get(previousRow, Number.decrement(state.column)), () => current)
          const denominator = Number.subtract(state.factor, 1)
          const refined = Number.unsafeDivide(
            Number.subtract(Number.multiply(current, state.factor), previous),
            denominator
          )
          const localError = Number.max(
            Numeric.abs(Number.subtract(refined, current)),
            Numeric.abs(Number.subtract(refined, previous))
          )
          const next = new RowState({
            column: Number.increment(state.column),
            factor: Number.multiply(state.factor, contractionSquared),
            row: Chunk.append(state.row, refined),
            rowError: Number.min(state.rowError, localError)
          })
          return Option.some(Tuple.make(next, next))
        }
      })),
    initial,
    (_state, next) => next
  )

  return new RowRefinement({ row: final.row, rowError: final.rowError })
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

const finish = <State>(state: RidderState<State>, result: DerivativeLimitEstimate): RidderState<State> =>
  new RidderState({
    depth: state.depth,
    currentStep: state.currentStep,
    previousRow: state.previousRow,
    best: state.best,
    result: Option.some(result),
    kernelState: state.kernelState
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
          const observed = new RidderState({
            depth: state.depth,
            currentStep: state.currentStep,
            previousRow: state.previousRow,
            best: state.best,
            result: state.result,
            kernelState: stepResult.state
          })
          return Boolean.match(isFinite(stepResult.value), {
            onFalse: () => finish(observed, state.best),
            onTrue: () => {
              const firstColumn = stepResult.value
              const refinement = refineRow(state.previousRow, firstColumn, state.depth, contractionSquared)
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
                onTrue: () => finish(observed, candidate),
                onFalse: () =>
                  Boolean.match(runaway, {
                    onTrue: () => finish(observed, bestCandidate),
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
  config?: RidderMethodInputType
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
  config?: RidderMethodInputType
): StatefulRidderResult<State> => {
  const normalized = normalizeConfig(config)
  const contractionSquared = Number.multiply(normalized.contractionFactor, normalized.contractionFactor)
  const initialStepResult = kernel(normalized.initialStep, initialKernelState)
  const initialValue = initialStepResult.value
  const initialEstimate = makeEstimate(initialValue, POSITIVE_INFINITY, 1, false)
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
      onFalse: () => makeEstimate(result.value, POSITIVE_INFINITY, result.iterations, false)
    }),
    state: final.kernelState
  })
}
