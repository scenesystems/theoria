import { Array as Arr, Effect, Match, Number as Num, Option } from "effect"

import type { InvalidSamplerConfig } from "../../../Errors/index.js"
import * as Float64 from "../../float64.js"
import {
  logPdf as truncatedLogPdf,
  logPdfEffect as truncatedLogPdfEffect,
  TruncatedNormalParams
} from "../truncatedNormal.js"
import { samplerMathError } from "./errors.js"
import type { ContinuousKernel, ContinuousParzen } from "./model.js"

const logSumExp = (values: ReadonlyArray<number>): number => {
  const baseline = Arr.head(values).pipe(
    Option.getOrElse(() => Number.NEGATIVE_INFINITY)
  )
  const maxValue = Arr.reduce(values, baseline, (currentMax, value) => Num.max(currentMax, value))

  return Match.value(Number.isFinite(maxValue)).pipe(
    Match.when(false, () => Number.NEGATIVE_INFINITY),
    Match.orElse(() => {
      const sumExp = Arr.reduce(values, 0, (sum, value) => Num.sum(sum, Float64.exp(value - maxValue)))

      return Match.value(Number.isFinite(sumExp) && Num.greaterThan(sumExp, 0)).pipe(
        Match.when(true, () => maxValue + Float64.log(sumExp)),
        Match.orElse(() => Number.NEGATIVE_INFINITY)
      )
    })
  )
}

const kernelLogWeight = (kernel: ContinuousKernel): number =>
  Match.value(Num.greaterThan(kernel.weight, 0)).pipe(
    Match.when(true, () => Float64.log(kernel.weight)),
    Match.orElse(() => Number.NEGATIVE_INFINITY)
  )

export const logDensity = (parzen: ContinuousParzen, value: number): number => {
  const componentScores = Arr.map(parzen.kernels, (kernel) =>
    truncatedLogPdf(
      value,
      new TruncatedNormalParams({
        mean: kernel.mean,
        sigma: kernel.sigma,
        low: parzen.low,
        high: parzen.high
      })
    ) + kernelLogWeight(kernel))

  return logSumExp(componentScores)
}

export const logDensityEffect = (
  parzen: ContinuousParzen,
  value: number
): Effect.Effect<number, InvalidSamplerConfig> =>
  Effect.forEach(parzen.kernels, (kernel) =>
    truncatedLogPdfEffect(
      value,
      new TruncatedNormalParams({
        mean: kernel.mean,
        sigma: kernel.sigma,
        low: parzen.low,
        high: parzen.high
      })
    ).pipe(
      Effect.map((score) => score + kernelLogWeight(kernel))
    )).pipe(
      Effect.map((componentScores) => logSumExp(componentScores)),
      Effect.mapError((error) => samplerMathError("logDensity", error))
    )
