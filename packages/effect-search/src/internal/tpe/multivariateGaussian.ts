import { logStrict, logSumExp } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean, Chunk, Equal, Match, Number as Num, Option, Schema } from "effect"

import { ndtriExp } from "./truncatedNormal/normal.js"

const LOG_SQRT_2PI = Num.multiply(0.5, logStrict(Num.multiply(2, 3.141592653589793)))
const EPSILON = 1e-12

export const GaussianVectorSchema = Schema.Array(Schema.Number)
export type GaussianVector = Schema.Schema.Type<typeof GaussianVectorSchema>

export const GaussianComponentsSchema = Schema.Array(GaussianVectorSchema)
export type GaussianComponents = Schema.Schema.Type<typeof GaussianComponentsSchema>

const isFinite = Schema.is(Schema.Finite)
const isNonNaN = Schema.is(Schema.NonNaN)

const positive = (value: number): boolean => Boolean.and(isNonNaN(value), Num.greaterThan(value, 0))

const valueAt = (values: GaussianVector, index: number, fallback: number): number =>
  Arr.get(values, index).pipe(Option.getOrElse(() => fallback))

const validSigma = (sigma: number): number =>
  Match.value(Boolean.and(isFinite(sigma), positive(sigma))).pipe(
    Match.when(true, () => sigma),
    Match.when(false, () => EPSILON),
    Match.exhaustive
  )

const validWeight = (weight: number): number =>
  Match.value(Boolean.and(isFinite(weight), positive(weight))).pipe(
    Match.when(true, () => weight),
    Match.when(false, () => 0),
    Match.exhaustive
  )

const validProbability = (roll: number): number =>
  Num.clamp(
    Match.value(isFinite(roll)).pipe(
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
  point: GaussianVector,
  mean: GaussianVector,
  sigmas: GaussianVector
): boolean =>
  Boolean.and(
    Equal.equals(Arr.length(point), Arr.length(mean)),
    Equal.equals(Arr.length(mean), Arr.length(sigmas))
  )

const componentAt = (
  components: GaussianComponents,
  index: number
): GaussianVector => Arr.get(components, index).pipe(Option.getOrElse(() => Arr.empty<number>()))

const cumulativeWeights = (weights: GaussianVector): GaussianVector => Arr.tailNonEmpty(Arr.scan(weights, 0, Num.sum))

const uniformWeights = (componentCount: number): GaussianVector =>
  Boolean.match(Num.lessThanOrEqualTo(componentCount, 0), {
    onTrue: () => Arr.empty<number>(),
    onFalse: () => Arr.makeBy(componentCount, () => Num.unsafeDivide(1, componentCount))
  })

const normalizeWeights = (
  componentCount: number,
  weights: GaussianVector
): GaussianVector => {
  const clamped = Arr.makeBy(componentCount, (index) => validWeight(valueAt(weights, index, 0)))
  const total = Arr.reduce(clamped, 0, (accumulator, weight) => Num.sum(accumulator, weight))

  return Boolean.match(Num.greaterThan(total, 0), {
    onTrue: () => Arr.map(clamped, (weight) => Num.unsafeDivide(weight, total)),
    onFalse: () => uniformWeights(componentCount)
  })
}

const chooseComponentIndex = (weights: GaussianVector, componentRoll: number): number =>
  Boolean.match(Num.lessThanOrEqualTo(Arr.length(weights), 0), {
    onTrue: () => 0,
    onFalse: () => {
      const cumulative = cumulativeWeights(weights)
      const index = Arr.findFirstIndex(
        cumulative,
        (weight) => Num.greaterThanOrEqualTo(weight, validProbability(componentRoll))
      ).pipe(Option.getOrElse(() => Num.decrement(Arr.length(weights))))

      return Num.clamp(index, { minimum: 0, maximum: Num.decrement(Arr.length(weights)) })
    }
  })

const quantileFromRoll = (roll: number): number => ndtriExp(logStrict(validProbability(roll)))

export const diagonalGaussianLogDensity = (
  point: GaussianVector,
  mean: GaussianVector,
  sigmas: GaussianVector
): number =>
  Match.value(hasMatchingDimensions(point, mean, sigmas)).pipe(
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
            Num.multiply(Num.multiply(0.5, normalized), normalized)
          )
        )
      })),
    Match.exhaustive
  )

export const diagonalGaussianMixtureLogDensity = (
  point: GaussianVector,
  means: GaussianComponents,
  sigmas: GaussianComponents,
  weights: GaussianVector
): number => {
  const componentCount = Arr.length(means)
  const normalizedWeights = normalizeWeights(componentCount, weights)
  const componentLogDensities = Arr.makeBy(componentCount, (index) => {
    const mean = componentAt(means, index)
    const sigma = componentAt(sigmas, index)
    const weight = valueAt(normalizedWeights, index, 0)

    return Boolean.match(Num.lessThanOrEqualTo(weight, 0), {
      onTrue: () => Number.NEGATIVE_INFINITY,
      onFalse: () => Num.sum(logStrict(weight), diagonalGaussianLogDensity(point, mean, sigma))
    })
  })

  return logSumExp(Chunk.fromIterable(componentLogDensities))
}

export const sampleDiagonalGaussian = (
  mean: GaussianVector,
  sigmas: GaussianVector,
  rolls: GaussianVector
): GaussianVector =>
  Boolean.match(hasMatchingDimensions(mean, mean, sigmas), {
    onFalse: () => Arr.empty<number>(),
    onTrue: () =>
      Arr.map(mean, (currentMean, index) => {
        const sigma = validSigma(valueAt(sigmas, index, EPSILON))
        const quantile = quantileFromRoll(valueAt(rolls, index, 0.5))
        return Num.sum(currentMean, Num.multiply(sigma, quantile))
      })
  })

export const sampleDiagonalGaussianMixture = (
  means: GaussianComponents,
  sigmas: GaussianComponents,
  weights: GaussianVector,
  componentRoll: number,
  valueRolls: GaussianVector
): GaussianVector => {
  const normalizedWeights = normalizeWeights(Arr.length(means), weights)
  const componentIndex = chooseComponentIndex(normalizedWeights, componentRoll)

  return sampleDiagonalGaussian(componentAt(means, componentIndex), componentAt(sigmas, componentIndex), valueRolls)
}

export const scottsFactor = (sampleCount: number, dimensions: number): number =>
  Match.value(Boolean.and(positive(sampleCount), positive(dimensions))).pipe(
    Match.when(true, () => sampleCount ** Num.negate(Num.unsafeDivide(1, Num.sum(dimensions, 4)))),
    Match.when(false, () => 1),
    Match.exhaustive
  )

export const scottsBandwidth = (sampleCount: number, dimensions: number, stddev: number): number =>
  Num.multiply(validSigma(stddev), scottsFactor(sampleCount, dimensions))

export const scottsBandwidthVector = (
  sampleCount: number,
  dimensions: number,
  stddevs: GaussianVector
): GaussianVector => Arr.map(stddevs, (stddev) => scottsBandwidth(sampleCount, dimensions, stddev))
