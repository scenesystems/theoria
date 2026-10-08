import { logStrict, logSumExp } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Chunk, Effect, Match, Number as Num } from "effect"

import type { InvalidSamplerConfig } from "../../../SearchError.js"
import type { ContinuousKernel, ContinuousParzen } from "../continuousParzen.js"
import { logPdf as truncatedLogPdf, logPdfEffect as truncatedLogPdfEffect } from "../truncatedNormal.js"
import { TruncatedNormalParams } from "../truncatedNormal.js"
import { logGaussMass, prepareLogPdf } from "../truncatedNormal/truncated.js"
import { samplerMathError } from "./errors.js"

const paramsForKernel = (parzen: ContinuousParzen, kernel: ContinuousKernel): TruncatedNormalParams =>
  new TruncatedNormalParams({
    mean: kernel.mean,
    sigma: kernel.sigma,
    low: parzen.low,
    high: parzen.high
  })

const kernelLogWeight = (kernel: ContinuousKernel): number =>
  Match.value(Num.isGreaterThan(kernel.weight, 0)).pipe(
    Match.when(true, () => logStrict(kernel.weight)),
    Match.orElse(() => Number.NEGATIVE_INFINITY)
  )

export const logDensity = (parzen: ContinuousParzen, value: number): number => {
  const componentScores = Arr.map(
    parzen.kernels,
    (kernel) => Num.sum(truncatedLogPdf(value, paramsForKernel(parzen, kernel)), kernelLogWeight(kernel))
  )

  return logSumExp(Chunk.fromIterable(componentScores))
}

/** Constants belong to this candidate batch's model, never to later trial histories. */
export const prepareKernelLogDensity = (parzen: ContinuousParzen): (value: number) => Array<number> => {
  const components = Arr.map(parzen.kernels, (kernel) => prepareLogPdf(paramsForKernel(parzen, kernel)))
  return (value) => Arr.map(components, (score) => score(value))
}

/** Discrete kernels integrate over each grid cell, rather than evaluating its center density. */
export const prepareKernelLogMass = (parzen: ContinuousParzen, step: number): (value: number) => Array<number> => {
  const components = Arr.map(parzen.kernels, (kernel) => {
    const standardize = (value: number) => Num.divideUnsafe(Num.subtract(value, kernel.mean), kernel.sigma)
    const denominator = logGaussMass(standardize(parzen.low), standardize(parzen.high))
    return (value: number) =>
      Num.subtract(
        logGaussMass(
          standardize(Num.subtract(value, Num.divideUnsafe(step, 2))),
          standardize(Num.sum(value, Num.divideUnsafe(step, 2)))
        ),
        denominator
      )
  })
  return (value) => Arr.map(components, (score) => score(value))
}

/** Constants belong to this candidate batch's model, never to later trial histories. */
export const prepareLogDensity = (parzen: ContinuousParzen): (value: number) => number => {
  const components = Arr.map(parzen.kernels, (kernel) => {
    const logPdf = prepareLogPdf(paramsForKernel(parzen, kernel))
    const logWeight = kernelLogWeight(kernel)
    return (value: number): number => Num.sum(logPdf(value), logWeight)
  })
  return (value) => logSumExp(Chunk.fromIterable(Arr.map(components, (score) => score(value))))
}

export const logDensityEffect = (
  parzen: ContinuousParzen,
  value: number
): Effect.Effect<number, InvalidSamplerConfig> =>
  Effect.forEach(parzen.kernels, (kernel) =>
    truncatedLogPdfEffect(value, paramsForKernel(parzen, kernel)).pipe(
      Effect.map((score) => Num.sum(score, kernelLogWeight(kernel)))
    )).pipe(
      Effect.map((componentScores) => logSumExp(Chunk.fromIterable(componentScores))),
      Effect.mapError((error) => samplerMathError("logDensity", error))
    )
