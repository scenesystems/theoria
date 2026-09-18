import { isFinite, logStrict, logSumExp, pow } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Chunk, Equal, Match, Number as Num, Option, Tuple } from "effect"

import type { Vector } from "../../Objective.js"

import { ndtriExp } from "./truncatedNormal/normal.js"

const logSqrtTwoPi = Num.multiply(0.5, logStrict(Num.multiply(2, 3.141592653589793)))
const minimumScale = 1e-12

const valueAt = (valuesInput: Iterable<number>, index: number, fallback: number): number => {
  const values = Arr.fromIterable(valuesInput)
  return Arr.get(values, index).pipe(Option.getOrElse(() => fallback))
}

const validSigma = (sigma: number): number =>
  Match.value(Bool.and(isFinite(sigma), Num.greaterThan(sigma, 0))).pipe(
    Match.when(true, () => sigma),
    Match.when(false, () => minimumScale),
    Match.exhaustive
  )

const validWeight = (weight: number): number =>
  Match.value(Bool.and(isFinite(weight), Num.greaterThan(weight, 0))).pipe(
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
      minimum: minimumScale,
      maximum: Num.subtract(1, minimumScale)
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
  return Bool.and(
    Equal.equals(Arr.length(point), Arr.length(mean)),
    Equal.equals(Arr.length(mean), Arr.length(sigmas))
  )
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
  return Arr.tailNonEmpty(Arr.scan(weights, 0, Num.sum))
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

const chooseComponentIndex = (cumulative: Vector, componentRoll: number): number => {
  return Match.value(Num.lessThanOrEqualTo(Arr.length(cumulative), 0)).pipe(
    Match.when(true, () => 0),
    Match.orElse(() => {
      const probability = validProbability(componentRoll)
      const index = Arr.findFirstIndex(
        cumulative,
        (weight) => Num.greaterThanOrEqualTo(weight, probability)
      ).pipe(Option.getOrElse(() => Num.decrement(Arr.length(cumulative))))

      return Num.clamp(index, { minimum: 0, maximum: Num.decrement(Arr.length(cumulative)) })
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
        const sigma = validSigma(valueAt(sigmas, index, minimumScale))
        const normalized = Num.unsafeDivide(Num.subtract(coordinate, currentMean), sigma)

        return Num.sum(
          accumulator,
          Num.subtract(
            Num.subtract(Num.negate(logSqrtTwoPi), logStrict(sigma)),
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

  const componentCount = Arr.length(means)
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

/** Prepares model constants once per candidate batch, retaining both reduction orders. */
export const prepareDiagonalGaussianMixtureLogDensity = (
  meansInput: Iterable<Vector>,
  sigmasInput: Iterable<Vector>,
  weightsInput: Iterable<number>
): (pointInput: Iterable<number>) => number => {
  const means = Arr.fromIterable(meansInput)
  const sigmas = Arr.fromIterable(sigmasInput)
  const weights = normalizeWeights(Arr.length(means), weightsInput)
  const components = Arr.map(means, (mean, index) => {
    const scales = componentAt(sigmas, index)
    const weight = valueAt(weights, index, 0)
    return Bool.match(
      Bool.or(Num.lessThanOrEqualTo(weight, 0), Bool.not(Num.Equivalence(Arr.length(mean), Arr.length(scales)))),
      {
        onTrue: (): (point: Vector) => number => () => Number.NEGATIVE_INFINITY,
        onFalse: () => {
          const logWeight = logStrict(weight)
          const coordinates = Arr.zipWith(mean, scales, (center, scale) => {
            const sigma = validSigma(scale)
            return Tuple.make(center, sigma, Num.subtract(Num.negate(logSqrtTwoPi), logStrict(sigma)))
          })
          return (point: Vector): number =>
            Bool.match(Num.Equivalence(Arr.length(point), Arr.length(coordinates)), {
              onFalse: () => Number.NEGATIVE_INFINITY,
              onTrue: () =>
                Num.sum(
                  logWeight,
                  Arr.reduce(point, 0, (total, value, axis) => {
                    const [mean, sigma, normalizer] = Arr.unsafeGet(coordinates, axis)
                    const normalized = Num.unsafeDivide(Num.subtract(value, mean), sigma)
                    return Num.sum(
                      total,
                      Num.subtract(normalizer, Num.multiply(0.5, Num.multiply(normalized, normalized)))
                    )
                  })
                )
            })
        }
      }
    )
  })
  return (pointInput) => {
    const point = Arr.fromIterable(pointInput)
    return logSumExp(Chunk.fromIterable(Arr.map(components, (component) => component(point))))
  }
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
        const sigma = validSigma(valueAt(sigmas, index, minimumScale))
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

  const normalizedWeights = normalizeWeights(Arr.length(means), weights)
  const componentIndex = chooseComponentIndex(cumulativeWeights(normalizedWeights), componentRoll)

  return sampleDiagonalGaussian(componentAt(means, componentIndex), componentAt(sigmas, componentIndex), valueRolls)
}

/** Reuses normalized cumulative weights without changing coordinate sampling or random draws. */
export const prepareSampleDiagonalGaussianMixture = (
  meansInput: Iterable<Vector>,
  sigmasInput: Iterable<Vector>,
  weightsInput: Iterable<number>
): (componentRoll: number, valueRolls: Iterable<number>) => Vector => {
  const means = Arr.fromIterable(meansInput)
  const sigmas = Arr.fromIterable(sigmasInput)
  const cumulative = cumulativeWeights(normalizeWeights(Arr.length(means), weightsInput))
  return (componentRoll, valueRolls) => {
    const index = chooseComponentIndex(cumulative, componentRoll)
    return sampleDiagonalGaussian(componentAt(means, index), componentAt(sigmas, index), valueRolls)
  }
}

export const scottsFactor = (sampleCount: number, dimensions: number): number =>
  Match.value(Bool.and(Num.greaterThan(sampleCount, 0), Num.greaterThan(dimensions, 0))).pipe(
    Match.when(true, () => pow(sampleCount, Num.unsafeDivide(Num.negate(1), Num.sum(dimensions, 4)))),
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
