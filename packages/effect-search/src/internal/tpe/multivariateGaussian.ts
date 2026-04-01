import { Array as Arr, Chunk, Equal, Match, Number as Num, Option } from "effect"
import { logStrict, logSumExp } from "effect-math/Numeric"

import { ndtriExp } from "./truncatedNormal/normal.js"

const LOG_SQRT_2PI = 0.5 * logStrict(2 * 3.141592653589793)
const EPSILON = 1e-12

const valueAt = (values: ReadonlyArray<number>, index: number, fallback: number): number =>
  Arr.get(values, index).pipe(Option.getOrElse(() => fallback))

const validSigma = (sigma: number): number =>
  Match.value(Number.isFinite(sigma) && sigma > 0).pipe(
    Match.when(true, () => sigma),
    Match.when(false, () => EPSILON),
    Match.exhaustive
  )

const validWeight = (weight: number): number =>
  Match.value(Number.isFinite(weight) && weight > 0).pipe(
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
      maximum: 1 - EPSILON
    }
  )

const hasMatchingDimensions = (
  point: ReadonlyArray<number>,
  mean: ReadonlyArray<number>,
  sigmas: ReadonlyArray<number>
): boolean => Equal.equals(point.length, mean.length) && Equal.equals(mean.length, sigmas.length)

const componentAt = (
  components: ReadonlyArray<ReadonlyArray<number>>,
  index: number
): ReadonlyArray<number> => Arr.get(components, index).pipe(Option.getOrElse(() => Arr.empty<number>()))

const cumulativeWeights = (weights: ReadonlyArray<number>): ReadonlyArray<number> =>
  Arr.reduce(weights, Arr.empty<number>(), (accumulator, weight) => {
    const previous = valueAt(accumulator, accumulator.length - 1, 0)
    return Arr.append(accumulator, Num.sum(previous, weight))
  })

const uniformWeights = (componentCount: number): ReadonlyArray<number> =>
  Match.value(Num.lessThanOrEqualTo(componentCount, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.makeBy(componentCount, () => Num.unsafeDivide(1, componentCount)))
  )

const normalizeWeights = (
  componentCount: number,
  weights: ReadonlyArray<number>
): ReadonlyArray<number> => {
  const clamped = Arr.makeBy(componentCount, (index) => validWeight(valueAt(weights, index, 0)))
  const total = Arr.reduce(clamped, 0, (accumulator, weight) => Num.sum(accumulator, weight))

  return Match.value(Num.greaterThan(total, 0)).pipe(
    Match.when(true, () => Arr.map(clamped, (weight) => Num.unsafeDivide(weight, total))),
    Match.orElse(() => uniformWeights(componentCount))
  )
}

const chooseComponentIndex = (weights: ReadonlyArray<number>, componentRoll: number): number =>
  Match.value(Num.lessThanOrEqualTo(weights.length, 0)).pipe(
    Match.when(true, () => 0),
    Match.orElse(() => {
      const cumulative = cumulativeWeights(weights)
      const index = Arr.findFirstIndex(
        cumulative,
        (weight) => Num.greaterThanOrEqualTo(weight, validProbability(componentRoll))
      ).pipe(Option.getOrElse(() => weights.length - 1))

      return Num.clamp(index, { minimum: 0, maximum: weights.length - 1 })
    })
  )

const quantileFromRoll = (roll: number): number => ndtriExp(logStrict(validProbability(roll)))

export const diagonalGaussianLogDensity = (
  point: ReadonlyArray<number>,
  mean: ReadonlyArray<number>,
  sigmas: ReadonlyArray<number>
): number =>
  Match.value(hasMatchingDimensions(point, mean, sigmas)).pipe(
    Match.when(false, () => Number.NEGATIVE_INFINITY),
    Match.when(true, () =>
      Arr.reduce(point, 0, (accumulator, coordinate, index) => {
        const currentMean = valueAt(mean, index, 0)
        const sigma = validSigma(valueAt(sigmas, index, EPSILON))
        const normalized = (coordinate - currentMean) / sigma

        return accumulator + (-LOG_SQRT_2PI - logStrict(sigma) - 0.5 * normalized * normalized)
      })),
    Match.exhaustive
  )

export const diagonalGaussianMixtureLogDensity = (
  point: ReadonlyArray<number>,
  means: ReadonlyArray<ReadonlyArray<number>>,
  sigmas: ReadonlyArray<ReadonlyArray<number>>,
  weights: ReadonlyArray<number>
): number => {
  const componentCount = means.length
  const normalizedWeights = normalizeWeights(componentCount, weights)
  const componentLogDensities = Arr.makeBy(componentCount, (index) => {
    const mean = componentAt(means, index)
    const sigma = componentAt(sigmas, index)
    const weight = valueAt(normalizedWeights, index, 0)

    return Match.value(Num.lessThanOrEqualTo(weight, 0)).pipe(
      Match.when(true, () => Number.NEGATIVE_INFINITY),
      Match.orElse(() => logStrict(weight) + diagonalGaussianLogDensity(point, mean, sigma))
    )
  })

  return logSumExp(Chunk.fromIterable(componentLogDensities))
}

export const sampleDiagonalGaussian = (
  mean: ReadonlyArray<number>,
  sigmas: ReadonlyArray<number>,
  rolls: ReadonlyArray<number>
): ReadonlyArray<number> =>
  Match.value(hasMatchingDimensions(mean, mean, sigmas)).pipe(
    Match.when(false, () => Arr.empty<number>()),
    Match.orElse(() =>
      Arr.map(mean, (currentMean, index) => {
        const sigma = validSigma(valueAt(sigmas, index, EPSILON))
        const quantile = quantileFromRoll(valueAt(rolls, index, 0.5))
        return currentMean + sigma * quantile
      })
    )
  )

export const sampleDiagonalGaussianMixture = (
  means: ReadonlyArray<ReadonlyArray<number>>,
  sigmas: ReadonlyArray<ReadonlyArray<number>>,
  weights: ReadonlyArray<number>,
  componentRoll: number,
  valueRolls: ReadonlyArray<number>
): ReadonlyArray<number> => {
  const normalizedWeights = normalizeWeights(means.length, weights)
  const componentIndex = chooseComponentIndex(normalizedWeights, componentRoll)

  return sampleDiagonalGaussian(componentAt(means, componentIndex), componentAt(sigmas, componentIndex), valueRolls)
}

export const scottsFactor = (sampleCount: number, dimensions: number): number =>
  Match.value(sampleCount > 0 && dimensions > 0).pipe(
    Match.when(true, () => sampleCount ** (-1 / (dimensions + 4))),
    Match.when(false, () => 1),
    Match.exhaustive
  )

export const scottsBandwidth = (sampleCount: number, dimensions: number, stddev: number): number =>
  validSigma(stddev) * scottsFactor(sampleCount, dimensions)

export const scottsBandwidthVector = (
  sampleCount: number,
  dimensions: number,
  stddevs: ReadonlyArray<number>
): ReadonlyArray<number> => Arr.map(stddevs, (stddev) => scottsBandwidth(sampleCount, dimensions, stddev))
