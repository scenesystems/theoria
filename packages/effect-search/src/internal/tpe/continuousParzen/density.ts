import { Array as Arr, Chunk, Effect, Match, Number as Num } from "effect"
import { logsumexp } from "effect-math/Numeric"

import type { InvalidSamplerConfig } from "../../../Errors/index.js"
import * as Float64 from "../../float64.js"
import {
  logPdf as truncatedLogPdf,
  logPdfEffect as truncatedLogPdfEffect,
  TruncatedNormalParams
} from "../truncatedNormal.js"
import { samplerMathError } from "./errors.js"
import type { ContinuousKernel, ContinuousParzen } from "./model.js"

const logSumExp = (values: ReadonlyArray<number>): number => logsumexp(Chunk.fromIterable(values))

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
