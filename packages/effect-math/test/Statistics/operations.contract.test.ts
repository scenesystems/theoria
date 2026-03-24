import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Option, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import {
  covariance,
  covarianceValidated,
  covarianceWithPolicies,
  maximum,
  maximumValidated,
  mean,
  meanValidated,
  meanWithPolicies,
  minimum,
  minimumValidated,
  standardDeviation,
  summaryStatisticsValidated,
  summaryStatisticsWithPolicies,
  variance,
  varianceValidated,
  varianceWithPolicies
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

describe("Statistics / minimum", () => {
  it.effect("returns Option.some(min) for non-empty chunk", () =>
    Effect.gen(function*() {
      expect(minimum(Chunk.fromIterable([3, 1, 2]))).toStrictEqual(Option.some(1))
    }))

  it.effect("returns Option.none() for empty chunk", () =>
    Effect.gen(function*() {
      expect(minimum(Chunk.empty())).toStrictEqual(Option.none())
    }))
})

describe("Statistics / maximum", () => {
  it.effect("returns Option.some(max) for non-empty chunk", () =>
    Effect.gen(function*() {
      expect(maximum(Chunk.fromIterable([3, 1, 2]))).toStrictEqual(Option.some(3))
    }))

  it.effect("returns Option.none() for empty chunk", () =>
    Effect.gen(function*() {
      expect(maximum(Chunk.empty())).toStrictEqual(Option.none())
    }))
})

// ---------------------------------------------------------------------------
// Effect-wrapped operations
// ---------------------------------------------------------------------------

describe("Statistics / meanValidated", () => {
  it.effect("decodes valid input and computes mean", () =>
    Effect.gen(function*() {
      const result = yield* meanValidated({ values: [1, 2, 3] })
      expect(result).toStrictEqual(2)
    }))

  it.effect("rejects excess properties with StatisticsDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        meanValidated({ values: [1, 2, 3], extra: true })
      )
      expect(error._tag).toStrictEqual("StatisticsDecodeError")
      expect(error.operation).toStrictEqual("mean")
    }))

  it.effect("rejects empty array with StatisticsDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        meanValidated({ values: [] })
      )
      expect(error._tag).toStrictEqual("StatisticsDecodeError")
    }))

  it.effect("rejects non-finite input with StatisticsDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        meanValidated({ values: [1, Infinity] })
      )
      expect(error._tag).toStrictEqual("StatisticsDecodeError")
    }))
})

describe("Statistics / varianceValidated", () => {
  it.effect("computes variance with valid input", () =>
    Effect.gen(function*() {
      const result = yield* varianceValidated({ values: [1, 3] })
      expect(result).toStrictEqual(2)
    }))

  it.effect("rejects single sample with StatisticsShapeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        varianceValidated({ values: [5] })
      )
      expect(error._tag).toStrictEqual("StatisticsShapeError")
      expect(error.operation).toStrictEqual("variance")
    }))
})

describe("Statistics / summaryStatisticsValidated", () => {
  it.effect("returns TaggedClass with correct fields", () =>
    Effect.gen(function*() {
      const result = yield* summaryStatisticsValidated({ values: [1, 2, 3, 4, 5] })
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
        summaryStatisticsValidated({ values: [5] })
      )
      expect(error._tag).toStrictEqual("StatisticsShapeError")
      expect(error.operation).toStrictEqual("summaryStatistics")
    }))

  it.effect("rejects excess properties with StatisticsDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        summaryStatisticsValidated({ values: [1, 2], extra: true })
      )
      expect(error._tag).toStrictEqual("StatisticsDecodeError")
    }))
})

describe("Statistics / minimumValidated", () => {
  it.effect("decodes valid input and returns Option.some(min)", () =>
    Effect.gen(function*() {
      const result = yield* minimumValidated({ values: [3, 1, 2] })
      expect(result).toStrictEqual(Option.some(1))
    }))

  it.effect("rejects excess properties with StatisticsDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        minimumValidated({ values: [1, 2, 3], extra: true })
      )
      expect(error._tag).toStrictEqual("StatisticsDecodeError")
      expect(error.operation).toStrictEqual("minimum")
    }))
})

describe("Statistics / maximumValidated", () => {
  it.effect("decodes valid input and returns Option.some(max)", () =>
    Effect.gen(function*() {
      const result = yield* maximumValidated({ values: [3, 1, 2] })
      expect(result).toStrictEqual(Option.some(3))
    }))

  it.effect("rejects excess properties with StatisticsDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        maximumValidated({ values: [1, 2, 3], extra: true })
      )
      expect(error._tag).toStrictEqual("StatisticsDecodeError")
      expect(error.operation).toStrictEqual("maximum")
    }))
})

