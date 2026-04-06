import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import {
  confidenceIntervalMean,
  confidenceIntervalMeanWithPolicies,
  oneSampleTTest,
  oneSampleTTestValidated,
  twoSampleTTest,
  twoSampleTTestValidated
} from "../../src/Statistics/operations.js"

const strictLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "strict",
  backend: "scalar",
  diagnostics: "disabled"
})

const oneSampleData = Chunk.fromIterable([2.4, 2.7, 2.9, 3.1, 3.2, 3.4])
const twoSampleA = Chunk.fromIterable([5.1, 5.4, 5.6, 5.8, 6.0])
const twoSampleB = Chunk.fromIterable([4.2, 4.3, 4.5, 4.6, 4.7])

describe("Statistics inference contracts", () => {
  it.effect("one-sample t-test report keeps p-value and interval aligned on the null boundary", () =>
    Effect.gen(function*() {
      const report = oneSampleTTest(oneSampleData, {
        nullValue: 2,
        alpha: 0.05,
        alternative: "twoSided"
      })

      expect(report.method).toBe("oneSampleTTest")
      expect(report.pValue).toBeLessThan(0.05)
      expect(report.interval.lower).not.toBeNull()
      expect(report.interval.upper).not.toBeNull()
      expect(report.interval.lower!).toBeGreaterThan(0)
      expect(report.effectSize).toBeGreaterThan(0)
    }))

  it.effect("two-sample Welch report stays typed and schema-decoded boundaries reject excess properties", () =>
    Effect.gen(function*() {
      const report = yield* twoSampleTTestValidated({
        a: Chunk.toReadonlyArray(twoSampleA),
        b: Chunk.toReadonlyArray(twoSampleB),
        alpha: 0.05,
        alternative: "twoSided"
      })

      expect(report.method).toBe("twoSampleTTest")
      expect(report.pValue).toBeLessThan(0.05)
      expect(report.interval.lower).not.toBeNull()
      expect(report.interval.upper).not.toBeNull()
      expect(report.interval.lower!).toBeGreaterThan(0)

      const error = yield* Effect.flip(
        twoSampleTTestValidated({
          a: Chunk.toReadonlyArray(twoSampleA),
          b: Chunk.toReadonlyArray(twoSampleB),
          extra: true
        })
      )

      expect(error._tag).toBe("StatisticsDecodeError")
      expect(error.operation).toBe("twoSampleTTest")
    }))

  it.effect("confidence intervals and one-sample t-tests stay available through pure, validated, and policy-aware surfaces", () =>
    Effect.gen(function*() {
      const pureInterval = confidenceIntervalMean(oneSampleData, {
        confidenceLevel: 0.9,
        alternative: "greater"
      })
      const validatedTest = yield* oneSampleTTestValidated({
        values: Chunk.toReadonlyArray(oneSampleData),
        nullValue: 2,
        alpha: 0.1,
        alternative: "greater"
      })
      const policyInterval = yield* confidenceIntervalMeanWithPolicies(oneSampleData, {
        confidenceLevel: 0.9,
        alternative: "greater"
      }).pipe(Effect.provide(strictLayer))

      expect(pureInterval.interval.lower).not.toBeNull()
      expect(pureInterval.interval.upper).toBeNull()
      expect(validatedTest.pValue).toBeLessThan(0.1)
      expect(policyInterval.interval.lower).toBeCloseTo(pureInterval.interval.lower!, 10)
    }))

  it.effect("two-sample pure surface remains aligned with the validated path", () =>
    Effect.gen(function*() {
      const pureReport = twoSampleTTest(twoSampleA, twoSampleB, {
        alpha: 0.05,
        alternative: "twoSided"
      })
      const validatedReport = yield* twoSampleTTestValidated({
        a: Chunk.toReadonlyArray(twoSampleA),
        b: Chunk.toReadonlyArray(twoSampleB),
        alpha: 0.05,
        alternative: "twoSided"
      })

      expect(validatedReport.statistic).toBeCloseTo(pureReport.statistic, 10)
      expect(validatedReport.pValue).toBeCloseTo(pureReport.pValue, 10)
      expect(validatedReport.effectSize).toBeCloseTo(pureReport.effectSize, 10)
    }))
})
