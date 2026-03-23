import { Effect } from "effect"

import type { InvalidSamplerConfig } from "../../../Errors/index.js"
import {
  sample as sampleTruncated,
  sampleEffect as sampleTruncatedEffect,
  TruncatedNormalParams
} from "../truncatedNormal.js"
import { samplerMathError } from "./errors.js"
import { chooseKernelIndex, kernelAt } from "./kernels.js"
import type { ContinuousParzen } from "./model.js"

export const sampleFromParzen = (parzen: ContinuousParzen, kernelRoll: number, valueRoll: number): number => {
  const kernel = kernelAt(parzen, chooseKernelIndex(parzen, kernelRoll))

  return sampleTruncated(
    valueRoll,
    new TruncatedNormalParams({
      mean: kernel.mean,
      sigma: kernel.sigma,
      low: parzen.low,
      high: parzen.high
    })
  )
}

export const sampleFromParzenEffect = (
  parzen: ContinuousParzen,
  kernelRoll: number,
  valueRoll: number
): Effect.Effect<number, InvalidSamplerConfig> => {
  const kernel = kernelAt(parzen, chooseKernelIndex(parzen, kernelRoll))

  return sampleTruncatedEffect(
    valueRoll,
    new TruncatedNormalParams({
      mean: kernel.mean,
      sigma: kernel.sigma,
      low: parzen.low,
      high: parzen.high
    })
  ).pipe(
    Effect.mapError((error) => samplerMathError("sample", error))
  )
}
