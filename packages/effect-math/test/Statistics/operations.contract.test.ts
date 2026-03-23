import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import {
  covariance,
  covarianceEffect,
  mean,
  meanEffect,
  standardDeviation,
  summaryStatisticsEffect,
  summaryStatisticsWithPolicies,
  variance,
  varianceEffect
} from "../../src/Statistics/operations.js"

const strictLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "strict",
  backend: "scalar",
  diagnostics: "enabled"
})

const relaxedLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "relaxed",
  backend: "scalar",
  diagnostics: "disabled"
})

// ---------------------------------------------------------------------------
// Pure kernel operations
// ---------------------------------------------------------------------------

describe("Statistics / mean", () => {
  it.effect("computes mean of [1, 2, 3]", () =>
    Effect.gen(function*() {
      expect(mean(Chunk.fromIterable([1, 2, 3]))).toStrictEqual(2)
    }))

  it.effect("computes mean of single element", () =>
    Effect.gen(function*() {
      expect(mean(Chunk.fromIterable([5]))).toStrictEqual(5)
    }))
})

describe("Statistics / variance", () => {
  it.effect("computes Bessel-corrected variance of [1, 3]", () =>
    Effect.gen(function*() {
      expect(variance(Chunk.fromIterable([1, 3]))).toStrictEqual(2)
    }))

  it.effect("computes Bessel-corrected variance of [2, 4, 4, 4, 5, 5, 7, 9]", () =>
    Effect.gen(function*() {
      const result = variance(Chunk.fromIterable([2, 4, 4, 4, 5, 5, 7, 9]))
      expect(result).toBeCloseTo(32 / 7)
    }))
})

describe("Statistics / standardDeviation", () => {
  it.effect("computes standard deviation of [1, 3]", () =>
    Effect.gen(function*() {
      expect(standardDeviation(Chunk.fromIterable([1, 3]))).toBeCloseTo(Math.sqrt(2))
    }))
})

describe("Statistics / covariance", () => {
  it.effect("computes covariance of perfectly correlated pairs", () =>
    Effect.gen(function*() {
      const a = Chunk.fromIterable([1, 2, 3])
      const b = Chunk.fromIterable([2, 4, 6])
      expect(covariance(a, b)).toStrictEqual(2)
    }))

  it.effect("computes covariance of identical samples equals variance", () =>
    Effect.gen(function*() {
      const values = Chunk.fromIterable([1, 3])
      expect(covariance(values, values)).toStrictEqual(variance(values))
    }))
})

// ---------------------------------------------------------------------------
// Effect-wrapped operations
// ---------------------------------------------------------------------------

describe("Statistics / meanEffect", () => {
  it.effect("decodes valid input and computes mean", () =>
    Effect.gen(function*() {
      const result = yield* meanEffect({ values: [1, 2, 3] })
      expect(result).toStrictEqual(2)
    }))

  it.effect("rejects excess properties with StatisticsDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        meanEffect({ values: [1, 2, 3], extra: true })
      )
      expect(error._tag).toStrictEqual("StatisticsDecodeError")
      expect(error.operation).toStrictEqual("mean")
    }))

  it.effect("rejects empty array with StatisticsDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        meanEffect({ values: [] })
      )
      expect(error._tag).toStrictEqual("StatisticsDecodeError")
    }))

  it.effect("rejects non-finite input with StatisticsDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        meanEffect({ values: [1, Infinity] })
      )
      expect(error._tag).toStrictEqual("StatisticsDecodeError")
    }))
})

describe("Statistics / varianceEffect", () => {
  it.effect("computes variance with valid input", () =>
    Effect.gen(function*() {
      const result = yield* varianceEffect({ values: [1, 3] })
      expect(result).toStrictEqual(2)
    }))

  it.effect("rejects single sample with StatisticsShapeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        varianceEffect({ values: [5] })
      )
      expect(error._tag).toStrictEqual("StatisticsShapeError")
      expect(error.operation).toStrictEqual("variance")
    }))
})

