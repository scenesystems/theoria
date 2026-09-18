import { Array as Arr, Effect, MutableHashMap, Option } from "effect"

import type { InvalidSamplerConfig } from "../../../SearchError.js"
import type { ContinuousKernel, ContinuousParzen } from "../continuousParzen.js"
import { sample as sampleTruncated, sampleEffect as sampleTruncatedEffect } from "../truncatedNormal.js"
import { TruncatedNormalParams } from "../truncatedNormal.js"
import { prepareSample } from "../truncatedNormal/truncated.js"
import { samplerMathError } from "./errors.js"
import { chooseKernelIndex, kernelAt, prepareChooseKernelIndex } from "./kernels.js"

const paramsForKernel = (parzen: ContinuousParzen, kernel: ContinuousKernel): TruncatedNormalParams =>
  new TruncatedNormalParams({
    mean: kernel.mean,
    sigma: kernel.sigma,
    low: parzen.low,
    high: parzen.high
  })

export const sampleFromParzen = (parzen: ContinuousParzen, kernelRoll: number, valueRoll: number): number => {
  const kernel = kernelAt(parzen, chooseKernelIndex(parzen, kernelRoll))

  return sampleTruncated(valueRoll, paramsForKernel(parzen, kernel))
}

/** Prepares only selected kernels, and discards their constants with the batch. */
export const sampleFromParzenBatch = (
  parzen: ContinuousParzen,
  rolls: ReadonlyArray<readonly [number, number]>
): ReadonlyArray<number> => {
  const choose = prepareChooseKernelIndex(parzen)
  const samplers = MutableHashMap.empty<number, (random: number) => number>()
  return Arr.map(rolls, ([kernelRoll, valueRoll]) => {
    const index = choose(kernelRoll)
    const sample = Option.getOrElse(MutableHashMap.get(samplers, index), () => {
      const prepared = prepareSample(paramsForKernel(parzen, kernelAt(parzen, index)))
      MutableHashMap.set(samplers, index, prepared)
      return prepared
    })
    return sample(valueRoll)
  })
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
