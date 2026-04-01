import { Array as Arr, Effect, Match, Number as Num } from "effect"

import type { InvalidSamplerConfig } from "../../../Errors/index.js"
import * as Float64 from "../../float64.js"
import { logPdf as truncatedLogPdf, logPdfEffect as truncatedLogPdfEffect } from "../truncatedNormal.js"
import type { TruncatedNormalParams } from "../truncatedNormal.js"
import { samplerMathError } from "./errors.js"
import type { ContinuousKernel, ContinuousParzen } from "./model.js"

const logSumExp = (values: ReadonlyArray<number>): number => {
  const maxValue = Arr.reduce(
    values,
    Number.NEGATIVE_INFINITY,
    (currentMax, value) => value > currentMax ? value : currentMax
  )

  return Match.value(Number.isFinite(maxValue)).pipe(
    Match.when(false, () => maxValue),
    Match.orElse(() =>
      maxValue +
      Float64.log(
        Arr.reduce(values, 0, (sum, value) => sum + Float64.exp(value - maxValue))
      )
    )
  )
}

const paramsForKernel = (parzen: ContinuousParzen, kernel: ContinuousKernel): TruncatedNormalParams => ({
  mean: kernel.mean,
  sigma: kernel.sigma,
  low: parzen.low,
  high: parzen.high
})

const kernelLogWeight = (kernel: ContinuousKernel): number =>
  Match.value(Num.greaterThan(kernel.weight, 0)).pipe(
    Match.when(true, () => Float64.log(kernel.weight)),
    Match.orElse(() => Number.NEGATIVE_INFINITY)
  )

export const logDensity = (parzen: ContinuousParzen, value: number): number => {
  const componentScores = Arr.map(
    parzen.kernels,
    (kernel) => truncatedLogPdf(value, paramsForKernel(parzen, kernel)) + kernelLogWeight(kernel)
  )

  return logSumExp(componentScores)
}

export const logDensityEffect = (
  parzen: ContinuousParzen,
  value: number
): Effect.Effect<number, InvalidSamplerConfig> =>
  Effect.forEach(parzen.kernels, (kernel) =>
    truncatedLogPdfEffect(value, paramsForKernel(parzen, kernel)).pipe(
      Effect.map((score) => score + kernelLogWeight(kernel))
    )).pipe(
      Effect.map((componentScores) => logSumExp(componentScores)),
      Effect.mapError((error) => samplerMathError("logDensity", error))
    )
