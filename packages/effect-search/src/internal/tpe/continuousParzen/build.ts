import { Array as Arr, Boolean as Bool, Number as Num, Option } from "effect"

import { ContinuousKernel, ContinuousParzen } from "../continuousParzen.js"
import {
  bandwidthScaleFromNoiseEstimate,
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

  const nKernels = Num.increment(Arr.length(observations))
  const priorMean = Num.unsafeDivide(Num.sum(low, high), 2)
  const bandwidthScale = Bool.match(noiseOptions.noiseAware, {
    onFalse: () => 1,
    onTrue: () =>
      bandwidthScaleFromNoiseEstimate(
        estimateNoise(observations, low, high, empiricalObservationVariance),
        noiseOptions
      )
  })
  const baselineObservationSigmas = Arr.map(
    observationSigmas(observations, low, high),
    (sigma) => clipSigma(sigma, low, high, nKernels)
  )
  const clippedObservationSigmas = Arr.map(
    baselineObservationSigmas,
    (sigma) =>
      clipSigma(
        Num.multiply(sigma, bandwidthScale),
        low,
        high,
        nKernels
      )
  )
  const means = Arr.append(observations, priorMean)
  const sigmas = Arr.append(
    clippedObservationSigmas,
    clipSigma(
      Num.multiply(Num.subtract(high, low), bandwidthScale),
      low,
      high,
      nKernels
    )
  )
  const weights = normalizedKernelWeights(Arr.length(observations))
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
