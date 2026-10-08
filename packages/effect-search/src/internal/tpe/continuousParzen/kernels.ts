import { Array as Arr, Boolean as Bool, HashMap, Match, Number as Num, Option, Order, Tuple } from "effect"

import { ContinuousKernel, type ContinuousParzen } from "../continuousParzen.js"
import { defaultWeights } from "../recencyWeights.js"

const priorKernelWeight = 1
const useMagicClip = true
const useEndpoints = false
const minimumSigma = 1e-12

export const minimumBandwidth = (low: number, high: number, kernelCount: number): number =>
  Num.divideUnsafe(Num.subtract(high, low), Num.min(100, Num.increment(kernelCount)))

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

/** Predetermined weights, when present, replace the default recency weights (Optuna's MOTPE path). */
export const normalizedKernelWeights = (
  observationCount: number,
  predeterminedWeights: Option.Option<ReadonlyArray<number>> = Option.none()
) => {
  const observationWeights = Option.getOrElse(predeterminedWeights, () => defaultWeights(observationCount))
  const kernelWeights = Arr.append(observationWeights, priorKernelWeight)
  const totalWeight = Num.sumAll(kernelWeights)

  return Match.value(Num.isLessThanOrEqualTo(totalWeight, 0)).pipe(
    Match.when(true, () => {
      const uniform = Num.divideUnsafe(1, Num.max(Arr.length(kernelWeights), 1))
      return Arr.makeBy(Arr.length(kernelWeights), () => uniform)
    }),
    Match.orElse(() => Arr.map(kernelWeights, (weight) => Num.divideUnsafe(weight, totalWeight)))
  )
}

export const observationSigmas = (
  observationsInput: Iterable<number>,
  low: number,
  high: number
) => {
  const observations = Arr.fromIterable(observationsInput)

  const sorted = Arr.sort(
    Arr.map(observations, (mean, index) => Tuple.make(index, mean)),
    Order.mapInput(Num.Order, (entry: readonly [number, number]) => entry[1])
  )
  const sortedPositionLookup = Arr.reduce(
    sorted,
    HashMap.empty<number, number>(),
    (lookup, entry, sortedIndex) => HashMap.set(lookup, entry[0], sortedIndex)
  )
  const sortedMeans = Arr.map(sorted, (entry) => entry[1])
  const sortedMeansWithEndpoints = Arr.prepend(Arr.append(sortedMeans, high), low)
  const sortedSigmas = Arr.map(sortedMeans, (_unused, index) => {
    const left = valueAt(sortedMeansWithEndpoints, index, low)
    const center = valueAt(sortedMeansWithEndpoints, Num.increment(index), high)
    const right = valueAt(sortedMeansWithEndpoints, Num.sum(index, 2), high)

    return Num.max(Num.subtract(center, left), Num.subtract(right, center))
  })

  const endpointAdjustedSigmas = Match.value(
    Bool.and(Bool.not(useEndpoints), Num.isGreaterThanOrEqualTo(Arr.length(sortedMeansWithEndpoints), 4))
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
      Option.getOrElse(() => Num.multiply(-1, 1))
    )

    return valueAt(endpointAdjustedSigmas, sortedIndex, Num.subtract(high, low))
  })
}

const positiveKernelWeight = (kernel: ContinuousKernel): number =>
  Match.value(Num.isGreaterThan(kernel.weight, 0)).pipe(
    Match.when(true, () => kernel.weight),
    Match.orElse(() => 0)
  )

const cumulativeKernelWeights = (kernelsInput: Iterable<ContinuousKernel>) => {
  const kernels = Arr.fromIterable(kernelsInput)
  return Arr.tailNonEmpty(Arr.scan(kernels, 0, (total, kernel) => Num.sum(total, positiveKernelWeight(kernel))))
}

export const chooseKernelIndex = (parzen: ContinuousParzen, roll: number): number => {
  const cumulative = cumulativeKernelWeights(parzen.kernels)
  const totalWeight = valueAt(cumulative, Num.decrement(Arr.length(cumulative)), 0)
  const clampedRoll = Num.clamp(roll, {
    minimum: 0,
    maximum: 1
  })
  const target = Num.multiply(clampedRoll, totalWeight)
  const index = Arr.findFirstIndex(cumulative, (value) => Num.isGreaterThanOrEqualTo(value, target)).pipe(
    Option.getOrElse(() => Num.multiply(-1, 1))
  )

  return Match.value(Num.isLessThan(index, 0)).pipe(
    Match.when(true, () => Num.max(Num.decrement(Arr.length(parzen.kernels)), 0)),
    Match.orElse(() => index)
  )
}

const fallbackKernel = (parzen: ContinuousParzen): ContinuousKernel =>
  new ContinuousKernel({
    mean: Num.divideUnsafe(Num.sum(parzen.low, parzen.high), 2),
    sigma: Num.max(Num.subtract(parzen.high, parzen.low), minimumBandwidth(parzen.low, parzen.high, 1)),
    weight: 1
  })

export const kernelAt = (parzen: ContinuousParzen, index: number): ContinuousKernel =>
  Arr.get(parzen.kernels, index).pipe(
    Option.getOrElse(() => fallbackKernel(parzen))
  )
