import { Effect } from "effect"

import type { InvalidSamplerConfig } from "../../../Errors/index.js"
import { sample as sampleTruncated, sampleEffect as sampleTruncatedEffect } from "../truncatedNormal.js"
import type { TruncatedNormalParams } from "../truncatedNormal.js"
import { samplerMathError } from "./errors.js"
import { chooseKernelIndex, kernelAt } from "./kernels.js"
import type { ContinuousKernel, ContinuousParzen } from "./model.js"

const paramsForKernel = (parzen: ContinuousParzen, kernel: ContinuousKernel): TruncatedNormalParams => ({
  mean: kernel.mean,
  sigma: kernel.sigma,
  low: parzen.low,
  high: parzen.high
})

export const sampleFromParzen = (parzen: ContinuousParzen, kernelRoll: number, valueRoll: number): number => {
  const kernel = kernelAt(parzen, chooseKernelIndex(parzen, kernelRoll))

  return sampleTruncated(valueRoll, paramsForKernel(parzen, kernel))
}

export const sampleFromParzenEffect = (
  parzen: ContinuousParzen,
  kernelRoll: number,
  valueRoll: number
): Effect.Effect<number, InvalidSamplerConfig> => {
  const kernel = kernelAt(parzen, chooseKernelIndex(parzen, kernelRoll))

  return sampleTruncatedEffect(valueRoll, paramsForKernel(parzen, kernel)).pipe(
    Effect.mapError((error) => samplerMathError("sample", error))
  )
}
