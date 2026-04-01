import { Array as Arr, Chunk, Effect, Match, Number as Num } from "effect"
import { logStrict, logSumExp } from "effect-math/Numeric"

import type { InvalidSamplerConfig } from "../../../Errors/index.js"
import { logPdf as truncatedLogPdf, logPdfEffect as truncatedLogPdfEffect } from "../truncatedNormal.js"
import type { TruncatedNormalParams } from "../truncatedNormal.js"
import { samplerMathError } from "./errors.js"
import type { ContinuousKernel, ContinuousParzen } from "./model.js"

const paramsForKernel = (parzen: ContinuousParzen, kernel: ContinuousKernel): TruncatedNormalParams => ({
  mean: kernel.mean,
  sigma: kernel.sigma,
  low: parzen.low,
  high: parzen.high
})

const kernelLogWeight = (kernel: ContinuousKernel): number =>
  Match.value(Num.greaterThan(kernel.weight, 0)).pipe(
    Match.when(true, () => logStrict(kernel.weight)),
    Match.orElse(() => Number.NEGATIVE_INFINITY)
  )

export const logDensity = (parzen: ContinuousParzen, value: number): number => {
  const componentScores = Arr.map(
    parzen.kernels,
    (kernel) => truncatedLogPdf(value, paramsForKernel(parzen, kernel)) + kernelLogWeight(kernel)
  )

  return logSumExp(Chunk.fromIterable(componentScores))
}

export const logDensityEffect = (
  parzen: ContinuousParzen,
  value: number
): Effect.Effect<number, InvalidSamplerConfig> =>
  Effect.forEach(parzen.kernels, (kernel) =>
    truncatedLogPdfEffect(value, paramsForKernel(parzen, kernel)).pipe(
      Effect.map((score) => score + kernelLogWeight(kernel))
    )).pipe(
      Effect.map((componentScores) => logSumExp(Chunk.fromIterable(componentScores))),
      Effect.mapError((error) => samplerMathError("logDensity", error))
    )
