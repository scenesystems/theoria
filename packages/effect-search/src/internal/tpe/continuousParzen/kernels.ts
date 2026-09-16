import { Array as Arr, Boolean, HashMap, Match, Number as Num, Option, Order, Tuple } from "effect"

import { defaultWeights } from "../recencyWeights.js"
import { minimumBandwidth, sum, valueAt } from "./helpers.js"
import type { ContinuousParzen, ContinuousValues } from "./model.js"
import { CONSIDER_ENDPOINTS, CONSIDER_MAGIC_CLIP, ContinuousKernel, EPS, PRIOR_WEIGHT } from "./model.js"

export const clipSigma = (sigma: number, low: number, high: number, nKernels: number): number => {
  const maxSigma = Num.subtract(high, low)
  const minSigma = Boolean.match(CONSIDER_MAGIC_CLIP, {
    onTrue: () => minimumBandwidth(low, high, nKernels),
    onFalse: () => EPS
  })

  return Num.clamp(sigma, {
    minimum: minSigma,
    maximum: maxSigma
  })
}

export const normalizedKernelWeights = (observationCount: number): ContinuousValues => {
  const observationWeights = defaultWeights(observationCount)
  const kernelWeights = Arr.append(observationWeights, PRIOR_WEIGHT)
  const totalWeight = sum(kernelWeights)

  return Boolean.match(Num.lessThanOrEqualTo(totalWeight, 0), {
    onTrue: () => {
      const uniform = Num.unsafeDivide(1, Num.max(Arr.length(kernelWeights), 1))
      return Arr.makeBy(Arr.length(kernelWeights), () => uniform)
    },
    onFalse: () => Arr.map(kernelWeights, (weight) => Num.unsafeDivide(weight, totalWeight))
  })
}

export const observationSigmas = (
  observations: ContinuousValues,
  low: number,
  high: number
): ContinuousValues => {
  const priorMean = Num.unsafeDivide(Num.sum(low, high), 2)
  const meansWithPrior = Arr.append(observations, priorMean)
  const sorted = Arr.sort(
    Arr.map(meansWithPrior, (mean, index) => Tuple.make(index, mean)),
    Order.mapInput(Num.Order, Tuple.getSecond<number, number>)
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
    const center = valueAt(sortedMeansWithEndpoints, Num.increment(index), high)
    const right = valueAt(sortedMeansWithEndpoints, Num.sum(index, 2), high)

    return Num.max(Num.subtract(center, left), Num.subtract(right, center))
  })

  const endpointAdjustedSigmas = Boolean.match(
    Boolean.and(Boolean.not(CONSIDER_ENDPOINTS), Num.greaterThanOrEqualTo(Arr.length(sortedMeansWithEndpoints), 4)),
    {
      onTrue: () =>
        Arr.map(sortedSigmas, (sigma, index) =>
          Match.value(index).pipe(
            Match.when(
              0,
              () => Num.subtract(valueAt(sortedMeansWithEndpoints, 2, high), valueAt(sortedMeansWithEndpoints, 1, low))
            ),
            Match.when(Num.decrement(Arr.length(sortedSigmas)), () =>
              Num.subtract(
                valueAt(sortedMeansWithEndpoints, Num.subtract(Arr.length(sortedMeansWithEndpoints), 2), high),
                valueAt(sortedMeansWithEndpoints, Num.subtract(Arr.length(sortedMeansWithEndpoints), 3), low)
              )),
            Match.orElse(() => sigma)
          )),
      onFalse: () => sortedSigmas
    }
  )

  return Arr.map(observations, (_unused, observationIndex) => {
    const sortedIndex = HashMap.get(sortedPositionLookup, observationIndex).pipe(
      Option.getOrElse(() => -1)
    )

    return valueAt(endpointAdjustedSigmas, sortedIndex, Num.subtract(high, low))
  })
}

const positiveKernelWeight = (kernel: ContinuousKernel): number =>
  Boolean.match(Num.greaterThan(kernel.weight, 0), {
    onTrue: () => kernel.weight,
    onFalse: () => 0
  })

const cumulativeKernelWeights = (kernels: ContinuousParzen["kernels"]): ContinuousValues =>
  Arr.tailNonEmpty(Arr.scan(kernels, 0, (total, kernel) => Num.sum(total, positiveKernelWeight(kernel))))

export const chooseKernelIndex = (parzen: ContinuousParzen, roll: number): number => {
  const cumulative = cumulativeKernelWeights(parzen.kernels)
  const totalWeight = valueAt(cumulative, Num.decrement(Arr.length(cumulative)), 0)
  const clampedRoll = Num.clamp(roll, {
    minimum: 0,
    maximum: 1
  })
  const target = Num.multiply(clampedRoll, totalWeight)
  const index = Arr.findFirstIndex(cumulative, (value) => Num.greaterThanOrEqualTo(value, target)).pipe(
    Option.getOrElse(() => -1)
  )

  return Boolean.match(Num.lessThan(index, 0), {
    onTrue: () => Num.max(Num.decrement(Arr.length(parzen.kernels)), 0),
    onFalse: () => index
  })
}

const fallbackKernel = (parzen: ContinuousParzen): ContinuousKernel =>
  new ContinuousKernel({
    mean: Num.unsafeDivide(Num.sum(parzen.low, parzen.high), 2),
    sigma: Num.max(Num.subtract(parzen.high, parzen.low), minimumBandwidth(parzen.low, parzen.high, 1)),
    weight: 1
  })

export const kernelAt = (parzen: ContinuousParzen, index: number): ContinuousKernel =>
  Arr.get(parzen.kernels, index).pipe(
    Option.getOrElse(() => fallbackKernel(parzen))
  )