describe("Statistics / summaryStatisticsEffect", () => {
  it.effect("returns TaggedClass with correct fields", () =>
    Effect.gen(function*() {
      const result = yield* summaryStatisticsEffect({ values: [1, 2, 3, 4, 5] })
      expect(result._tag).toStrictEqual("SummaryStatistics")
      expect(result.mean).toStrictEqual(3)
      expect(result.count).toStrictEqual(5)
      expect(result.min).toStrictEqual(1)
      expect(result.max).toStrictEqual(5)
      expect(result.variance).toStrictEqual(2.5)
      expect(result.standardDeviation).toBeCloseTo(Math.sqrt(2.5))
    }))

  it.effect("rejects single sample with StatisticsShapeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        summaryStatisticsEffect({ values: [5] })
      )
      expect(error._tag).toStrictEqual("StatisticsShapeError")
      expect(error.operation).toStrictEqual("summaryStatistics")
    }))

  it.effect("rejects excess properties with StatisticsDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        summaryStatisticsEffect({ values: [1, 2], extra: true })
      )
      expect(error._tag).toStrictEqual("StatisticsDecodeError")
    }))
})

describe("Statistics / covarianceEffect", () => {
  it.effect("computes covariance with valid input", () =>
    Effect.gen(function*() {
      const result = yield* covarianceEffect({ a: [1, 2, 3], b: [2, 4, 6] })
      expect(result).toStrictEqual(2)
    }))

  it.effect("rejects mismatched lengths with StatisticsShapeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        covarianceEffect({ a: [1, 2, 3], b: [4, 5] })
      )
      expect(error._tag).toStrictEqual("StatisticsShapeError")
      expect(error.operation).toStrictEqual("covariance")
    }))

  it.effect("rejects single sample with StatisticsShapeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        covarianceEffect({ a: [1], b: [2] })
      )
      expect(error._tag).toStrictEqual("StatisticsShapeError")
      expect(error.operation).toStrictEqual("covariance")
    }))

  it.effect("rejects excess properties with StatisticsDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        covarianceEffect({ a: [1, 2], b: [3, 4], extra: true })
      )
      expect(error._tag).toStrictEqual("StatisticsDecodeError")
    }))
})

// ---------------------------------------------------------------------------
// Policy-aware operations
// ---------------------------------------------------------------------------

describe("Statistics / summaryStatisticsWithPolicies", () => {
  it.effect("computes summary under strict precision", () =>
    Effect.gen(function*() {
      const result = yield* summaryStatisticsWithPolicies(Chunk.fromIterable([1, 2, 3, 4, 5]))
      expect(result._tag).toStrictEqual("SummaryStatistics")
      expect(result.mean).toStrictEqual(3)
      expect(result.count).toStrictEqual(5)
    }).pipe(Effect.provide(strictLayer)))

  it.effect("strict precision rejects non-finite results", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        summaryStatisticsWithPolicies(Chunk.fromIterable([Infinity, 1]))
      )
      expect(error._tag).toStrictEqual("StatisticsDomainViolationError")
      expect(error.operation).toStrictEqual("summaryStatisticsWithPolicies")
    }).pipe(Effect.provide(strictLayer)))

  it.effect("relaxed precision computes valid finite samples", () =>
    Effect.gen(function*() {
      const result = yield* summaryStatisticsWithPolicies(Chunk.fromIterable([10, 20, 30]))
      expect(result._tag).toStrictEqual("SummaryStatistics")
      expect(result.mean).toStrictEqual(20)
    }).pipe(Effect.provide(relaxedLayer)))

  it.effect("rejects insufficient samples with StatisticsShapeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        summaryStatisticsWithPolicies(Chunk.fromIterable([5]))
      )
      expect(error._tag).toStrictEqual("StatisticsShapeError")
    }).pipe(Effect.provide(strictLayer)))
})
