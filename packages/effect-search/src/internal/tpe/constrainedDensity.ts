import { exp, isFinite, logStrict } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Data, Match, Number as Num, Option } from "effect"

import type { Vector } from "../../Objective.js"

import { buildContinuousParzen, type ContinuousParzen, logDensity } from "./continuousParzen.js"

const minimumDensityRatio = 1e-12
const maximumDensityRatio = Num.unsafeDivide(1, minimumDensityRatio)
const boundsPaddingRatio = 0.05

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
  Match.value(isFinite(value)).pipe(
    Match.when(true, () => value),
    Match.orElse(() => Number.POSITIVE_INFINITY)
  )

export const isConstraintSatisfied = (value: number): boolean => Num.lessThanOrEqualTo(finiteConstraintValue(value), 0)

export const isConstraintVectorFeasible = (constraintsInput: Iterable<number>): boolean => {
  const constraints = Arr.fromIterable(constraintsInput)
  return Arr.every(constraints, (constraint) => isConstraintSatisfied(constraint))
}

const constraintDimensionCount = (constraintsInput: Iterable<Vector>): number => {
  const constraints = Arr.fromIterable(constraintsInput)
  return Arr.reduce(constraints, 0, (count, values) => Num.max(count, Arr.length(values)))
}

const constraintValueAt = (constraintsInput: Iterable<number>, index: number): number => {
  const constraints = Arr.fromIterable(constraintsInput)
  return Arr.get(constraints, index).pipe(
    Option.map((value) => finiteConstraintValue(value)),
    Option.getOrElse(() => Number.POSITIVE_INFINITY)
  )
}

const valuesForDimension = (
  constraintsInput: Iterable<Vector>,
  index: number
) => {
  const constraints = Arr.fromIterable(constraintsInput)
  return Arr.map(constraints, (values) => constraintValueAt(values, index))
}

const boundsFromValues = (valuesInput: Iterable<number>): ConstraintBounds => {
  const values = Arr.fromIterable(valuesInput)

  const finiteValues = Arr.filter(values, isFinite)

  return Arr.get(finiteValues, 0).pipe(
    Option.match({
      onNone: () =>
        new ConstraintBounds({
          low: Num.negate(1),
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
          Match.orElse(() => Num.max(1, Num.multiply(span, boundsPaddingRatio)))
        )

        return new ConstraintBounds({
          low: Num.subtract(range.minimum, padding),
          high: Num.sum(range.maximum, padding)
        })
      }
    })
  )
}

const gammaFromValues = (valuesInput: Iterable<number>): number => {
  const values = Arr.fromIterable(valuesInput)
  return Match.value(Num.lessThanOrEqualTo(Arr.length(values), 0)).pipe(
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
        minimum: minimumDensityRatio,
        maximum: Num.subtract(1, minimumDensityRatio)
      })
    })
  )
}

const modelFromValues = (valuesInput: Iterable<number>): ConstraintDensityModel => {
  const values = Arr.fromIterable(valuesInput)

  const bounds = boundsFromValues(values)
  const feasibleValues = Arr.filter(values, (value) => isConstraintSatisfied(value))
  const infeasibleValues = Arr.filter(values, (value) => Bool.not(isConstraintSatisfied(value)))

  return new ConstraintDensityModel({
    gamma: gammaFromValues(values),
    feasibleParzen: buildContinuousParzen(feasibleValues, bounds.low, bounds.high),
    infeasibleParzen: buildContinuousParzen(infeasibleValues, bounds.low, bounds.high),
    hasFeasible: Num.greaterThan(Arr.length(feasibleValues), 0),
    hasInfeasible: Num.greaterThan(Arr.length(infeasibleValues), 0)
  })
}

const stabilizeRatio = (ratio: number): number =>
  Match.value(isFinite(ratio)).pipe(
    Match.when(true, () =>
      Num.clamp(ratio, {
        minimum: minimumDensityRatio,
        maximum: maximumDensityRatio
      })),
    Match.orElse(() =>
      Match.value(Num.greaterThan(ratio, 0)).pipe(
        Match.when(true, () => maximumDensityRatio),
        Match.orElse(() => minimumDensityRatio)
      )
    )
  )

export const buildConstraintDensityModels = (
  constraintsInput: Iterable<Vector>
) => {
  const constraints = Arr.fromIterable(constraintsInput)
  return Arr.makeBy(
    constraintDimensionCount(constraints),
    (index) => modelFromValues(valuesForDimension(constraints, index))
  )
}

export const constraintDensityRatio = (
  model: ConstraintDensityModel,
  value: number
): number =>
  Match.value(Bool.or(Bool.not(model.hasFeasible), Bool.not(model.hasInfeasible))).pipe(
    Match.when(true, () => 1),
    Match.orElse(() => {
      const constrainedValue = finiteConstraintValue(value)
      const ratio = stabilizeRatio(
        exp(
          Num.subtract(
            logDensity(model.feasibleParzen, constrainedValue),
            logDensity(model.infeasibleParzen, constrainedValue)
          )
        )
      )
      const denominator = Num.sum(Num.multiply(model.gamma, ratio), Num.subtract(1, model.gamma))

      return Match.value(Bool.and(isFinite(denominator), Num.greaterThan(denominator, 0))).pipe(
        Match.when(true, () => stabilizeRatio(Num.unsafeDivide(ratio, denominator))),
        Match.orElse(() => minimumDensityRatio)
      )
    })
  )

export const constraintDensityRatioLogProduct = (
  modelsInput: Iterable<ConstraintDensityModel>,
  constraintsInput: Iterable<number>
): number => {
  const models = Arr.fromIterable(modelsInput)
  const constraints = Arr.fromIterable(constraintsInput)
  return Arr.reduce(models, 0, (sum, model, index) =>
    Num.sum(
      sum,
      logStrict(
        constraintDensityRatio(model, constraintValueAt(constraints, index))
      )
    ))
}

export const constraintDensityRatioProduct = (
  modelsInput: Iterable<ConstraintDensityModel>,
  constraintsInput: Iterable<number>
): number => {
  const models = Arr.fromIterable(modelsInput)
  const constraints = Arr.fromIterable(constraintsInput)
  return exp(constraintDensityRatioLogProduct(models, constraints))
}
