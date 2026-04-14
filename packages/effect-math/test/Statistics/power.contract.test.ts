import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import {
  powerForMeanDifference,
  powerForMeanDifferenceValidated,
  powerForMeanDifferenceWithPolicies,
  sampleSizeForTargetPower,
  sampleSizeForTargetPowerValidated,
  sampleSizeForTargetPowerWithPolicies
} from "../../src/Statistics/operations.js"

const strictLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(42),
  precision: "strict",
  backend: "scalar",
  diagnostics: "disabled"
})

describe("Statistics power-analysis contracts", () => {
  it.effect("power is monotonic in effect size, alpha, and sample size for equal-group designs", () =>
    Effect.gen(function*() {
      const base = powerForMeanDifference(0.5, 16, { alpha: 0.05 })
      const largerEffect = powerForMeanDifference(0.8, 16, { alpha: 0.05 })
      const largerSample = powerForMeanDifference(0.5, 32, { alpha: 0.05 })
      const largerAlpha = powerForMeanDifference(0.5, 16, { alpha: 0.1 })

      expect(largerEffect.power).toBeGreaterThan(base.power)
      expect(largerSample.power).toBeGreaterThan(base.power)
      expect(largerAlpha.power).toBeGreaterThan(base.power)
    }))

  it.effect("sample-size inversion uses Brent and lands on a sample size whose predecessor stays below target power", () =>
    Effect.gen(function*() {
      const report = sampleSizeForTargetPower(0.6, 0.8, {
        alpha: 0.05,
        alternative: "twoSided",
        maxSampleSize: 256
      })

      expect(report.solver.method).toBe("brent")
      expect(report.achievedPower).toBeGreaterThanOrEqual(0.8)
      expect(report.sampleSize).toBeGreaterThan(2)

      const previous = powerForMeanDifference(0.6, report.sampleSize - 1, {
        alpha: 0.05,
        alternative: "twoSided"
      })

      expect(previous.power).toBeLessThan(0.8)
    }))

  it.effect("validated and policy-aware power surfaces stay package-owned and reject zero-effect inversion targets", () =>
    Effect.gen(function*() {
      const validatedReport = yield* powerForMeanDifferenceValidated({
        effectSize: 0.5,
        sampleSize: 24,
        alpha: 0.05,
        alternative: "greater"
      })
      const policyReport = yield* powerForMeanDifferenceWithPolicies(0.5, 24, {
        alpha: 0.05,
        alternative: "greater"
      }).pipe(Effect.provide(strictLayer))
      const sampleSizeReport = yield* sampleSizeForTargetPowerWithPolicies(0.5, 0.85, {
        alpha: 0.05,
        alternative: "greater",
        maxSampleSize: 256
      }).pipe(Effect.provide(strictLayer))

      expect(policyReport.power).toBeCloseTo(validatedReport.power, 10)
      expect(sampleSizeReport.achievedPower).toBeGreaterThanOrEqual(0.85)

      const error = yield* Effect.flip(
        sampleSizeForTargetPowerValidated({
          effectSize: 0,
          targetPower: 0.8,
          alpha: 0.05
        })
      )

      expect(error._tag).toBe("StatisticsParameterError")
      expect(error.operation).toBe("sampleSizeForTargetPower")
    }))
})
