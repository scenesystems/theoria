import { Array as Arr, Number as Num, Option } from "effect"

import { ContinuousKernel, ContinuousParzen } from "../continuousParzen.js"
import {
  adjustBandwidthForNoise,
  defaultNoiseBandwidthOptions,
  estimateNoise,
  type NoiseBandwidthOptions
} from "../noiseEstimator.js"
import { clipSigma, normalizedKernelWeights, observationSigmas, valueAt } from "./kernels.js"

export const buildContinuousParzen = (
  observationsInput: Iterable<number>,
  low: number,
  high: number,
  noiseOptions: NoiseBandwidthOptions = defaultNoiseBandwidthOptions,
  empiricalObservationVariance: Option.Option<number> = Option.none()
): ContinuousParzen => {
  const observations = Arr.fromIterable(observationsInput)

  const nKernels = Num.increment(observations.length)
  const priorMean = Num.unsafeDivide(Num.sum(low, high), 2)
  const noiseEstimate = estimateNoise(observations, low, high, empiricalObservationVariance)
  const baselineObservationSigmas = Arr.map(
    observationSigmas(observations, low, high),
    (sigma) => clipSigma(sigma, low, high, nKernels)
  )
  const clippedObservationSigmas = Arr.map(
    baselineObservationSigmas,
    (sigma) =>
      clipSigma(
        adjustBandwidthForNoise(sigma, noiseEstimate, noiseOptions),
        low,
        high,
        nKernels
      )
  )
  const means = Arr.append(observations, priorMean)
  const sigmas = Arr.append(
    clippedObservationSigmas,
    clipSigma(
      adjustBandwidthForNoise(Num.subtract(high, low), noiseEstimate, noiseOptions),
      low,
      high,
      nKernels
    )
  )
  const weights = normalizedKernelWeights(observations.length)
  const kernels = Arr.map(means, (mean, index) =>
    new ContinuousKernel({
      mean,
      sigma: valueAt(sigmas, index, Num.subtract(high, low)),
      weight: valueAt(weights, index, 0)
    }))

  return new ContinuousParzen({
    low,
    high,
    kernels
  })
}
