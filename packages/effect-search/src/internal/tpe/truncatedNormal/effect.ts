import { Effect } from "effect"

import type { InvalidMathInput } from "../../../Errors/index.js"
import type { TruncatedNormalParams } from "./model.js"
import { cdf, logPdf, sample } from "./truncated.js"
import { ensureCommonParams, failWhen } from "./validation.js"

export const logPdfEffect = (x: number, params: TruncatedNormalParams): Effect.Effect<number, InvalidMathInput> =>
  Effect.gen(function*() {
    yield* ensureCommonParams("logPdf", params)
    yield* failWhen(Number.isNaN(x), "logPdf", "x must not be NaN")

    const value = logPdf(x, params)

    yield* failWhen(Number.isNaN(value), "logPdf", "result must not be NaN")
    return value
  })

export const cdfEffect = (x: number, params: TruncatedNormalParams): Effect.Effect<number, InvalidMathInput> =>
  Effect.gen(function*() {
    yield* ensureCommonParams("cdf", params)
    yield* failWhen(Number.isNaN(x), "cdf", "x must not be NaN")

    const value = cdf(x, params)

    yield* failWhen(Number.isNaN(value), "cdf", "result must not be NaN")
    return value
  })

export const sampleEffect = (random: number, params: TruncatedNormalParams): Effect.Effect<number, InvalidMathInput> =>
  Effect.gen(function*() {
    yield* ensureCommonParams("sample", params)
    yield* failWhen(!Number.isFinite(random), "sample", "quantile must be finite")
    yield* failWhen(random < 0 || random > 1, "sample", "quantile must be in [0, 1]")

    const value = sample(random, params)

    yield* failWhen(Number.isNaN(value), "sample", "result must not be NaN")
    return value
  })
