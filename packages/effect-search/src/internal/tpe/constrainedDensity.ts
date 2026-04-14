import { Array as Arr, Data, Match, Number as Num, Option } from "effect"
import { exp, logStrict } from "effect-math/Numeric"

import { buildContinuousParzen, type ContinuousParzen, logDensity } from "./continuousParzen.js"

const RATIO_EPSILON = 1e-12
const RATIO_MAX = Num.unsafeDivide(1, RATIO_EPSILON)
const BOUNDS_PADDING_RATIO = 0.05

class ConstraintBounds extends Data.Class<{
  readonly low: number
  readonly high: number
}> {}

class ConstraintRange extends Data.Class<{
  readonly minimum: number
  readonly maximum: number
}> {}

export class ConstraintDensityModel extends Data.Class<{
  readonly gamma: number
  readonly feasibleParzen: ContinuousParzen
  readonly infeasibleParzen: ContinuousParzen
  readonly hasFeasible: boolean
  readonly hasInfeasible: boolean
}> {}

const finiteConstraintValue = (value: number): number =>
  Match.value(Number.isFinite(value)).pipe(
    Match.when(true, () => value),
    Match.orElse(() => Number.POSITIVE_INFINITY)
  )

export const isConstraintSatisfied = (value: number): boolean => Num.lessThanOrEqualTo(finiteConstraintValue(value), 0)

export const isConstraintVectorFeasible = (constraints: ReadonlyArray<number>): boolean =>
  Arr.every(constraints, (constraint) => isConstraintSatisfied(constraint))

const constraintDimensionCount = (constraints: ReadonlyArray<ReadonlyArray<number>>): number =>
  Arr.reduce(constraints, 0, (count, values) => Num.max(count, values.length))

const constraintValueAt = (constraints: ReadonlyArray<number>, index: number): number =>
  Arr.get(constraints, index).pipe(
    Option.map((value) => finiteConstraintValue(value)),
    Option.getOrElse(() => Number.POSITIVE_INFINITY)
  )

const valuesForDimension = (
  constraints: ReadonlyArray<ReadonlyArray<number>>,
  index: number
): ReadonlyArray<number> => Arr.map(constraints, (values) => constraintValueAt(values, index))

const boundsFromValues = (values: ReadonlyArray<number>): ConstraintBounds => {
  const finiteValues = Arr.filter(values, (value) => Number.isFinite(value))

  return Arr.get(finiteValues, 0).pipe(
    Option.match({
      onNone: () =>
        new ConstraintBounds({
          low: -1,
          high: 1
        }),
      onSome: (firstValue) => {
        const range = Arr.reduce(
          finiteValues,
          new ConstraintRange({ minimum: firstValue, maximum: firstValue }),
          (currentRange, value) =>
            new ConstraintRange({
              minimum: Num.min(currentRange.minimum, value),
              maximum: Num.max(currentRange.maximum, value)
            })
        )
        const span = range.maximum - range.minimum
        const padding = Match.value(Num.lessThanOrEqualTo(span, 0)).pipe(
          Match.when(true, () => 1),
          Match.orElse(() => Num.max(1, span * BOUNDS_PADDING_RATIO))
        )

        return new ConstraintBounds({
          low: range.minimum - padding,
          high: range.maximum + padding
        })
      }
    })
  )
}

const gammaFromValues = (values: ReadonlyArray<number>): number =>
  Match.value(values.length <= 0).pipe(
    Match.when(true, () => 0.5),
    Match.orElse(() => {
      const feasibleCount = Arr.reduce(
        values,
        0,
        (count, value) =>
          Match.value(isConstraintSatisfied(value)).pipe(
            Match.when(true, () => Num.increment(count)),
            Match.orElse(() => count)
          )
      )

      return Num.clamp(Num.unsafeDivide(feasibleCount, values.length), {
        minimum: RATIO_EPSILON,
        maximum: 1 - RATIO_EPSILON
      })
    })
  )

const modelFromValues = (values: ReadonlyArray<number>): ConstraintDensityModel => {
  const bounds = boundsFromValues(values)
  const feasibleValues = Arr.filter(values, (value) => isConstraintSatisfied(value))
  const infeasibleValues = Arr.filter(values, (value) => !isConstraintSatisfied(value))

  return new ConstraintDensityModel({
    gamma: gammaFromValues(values),
    feasibleParzen: buildContinuousParzen(feasibleValues, bounds.low, bounds.high),
    infeasibleParzen: buildContinuousParzen(infeasibleValues, bounds.low, bounds.high),
    hasFeasible: feasibleValues.length > 0,
    hasInfeasible: infeasibleValues.length > 0
  })
}

const stabilizeRatio = (ratio: number): number =>
  Match.value(Number.isFinite(ratio)).pipe(
    Match.when(true, () =>
      Num.clamp(ratio, {
        minimum: RATIO_EPSILON,
        maximum: RATIO_MAX
      })),
    Match.orElse(() =>
      Match.value(Num.greaterThan(ratio, 0)).pipe(
        Match.when(true, () => RATIO_MAX),
        Match.orElse(() => RATIO_EPSILON)
      )
    )
  )

export const buildConstraintDensityModels = (
  constraints: ReadonlyArray<ReadonlyArray<number>>
): ReadonlyArray<ConstraintDensityModel> =>
  Arr.makeBy(constraintDimensionCount(constraints), (index) => modelFromValues(valuesForDimension(constraints, index)))

export const constraintDensityRatio = (
  model: ConstraintDensityModel,
  value: number
): number =>
  Match.value(!model.hasFeasible || !model.hasInfeasible).pipe(
    Match.when(true, () => 1),
    Match.orElse(() => {
      const constrainedValue = finiteConstraintValue(value)
      const ratio = stabilizeRatio(
        exp(
          logDensity(model.feasibleParzen, constrainedValue) -
            logDensity(model.infeasibleParzen, constrainedValue)
        )
      )
      const denominator = model.gamma * ratio + (1 - model.gamma)

      return Match.value(Number.isFinite(denominator) && Num.greaterThan(denominator, 0)).pipe(
        Match.when(true, () => stabilizeRatio(Num.unsafeDivide(ratio, denominator))),
        Match.orElse(() => RATIO_EPSILON)
      )
    })
  )

export const constraintDensityRatioLogProduct = (
  models: ReadonlyArray<ConstraintDensityModel>,
  constraints: ReadonlyArray<number>
): number =>
  Arr.reduce(models, 0, (sum, model, index) =>
    Num.sum(
      sum,
      logStrict(
        constraintDensityRatio(model, constraintValueAt(constraints, index))
      )
    ))

export const constraintDensityRatioProduct = (
  models: ReadonlyArray<ConstraintDensityModel>,
  constraints: ReadonlyArray<number>
): number => exp(constraintDensityRatioLogProduct(models, constraints))
