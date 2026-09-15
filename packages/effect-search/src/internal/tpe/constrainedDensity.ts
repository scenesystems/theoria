import { Array as Arr, Boolean, Data, Match, Number as Num, Option, Schema } from "effect"

import * as Float64 from "../float64.js"
import { buildContinuousParzen, ContinuousParzen, logDensity } from "./continuousParzen.js"
import type { ContinuousValues } from "./continuousParzen/model.js"

const RATIO_EPSILON = 1e-12
const RATIO_MAX = Num.unsafeDivide(1, RATIO_EPSILON)
const BOUNDS_PADDING_RATIO = 0.05

const ConstraintVectorsSchema = Schema.Array(Schema.Array(Schema.Number))
type ConstraintVectors = Schema.Schema.Type<typeof ConstraintVectorsSchema>

class ConstraintBounds extends Data.Class<{
  readonly low: number
  readonly high: number
}> {}

class ConstraintRange extends Data.Class<{
  readonly minimum: number
  readonly maximum: number
}> {}

export class ConstraintDensityModel
  extends Schema.Class<ConstraintDensityModel>("effect-search/ConstraintDensityModel")({
    gamma: Schema.Number,
    feasibleParzen: ContinuousParzen,
    infeasibleParzen: ContinuousParzen,
    hasFeasible: Schema.Boolean,
    hasInfeasible: Schema.Boolean
  })
{}

const isFinite = Schema.is(Schema.Finite)

const finiteConstraintValue = (value: number): number =>
  Match.value(isFinite(value)).pipe(
    Match.when(true, () => value),
    Match.orElse(() => Number.POSITIVE_INFINITY)
  )

export const isConstraintSatisfied = (value: number): boolean => Num.lessThanOrEqualTo(finiteConstraintValue(value), 0)

export const isConstraintVectorFeasible = (constraints: ContinuousValues): boolean =>
  Arr.every(constraints, (constraint) => isConstraintSatisfied(constraint))

const constraintDimensionCount = (constraints: ConstraintVectors): number =>
  Arr.reduce(constraints, 0, (count, values) => Num.max(count, Arr.length(values)))

const constraintValueAt = (constraints: ContinuousValues, index: number): number =>
  Arr.get(constraints, index).pipe(
    Option.map((value) => finiteConstraintValue(value)),
    Option.getOrElse(() => Number.POSITIVE_INFINITY)
  )

const valuesForDimension = (
  constraints: ConstraintVectors,
  index: number
): ContinuousValues => Arr.map(constraints, (values) => constraintValueAt(values, index))

const boundsFromValues = (values: ContinuousValues): ConstraintBounds => {
  const finiteValues = Arr.filter(values, isFinite)

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
        const span = Num.subtract(range.maximum, range.minimum)
        const padding = Match.value(Num.lessThanOrEqualTo(span, 0)).pipe(
          Match.when(true, () => 1),
          Match.orElse(() => Num.max(1, Num.multiply(span, BOUNDS_PADDING_RATIO)))
        )

        return new ConstraintBounds({
          low: Num.subtract(range.minimum, padding),
          high: Num.sum(range.maximum, padding)
        })
      }
    })
  )
}

const gammaFromValues = (values: ContinuousValues): number =>
  Match.value(Arr.isEmptyReadonlyArray(values)).pipe(
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

      return Num.clamp(Num.unsafeDivide(feasibleCount, Arr.length(values)), {
        minimum: RATIO_EPSILON,
        maximum: Num.subtract(1, RATIO_EPSILON)
      })
    })
  )

const modelFromValues = (values: ContinuousValues): ConstraintDensityModel => {
  const bounds = boundsFromValues(values)
  const feasibleValues = Arr.filter(values, (value) => isConstraintSatisfied(value))
  const infeasibleValues = Arr.filter(values, (value) => Boolean.not(isConstraintSatisfied(value)))

  return new ConstraintDensityModel({
    gamma: gammaFromValues(values),
    feasibleParzen: buildContinuousParzen(feasibleValues, bounds.low, bounds.high),
    infeasibleParzen: buildContinuousParzen(infeasibleValues, bounds.low, bounds.high),
    hasFeasible: Arr.isNonEmptyReadonlyArray(feasibleValues),
    hasInfeasible: Arr.isNonEmptyReadonlyArray(infeasibleValues)
  })
}

const stabilizeRatio = (ratio: number): number =>
  Match.value(isFinite(ratio)).pipe(
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
  constraints: ConstraintVectors
): Schema.Array$<typeof ConstraintDensityModel>["Type"] =>
  Arr.makeBy(constraintDimensionCount(constraints), (index) => modelFromValues(valuesForDimension(constraints, index)))

export const constraintDensityRatio = (
  model: ConstraintDensityModel,
  value: number
): number =>
  Match.value(Boolean.or(Boolean.not(model.hasFeasible), Boolean.not(model.hasInfeasible))).pipe(
    Match.when(true, () => 1),
    Match.orElse(() => {
      const constrainedValue = finiteConstraintValue(value)
      const ratio = stabilizeRatio(
        Float64.exp(
          Num.subtract(
            logDensity(model.feasibleParzen, constrainedValue),
            logDensity(model.infeasibleParzen, constrainedValue)
          )
        )
      )
      const denominator = Num.sum(Num.multiply(model.gamma, ratio), Num.subtract(1, model.gamma))

      return Match.value(Boolean.and(isFinite(denominator), Num.greaterThan(denominator, 0))).pipe(
        Match.when(true, () => stabilizeRatio(Num.unsafeDivide(ratio, denominator))),
        Match.orElse(() => RATIO_EPSILON)
      )
    })
  )

export const constraintDensityRatioLogProduct = (
  models: Schema.Array$<typeof ConstraintDensityModel>["Type"],
  constraints: ContinuousValues
): number =>
  Arr.reduce(models, 0, (sum, model, index) =>
    Num.sum(
      sum,
      Float64.log(
        constraintDensityRatio(model, constraintValueAt(constraints, index))
      )
    ))

export const constraintDensityRatioProduct = (
  models: Schema.Array$<typeof ConstraintDensityModel>["Type"],
  constraints: ContinuousValues
): number => Float64.exp(constraintDensityRatioLogProduct(models, constraints))