describe("Statistics / covarianceValidated", () => {
  it.effect("computes covariance with valid input", () =>
    Effect.gen(function*() {
      const result = yield* covarianceValidated({ a: [1, 2, 3], b: [2, 4, 6] })
      expect(result).toStrictEqual(2)
    }))

  it.effect("rejects mismatched lengths with StatisticsShapeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        covarianceValidated({ a: [1, 2, 3], b: [4, 5] })
      )
      expect(error._tag).toStrictEqual("StatisticsShapeError")
      expect(error.operation).toStrictEqual("covariance")
    }))

  it.effect("rejects single sample with StatisticsShapeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        covarianceValidated({ a: [1], b: [2] })
      )
      expect(error._tag).toStrictEqual("StatisticsShapeError")
      expect(error.operation).toStrictEqual("covariance")
    }))

  it.effect("rejects excess properties with StatisticsDecodeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        covarianceValidated({ a: [1, 2], b: [3, 4], extra: true })
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

describe("Statistics / meanWithPolicies", () => {
  it.effect("computes mean under strict precision", () =>
    Effect.gen(function*() {
      const result = yield* meanWithPolicies(Chunk.fromIterable([1, 2, 3]))
      expect(result).toStrictEqual(2)
    }).pipe(Effect.provide(strictLayer)))

  it.effect("strict precision rejects non-finite results", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        meanWithPolicies(Chunk.fromIterable([Infinity, 1]))
      )
      expect(error._tag).toStrictEqual("StatisticsDomainViolationError")
      expect(error.operation).toStrictEqual("meanWithPolicies")
    }).pipe(Effect.provide(strictLayer)))

  it.effect("relaxed precision passes through finite results", () =>
    Effect.gen(function*() {
      const result = yield* meanWithPolicies(Chunk.fromIterable([10, 20, 30]))
      expect(result).toStrictEqual(20)
    }).pipe(Effect.provide(relaxedLayer)))
})

describe("Statistics / varianceWithPolicies", () => {
  it.effect("computes variance under strict precision", () =>
    Effect.gen(function*() {
      const result = yield* varianceWithPolicies(Chunk.fromIterable([1, 3]))
      expect(result).toStrictEqual(2)
    }).pipe(Effect.provide(strictLayer)))

  it.effect("strict precision rejects non-finite results", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        varianceWithPolicies(Chunk.fromIterable([Infinity, 1]))
      )
      expect(error._tag).toStrictEqual("StatisticsDomainViolationError")
      expect(error.operation).toStrictEqual("varianceWithPolicies")
    }).pipe(Effect.provide(strictLayer)))

  it.effect("rejects insufficient samples with StatisticsShapeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        varianceWithPolicies(Chunk.fromIterable([5]))
      )
      expect(error._tag).toStrictEqual("StatisticsShapeError")
      expect(error.operation).toStrictEqual("varianceWithPolicies")
    }).pipe(Effect.provide(strictLayer)))

  it.effect("relaxed precision passes through finite results", () =>
    Effect.gen(function*() {
      const result = yield* varianceWithPolicies(Chunk.fromIterable([2, 4, 6]))
      expect(result).toStrictEqual(4)
    }).pipe(Effect.provide(relaxedLayer)))
})

describe("Statistics / covarianceWithPolicies", () => {
  it.effect("computes covariance under strict precision", () =>
    Effect.gen(function*() {
      const result = yield* covarianceWithPolicies(
        Chunk.fromIterable([1, 2, 3]),
        Chunk.fromIterable([2, 4, 6])
      )
      expect(result).toStrictEqual(2)
    }).pipe(Effect.provide(strictLayer)))

  it.effect("strict precision rejects non-finite results", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        covarianceWithPolicies(
          Chunk.fromIterable([Infinity, 1]),
          Chunk.fromIterable([1, 2])
        )
      )
      expect(error._tag).toStrictEqual("StatisticsDomainViolationError")
      expect(error.operation).toStrictEqual("covarianceWithPolicies")
    }).pipe(Effect.provide(strictLayer)))

  it.effect("rejects mismatched lengths with StatisticsShapeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        covarianceWithPolicies(
          Chunk.fromIterable([1, 2, 3]),
          Chunk.fromIterable([4, 5])
        )
      )
      expect(error._tag).toStrictEqual("StatisticsShapeError")
      expect(error.operation).toStrictEqual("covarianceWithPolicies")
    }).pipe(Effect.provide(strictLayer)))

  it.effect("rejects insufficient samples with StatisticsShapeError", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        covarianceWithPolicies(
          Chunk.fromIterable([1]),
          Chunk.fromIterable([2])
        )
      )
      expect(error._tag).toStrictEqual("StatisticsShapeError")
      expect(error.operation).toStrictEqual("covarianceWithPolicies")
    }).pipe(Effect.provide(strictLayer)))

  it.effect("relaxed precision passes through finite results", () =>
    Effect.gen(function*() {
      const result = yield* covarianceWithPolicies(
        Chunk.fromIterable([1, 2, 3]),
        Chunk.fromIterable([2, 4, 6])
      )
      expect(result).toStrictEqual(2)
    }).pipe(Effect.provide(relaxedLayer)))
})
