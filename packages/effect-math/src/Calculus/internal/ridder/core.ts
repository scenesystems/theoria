/**
 * Ridder extrapolation core.
 *
 * @since 0.1.0
 * @category internal
 */
import { Data, Number as N, Option, Schema } from "effect"

import { IterationBudget } from "../../../contracts/shared/BrandedScalars.js"
import { type DerivativeLimitEstimate, RidderMethodInput, type RidderMethodInputType } from "../../schema.js"

class NormalizedRidderConfig extends Data.Class<{
  readonly initialStep: number
  readonly contractionFactor: number
  readonly maxIterations: number
  readonly absoluteTolerance: number
  readonly relativeTolerance: number
  readonly minimumStep: number
  readonly safetyFactor: number
}> {}

const DEFAULT_CONFIG = new NormalizedRidderConfig({
  initialStep: 1e-2,
  contractionFactor: 1.4,
  maxIterations: 12,
  absoluteTolerance: 1e-12,
  relativeTolerance: 1e-10,
  minimumStep: 1e-14,
  safetyFactor: 2.5
})

const absolute = (value: number) => N.max(value, N.negate(value))

export type StepKernel = (step: number) => number

const isFinitePositive = (value: number): boolean => Number.isFinite(value) && N.greaterThan(value, 0)

const isFiniteGreaterThanOne = (value: number): boolean => Number.isFinite(value) && N.greaterThan(value, 1)

const isPositiveInteger = (value: number): boolean =>
  Number.isInteger(value) && Number.isFinite(value) && N.greaterThan(value, 0)

const selectOrDefault = (
  value: Option.Option<number>,
  isValid: (candidate: number) => boolean,
  fallback: number
): number =>
  Option.getOrElse(
    Option.filter(value, isValid),
    () => fallback
  )

const optionalField = (
  field:
    | "initialStep"
    | "contractionFactor"
    | "maxIterations"
    | "absoluteTolerance"
    | "relativeTolerance"
    | "minimumStep"
    | "safetyFactor",
  config?: RidderMethodInputType
): Option.Option<number> => Option.fromNullable(config?.[field])

const decodeRidderMethodInput = Schema.decodeUnknownSync(RidderMethodInput, {
  onExcessProperty: "error"
})

const normalizeConfig = (config?: RidderMethodInputType): NormalizedRidderConfig => {
  const decoded = Option.match(Option.fromNullable(config), {
    onNone: () => undefined,
    onSome: (candidate) => decodeRidderMethodInput(candidate)
  })

  return new NormalizedRidderConfig({
    initialStep: selectOrDefault(
      optionalField("initialStep", decoded),
      isFinitePositive,
      DEFAULT_CONFIG.initialStep
    ),
    contractionFactor: selectOrDefault(
      optionalField("contractionFactor", decoded),
      isFiniteGreaterThanOne,
      DEFAULT_CONFIG.contractionFactor
    ),
    maxIterations: selectOrDefault(
      optionalField("maxIterations", decoded),
      isPositiveInteger,
      DEFAULT_CONFIG.maxIterations
    ),
    absoluteTolerance: selectOrDefault(
      optionalField("absoluteTolerance", decoded),
      isFinitePositive,
      DEFAULT_CONFIG.absoluteTolerance
    ),
    relativeTolerance: selectOrDefault(
      optionalField("relativeTolerance", decoded),
      isFinitePositive,
      DEFAULT_CONFIG.relativeTolerance
    ),
    minimumStep: selectOrDefault(
      optionalField("minimumStep", decoded),
      isFinitePositive,
      DEFAULT_CONFIG.minimumStep
    ),
    safetyFactor: selectOrDefault(
      optionalField("safetyFactor", decoded),
      isFiniteGreaterThanOne,
      DEFAULT_CONFIG.safetyFactor
    )
  })
}

const toleranceFor = (value: number, config: NormalizedRidderConfig): number =>
  N.max(config.absoluteTolerance, N.multiply(absolute(value), config.relativeTolerance))

const MINIMUM_ITERATION_BUDGET = Schema.decodeSync(IterationBudget)(1)

