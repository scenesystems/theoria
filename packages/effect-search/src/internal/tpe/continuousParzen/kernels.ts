import { Array as Arr, HashMap, Match, Number as Num, Option, Order, Tuple } from "effect"

import { defaultWeights } from "../recencyWeights.js"
import { minimumBandwidth, sum, valueAt } from "./helpers.js"
import type { ContinuousParzen } from "./model.js"
import { CONSIDER_ENDPOINTS, CONSIDER_MAGIC_CLIP, ContinuousKernel, EPS, PRIOR_WEIGHT } from "./model.js"

export const clipSigma = (sigma: number, low: number, high: number, nKernels: number): number => {
  const maxSigma = high - low
  const minSigma = Match.value(CONSIDER_MAGIC_CLIP).pipe(
    Match.when(true, () => minimumBandwidth(low, high, nKernels)),
    Match.orElse(() => EPS)
  )

  return Num.clamp(sigma, {
    minimum: minSigma,
    maximum: maxSigma
  })
}

export const normalizedKernelWeights = (observationCount: number): ReadonlyArray<number> => {
  const observationWeights = defaultWeights(observationCount)
  const kernelWeights = Arr.append(observationWeights, PRIOR_WEIGHT)
  const totalWeight = sum(kernelWeights)

  return Match.value(Num.lessThanOrEqualTo(totalWeight, 0)).pipe(
    Match.when(true, () => {
      const uniform = Num.unsafeDivide(1, Num.max(kernelWeights.length, 1))
      return Arr.makeBy(kernelWeights.length, () => uniform)
    }),
    Match.orElse(() => Arr.map(kernelWeights, (weight) => Num.unsafeDivide(weight, totalWeight)))
  )
}

export const observationSigmas = (
  observations: ReadonlyArray<number>,
  low: number,
  high: number
): ReadonlyArray<number> => {
  const priorMean = Num.unsafeDivide(low + high, 2)
  const meansWithPrior = Arr.append(observations, priorMean)
  const sorted = Arr.sort(
    Arr.map(meansWithPrior, (mean, index) => Tuple.make(index, mean)),
    Order.mapInput(Num.Order, (entry: readonly [number, number]) => Tuple.getSecond(entry))
  )
  const sortedPositionLookup = Arr.reduce(
    sorted,
    HashMap.empty<number, number>(),
    (lookup, entry, sortedIndex) => HashMap.set(lookup, Tuple.getFirst(entry), sortedIndex)
  )
  const sortedMeans = Arr.map(sorted, Tuple.getSecond)
  const sortedMeansWithEndpoints = Arr.prepend(Arr.append(sortedMeans, high), low)
  const sortedSigmas = Arr.map(sortedMeans, (_unused, index) => {
    const left = valueAt(sortedMeansWithEndpoints, index, low)
    const center = valueAt(sortedMeansWithEndpoints, index + 1, high)
    const right = valueAt(sortedMeansWithEndpoints, index + 2, high)

    return Num.max(center - left, right - center)
  })

  const endpointAdjustedSigmas = Match.value(
    !CONSIDER_ENDPOINTS && Num.greaterThanOrEqualTo(sortedMeansWithEndpoints.length, 4)
  ).pipe(
    Match.when(true, () =>
      Arr.map(sortedSigmas, (sigma, index) =>
        Match.value(index).pipe(
          Match.when(0, () => valueAt(sortedMeansWithEndpoints, 2, high) - valueAt(sortedMeansWithEndpoints, 1, low)),
          Match.when(sortedSigmas.length - 1, () =>
            valueAt(sortedMeansWithEndpoints, sortedMeansWithEndpoints.length - 2, high) -
            valueAt(sortedMeansWithEndpoints, sortedMeansWithEndpoints.length - 3, low)),
          Match.orElse(() => sigma)
        ))),
    Match.orElse(() => sortedSigmas)
  )

  return Arr.map(observations, (_unused, observationIndex) => {
    const sortedIndex = HashMap.get(sortedPositionLookup, observationIndex).pipe(
      Option.getOrElse(() => -1)
    )

    return valueAt(endpointAdjustedSigmas, sortedIndex, high - low)
  })
}

const positiveKernelWeight = (kernel: ContinuousKernel): number =>
  Match.value(Num.greaterThan(kernel.weight, 0)).pipe(
    Match.when(true, () => kernel.weight),
    Match.orElse(() => 0)
  )

const cumulativeKernelWeights = (kernels: ReadonlyArray<ContinuousKernel>): ReadonlyArray<number> =>
  Arr.reduce(kernels, Arr.empty<number>(), (acc, kernel) => {
    const last = valueAt(acc, acc.length - 1, 0)
    return Arr.append(acc, Num.sum(last, positiveKernelWeight(kernel)))
  })

export const chooseKernelIndex = (parzen: ContinuousParzen, roll: number): number => {
  const cumulative = cumulativeKernelWeights(parzen.kernels)
  const totalWeight = valueAt(cumulative, cumulative.length - 1, 0)
  const clampedRoll = Num.clamp(roll, {
    minimum: 0,
    maximum: 1
  })
  const target = Num.multiply(clampedRoll, totalWeight)
  const index = Arr.findFirstIndex(cumulative, (value) => Num.greaterThanOrEqualTo(value, target)).pipe(
    Option.getOrElse(() => -1)
  )

  return Match.value(Num.lessThan(index, 0)).pipe(
    Match.when(true, () => Num.max(parzen.kernels.length - 1, 0)),
    Match.orElse(() => index)
  )
}

const fallbackKernel = (parzen: ContinuousParzen): ContinuousKernel =>
  new ContinuousKernel({
    mean: Num.unsafeDivide(parzen.low + parzen.high, 2),
    sigma: Num.max(parzen.high - parzen.low, minimumBandwidth(parzen.low, parzen.high, 1)),
    weight: 1
  })

export const kernelAt = (parzen: ContinuousParzen, index: number): ContinuousKernel =>
  Arr.get(parzen.kernels, index).pipe(
    Option.getOrElse(() => fallbackKernel(parzen))
  )
