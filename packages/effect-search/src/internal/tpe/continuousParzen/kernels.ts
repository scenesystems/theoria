import { Array as Arr, Boolean as Bool, HashMap, Match, Number as Num, Option, Order, Tuple } from "effect"

import { ContinuousKernel, type ContinuousParzen } from "../continuousParzen.js"
import { defaultWeights } from "../recencyWeights.js"

const priorKernelWeight = 1
const useMagicClip = true
const useEndpoints = false
const minimumSigma = 1e-12

export const minimumBandwidth = (low: number, high: number, kernelCount: number): number =>
  Num.unsafeDivide(Num.subtract(high, low), Num.min(100, Num.increment(kernelCount)))

export const valueAt = <A>(valuesInput: Iterable<A>, index: number, fallback: A): A => {
  const values = Arr.fromIterable(valuesInput)
  return Arr.get(values, index).pipe(
    Option.getOrElse(() => fallback)
  )
}

export const clipSigma = (sigma: number, low: number, high: number, nKernels: number): number => {
  const maxSigma = Num.subtract(high, low)
  const minSigma = Match.value(useMagicClip).pipe(
    Match.when(true, () => minimumBandwidth(low, high, nKernels)),
    Match.orElse(() => minimumSigma)
  )

  return Num.clamp(sigma, {
    minimum: minSigma,
    maximum: maxSigma
  })
}

export const normalizedKernelWeights = (observationCount: number) => {
  const observationWeights = defaultWeights(observationCount)
  const kernelWeights = Arr.append(observationWeights, priorKernelWeight)
  const totalWeight = Num.sumAll(kernelWeights)

  return Match.value(Num.lessThanOrEqualTo(totalWeight, 0)).pipe(
    Match.when(true, () => {
      const uniform = Num.unsafeDivide(1, Num.max(Arr.length(kernelWeights), 1))
      return Arr.makeBy(Arr.length(kernelWeights), () => uniform)
    }),
    Match.orElse(() => Arr.map(kernelWeights, (weight) => Num.unsafeDivide(weight, totalWeight)))
  )
}

export const observationSigmas = (
  observationsInput: Iterable<number>,
  low: number,
  high: number
) => {
  const observations = Arr.fromIterable(observationsInput)

  const priorMean = Num.unsafeDivide(Num.sum(low, high), 2)
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
    const center = valueAt(sortedMeansWithEndpoints, Num.increment(index), high)
    const right = valueAt(sortedMeansWithEndpoints, Num.sum(index, 2), high)

    return Num.max(Num.subtract(center, left), Num.subtract(right, center))
  })

  const endpointAdjustedSigmas = Match.value(
    Bool.and(Bool.not(useEndpoints), Num.greaterThanOrEqualTo(Arr.length(sortedMeansWithEndpoints), 4))
  ).pipe(
    Match.when(true, () =>
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
        ))),
    Match.orElse(() => sortedSigmas)
  )

  return Arr.map(observations, (_unused, observationIndex) => {
    const sortedIndex = HashMap.get(sortedPositionLookup, observationIndex).pipe(
      Option.getOrElse(() => Num.negate(1))
    )

    return valueAt(endpointAdjustedSigmas, sortedIndex, Num.subtract(high, low))
  })
}

const positiveKernelWeight = (kernel: ContinuousKernel): number =>
  Match.value(Num.greaterThan(kernel.weight, 0)).pipe(
    Match.when(true, () => kernel.weight),
    Match.orElse(() => 0)
  )

const cumulativeKernelWeights = (kernelsInput: Iterable<ContinuousKernel>) => {
  const kernels = Arr.fromIterable(kernelsInput)
  return Arr.tailNonEmpty(Arr.scan(kernels, 0, (total, kernel) => Num.sum(total, positiveKernelWeight(kernel))))
}

export const prepareChooseKernelIndex = (parzen: ContinuousParzen): (roll: number) => number => {
  const cumulative = cumulativeKernelWeights(parzen.kernels)
  const totalWeight = valueAt(cumulative, Num.decrement(Arr.length(cumulative)), 0)
  const fallback = Num.max(Num.decrement(Arr.length(parzen.kernels)), 0)
  return (roll) => {
    const target = Num.multiply(Num.clamp(roll, { minimum: 0, maximum: 1 }), totalWeight)
    return Option.getOrElse(
      Arr.findFirstIndex(cumulative, (value) => Num.greaterThanOrEqualTo(value, target)),
      () => fallback
    )
  }
}

export const chooseKernelIndex = (parzen: ContinuousParzen, roll: number): number =>
  prepareChooseKernelIndex(parzen)(roll)

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