const normalizeIterationBudget = (iterations: number): typeof IterationBudget.Type =>
  Schema.is(IterationBudget)(iterations) ? iterations : MINIMUM_ITERATION_BUDGET

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
  readonly row: ReadonlyArray<number>
  readonly rowError: number
}> {}

const lastIndex = (values: ReadonlyArray<unknown>): number => N.subtract(values.length, 1)

const lastOr = (values: ReadonlyArray<number>, fallback: number): number => values[lastIndex(values)] ?? fallback

const refineRow = (
  previousRow: ReadonlyArray<number>,
  firstColumn: number,
  depth: number,
  contractionSquared: number
): RowRefinement => {
  const step = (
    column: number,
    factor: number,
    row: ReadonlyArray<number>,
    rowError: number
  ): RowRefinement => {
    if (N.greaterThan(column, depth)) {
      return new RowRefinement({ row, rowError })
    }

    const current = lastOr(row, firstColumn)
    const previous = previousRow[N.subtract(column, 1)] ?? current
    const denominator = N.subtract(factor, 1)
    const refined = N.unsafeDivide(N.subtract(N.multiply(current, factor), previous), denominator)
    const localError = N.max(absolute(N.subtract(refined, current)), absolute(N.subtract(refined, previous)))

    return step(
      N.sum(column, 1),
      N.multiply(factor, contractionSquared),
      [...row, refined],
      N.min(rowError, localError)
    )
  }

  return step(1, contractionSquared, [firstColumn], Number.POSITIVE_INFINITY)
}

const selectBetterEstimate = (
  current: DerivativeLimitEstimate,
  candidate: DerivativeLimitEstimate
): DerivativeLimitEstimate => N.lessThan(candidate.absoluteError, current.absoluteError) ? candidate : current

/**
 * Generic Ridder extrapolation over a step kernel `k(h)` as `h → 0`.
 *
 * @since 0.1.0
 * @category internal
 */
export const ridderExtrapolation = (
  kernel: StepKernel,
  config?: RidderMethodInputType
): DerivativeLimitEstimate => {
  const normalized = normalizeConfig(config)
  const contractionSquared = N.multiply(normalized.contractionFactor, normalized.contractionFactor)

  const initialValue = kernel(normalized.initialStep)
  const initial = makeEstimate(initialValue, Number.POSITIVE_INFINITY, 1, false)
  const initialRow: ReadonlyArray<number> = [initialValue]

  const iterate = (
    depth: number,
    currentStep: number,
    previousRow: ReadonlyArray<number>,
    best: DerivativeLimitEstimate
  ): DerivativeLimitEstimate => {
    if (N.greaterThanOrEqualTo(depth, normalized.maxIterations)) {
      return best
    }

    const nextStep = N.unsafeDivide(currentStep, normalized.contractionFactor)
    if (N.lessThanOrEqualTo(nextStep, normalized.minimumStep)) {
      return best
    }

    const firstColumn = kernel(nextStep)
    if (Number.isFinite(firstColumn) === false) {
      return best
    }

    const refinement = refineRow(previousRow, firstColumn, depth, contractionSquared)
    const diagonal = lastOr(refinement.row, firstColumn)
    const previousDiagonal = previousRow[N.subtract(depth, 1)] ?? lastOr(previousRow, diagonal)
    const diagonalShift = absolute(N.subtract(diagonal, previousDiagonal))
    const candidateError = N.min(diagonalShift, refinement.rowError)
    const converged = N.lessThanOrEqualTo(candidateError, toleranceFor(diagonal, normalized))

    const candidate = makeEstimate(diagonal, candidateError, N.sum(depth, 1), converged)
    const bestCandidate = selectBetterEstimate(best, candidate)

    if (converged) {
      return candidate
    }

    const runaway = N.greaterThan(depth, 1) &&
      N.greaterThanOrEqualTo(diagonalShift, N.multiply(bestCandidate.absoluteError, normalized.safetyFactor))

    if (runaway) {
      return bestCandidate
    }

    return iterate(N.sum(depth, 1), nextStep, refinement.row, bestCandidate)
  }

  const result = iterate(1, normalized.initialStep, initialRow, initial)
  return Number.isFinite(result.value)
    ? result
    : makeEstimate(result.value, Number.POSITIVE_INFINITY, result.iterations, false)
}
