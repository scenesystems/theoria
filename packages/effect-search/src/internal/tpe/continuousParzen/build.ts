import { Array as Arr, Number as Num, Option } from "effect"

import {
  adjustBandwidthForNoise,
  defaultNoiseBandwidthOptions,
  estimateNoise,
  type NoiseBandwidthOptions
} from "../noiseEstimator.js"
import { valueAt } from "./helpers.js"
import { clipSigma, normalizedKernelWeights, observationSigmas } from "./kernels.js"
import { ContinuousKernel, ContinuousParzen } from "./model.js"

export const buildContinuousParzen = (
  observations: ReadonlyArray<number>,
  low: number,
  high: number,
  noiseOptions: NoiseBandwidthOptions = defaultNoiseBandwidthOptions,
  empiricalObservationVariance: Option.Option<number> = Option.none()
): ContinuousParzen => {
  const nKernels = observations.length + 1
  const priorMean = Num.unsafeDivide(low + high, 2)
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
      adjustBandwidthForNoise(high - low, noiseEstimate, noiseOptions),
      low,
      high,
      nKernels
    )
  )
  const weights = normalizedKernelWeights(observations.length)
  const kernels = Arr.map(means, (mean, index) =>
    new ContinuousKernel({
      mean,
      sigma: valueAt(sigmas, index, high - low),
      weight: valueAt(weights, index, 0)
    }))

  return new ContinuousParzen({
    low,
    high,
    kernels
  })
}
