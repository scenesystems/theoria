import { logStrict, logSumExp, pow } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Chunk, Equal, Match, Number as Num, Option } from "effect"

import type { Vector } from "../../Objective.js"

import { ndtriExp } from "./truncatedNormal/normal.js"

const LOG_SQRT_2PI = Num.multiply(0.5, logStrict(Num.multiply(2, 3.141592653589793)))
const EPSILON = 1e-12

const valueAt = (valuesInput: Iterable<number>, index: number, fallback: number): number => {
  const values = Arr.fromIterable(valuesInput)
  return Arr.get(values, index).pipe(Option.getOrElse(() => fallback))
}

const validSigma = (sigma: number): number =>
  Match.value(Bool.and(Number.isFinite(sigma), Num.greaterThan(sigma, 0))).pipe(
    Match.when(true, () => sigma),
    Match.when(false, () => EPSILON),
    Match.exhaustive
  )

const validWeight = (weight: number): number =>
  Match.value(Bool.and(Number.isFinite(weight), Num.greaterThan(weight, 0))).pipe(
    Match.when(true, () => weight),
    Match.when(false, () => 0),
    Match.exhaustive
  )

const validProbability = (roll: number): number =>
  Num.clamp(
    Match.value(Number.isFinite(roll)).pipe(
      Match.when(true, () => roll),
      Match.when(false, () => 0.5),
      Match.exhaustive
    ),
    {
      minimum: EPSILON,
      maximum: Num.subtract(1, EPSILON)
    }
  )

const hasMatchingDimensions = (
  pointInput: Iterable<number>,
  meanInput: Iterable<number>,
  sigmasInput: Iterable<number>
): boolean => {
  const point = Arr.fromIterable(pointInput)
  const mean = Arr.fromIterable(meanInput)
  const sigmas = Arr.fromIterable(sigmasInput)
  return Bool.and(Equal.equals(point.length, mean.length), Equal.equals(mean.length, sigmas.length))
}

const componentAt = (
  componentsInput: Iterable<Vector>,
  index: number
) => {
  const components = Arr.fromIterable(componentsInput)
  return Arr.get(components, index).pipe(Option.getOrElse(() => Arr.empty<number>()))
}

const cumulativeWeights = (weightsInput: Iterable<number>) => {
  const weights = Arr.fromIterable(weightsInput)
  return Arr.reduce(weights, Arr.empty<number>(), (accumulator, weight) => {
    const previous = valueAt(accumulator, Num.decrement(accumulator.length), 0)
    return Arr.append(accumulator, Num.sum(previous, weight))
  })
}

const uniformWeights = (componentCount: number) =>
  Match.value(Num.lessThanOrEqualTo(componentCount, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.makeBy(componentCount, () => Num.unsafeDivide(1, componentCount)))
  )

const normalizeWeights = (
  componentCount: number,
  weightsInput: Iterable<number>
) => {
  const weights = Arr.fromIterable(weightsInput)

  const clamped = Arr.makeBy(componentCount, (index) => validWeight(valueAt(weights, index, 0)))
  const total = Arr.reduce(clamped, 0, (accumulator, weight) => Num.sum(accumulator, weight))

  return Match.value(Num.greaterThan(total, 0)).pipe(
    Match.when(true, () => Arr.map(clamped, (weight) => Num.unsafeDivide(weight, total))),
    Match.orElse(() => uniformWeights(componentCount))
  )
}

const chooseComponentIndex = (weightsInput: Iterable<number>, componentRoll: number): number => {
  const weights = Arr.fromIterable(weightsInput)
  return Match.value(Num.lessThanOrEqualTo(weights.length, 0)).pipe(
    Match.when(true, () => 0),
    Match.orElse(() => {
      const cumulative = cumulativeWeights(weights)
      const index = Arr.findFirstIndex(
        cumulative,
        (weight) => Num.greaterThanOrEqualTo(weight, validProbability(componentRoll))
      ).pipe(Option.getOrElse(() => Num.decrement(weights.length)))

      return Num.clamp(index, { minimum: 0, maximum: Num.decrement(weights.length) })
    })
  )
}

const quantileFromRoll = (roll: number): number => ndtriExp(logStrict(validProbability(roll)))

export const diagonalGaussianLogDensity = (
  pointInput: Iterable<number>,
  meanInput: Iterable<number>,
  sigmasInput: Iterable<number>
): number => {
  const point = Arr.fromIterable(pointInput)
  const mean = Arr.fromIterable(meanInput)
  const sigmas = Arr.fromIterable(sigmasInput)
  return Match.value(hasMatchingDimensions(point, mean, sigmas)).pipe(
    Match.when(false, () => Number.NEGATIVE_INFINITY),
    Match.when(true, () =>
      Arr.reduce(point, 0, (accumulator, coordinate, index) => {
        const currentMean = valueAt(mean, index, 0)
        const sigma = validSigma(valueAt(sigmas, index, EPSILON))
        const normalized = Num.unsafeDivide(Num.subtract(coordinate, currentMean), sigma)

        return Num.sum(
          accumulator,
          Num.subtract(
            Num.subtract(Num.negate(LOG_SQRT_2PI), logStrict(sigma)),
            Num.multiply(0.5, Num.multiply(normalized, normalized))
          )
        )
      })),
    Match.exhaustive
  )
}

export const diagonalGaussianMixtureLogDensity = (
  pointInput: Iterable<number>,
  meansInput: Iterable<Vector>,
  sigmasInput: Iterable<Vector>,
  weightsInput: Iterable<number>
): number => {
  const point = Arr.fromIterable(pointInput)
  const means = Arr.fromIterable(meansInput)
  const sigmas = Arr.fromIterable(sigmasInput)
  const weights = Arr.fromIterable(weightsInput)

  const componentCount = means.length
  const normalizedWeights = normalizeWeights(componentCount, weights)
  const componentLogDensities = Arr.makeBy(componentCount, (index) => {
    const mean = componentAt(means, index)
    const sigma = componentAt(sigmas, index)
    const weight = valueAt(normalizedWeights, index, 0)

    return Match.value(Num.lessThanOrEqualTo(weight, 0)).pipe(
      Match.when(true, () => Number.NEGATIVE_INFINITY),
      Match.orElse(() => Num.sum(logStrict(weight), diagonalGaussianLogDensity(point, mean, sigma)))
    )
  })

  return logSumExp(Chunk.fromIterable(componentLogDensities))
}

export const sampleDiagonalGaussian = (
  meanInput: Iterable<number>,
  sigmasInput: Iterable<number>,
  rollsInput: Iterable<number>
) => {
  const mean = Arr.fromIterable(meanInput)
  const sigmas = Arr.fromIterable(sigmasInput)
  const rolls = Arr.fromIterable(rollsInput)
  return Match.value(hasMatchingDimensions(mean, mean, sigmas)).pipe(
    Match.when(false, () => Arr.empty<number>()),
    Match.orElse(() =>
      Arr.map(mean, (currentMean, index) => {
        const sigma = validSigma(valueAt(sigmas, index, EPSILON))
        const quantile = quantileFromRoll(valueAt(rolls, index, 0.5))
        return Num.sum(currentMean, Num.multiply(sigma, quantile))
      })
    )
  )
}

export const sampleDiagonalGaussianMixture = (
  meansInput: Iterable<Vector>,
  sigmasInput: Iterable<Vector>,
  weightsInput: Iterable<number>,
  componentRoll: number,
  valueRollsInput: Iterable<number>
) => {
  const means = Arr.fromIterable(meansInput)
  const sigmas = Arr.fromIterable(sigmasInput)
  const weights = Arr.fromIterable(weightsInput)
  const valueRolls = Arr.fromIterable(valueRollsInput)

  const normalizedWeights = normalizeWeights(means.length, weights)
  const componentIndex = chooseComponentIndex(normalizedWeights, componentRoll)

  return sampleDiagonalGaussian(componentAt(means, componentIndex), componentAt(sigmas, componentIndex), valueRolls)
}

export const scottsFactor = (sampleCount: number, dimensions: number): number =>
  Match.value(Bool.and(Num.greaterThan(sampleCount, 0), Num.greaterThan(dimensions, 0))).pipe(
    Match.when(true, () => pow(sampleCount, Num.unsafeDivide(-1, Num.sum(dimensions, 4)))),
    Match.when(false, () => 1),
    Match.exhaustive
  )

export const scottsBandwidth = (sampleCount: number, dimensions: number, stddev: number): number =>
  Num.multiply(validSigma(stddev), scottsFactor(sampleCount, dimensions))

export const scottsBandwidthVector = (
  sampleCount: number,
  dimensions: number,
  stddevsInput: Iterable<number>
) => {
  const stddevs = Arr.fromIterable(stddevsInput)
  return Arr.map(stddevs, (stddev) => scottsBandwidth(sampleCount, dimensions, stddev))
}
