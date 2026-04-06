/**
 * Statistics inference and power analysis.
 *
 * What this shows: `confidenceIntervalMean`, `oneSampleTTest`,
 * `twoSampleTTest`, `powerForMeanDifference`, `sampleSizeForTargetPower`,
 * their schema-validated boundary variants, and policy-aware power analysis.
 *
 * Run: bun run packages/effect-math/examples/12-statistics-inference.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Chunk, Console, Effect } from "effect"

import { makeDeterministicRuntimePoliciesLayer, Seed } from "effect-math/contracts"
import {
  confidenceIntervalMean,
  confidenceIntervalMeanValidated,
  oneSampleTTest,
  oneSampleTTestValidated,
  powerForMeanDifference,
  powerForMeanDifferenceWithPolicies,
  sampleSizeForTargetPower,
  sampleSizeForTargetPowerValidated,
  twoSampleTTest
} from "effect-math/Statistics"

const oneSample = Chunk.fromIterable([2.4, 2.7, 2.9, 3.1, 3.2, 3.4])
const groupA = Chunk.fromIterable([5.1, 5.4, 5.6, 5.8, 6.0])
const groupB = Chunk.fromIterable([4.2, 4.3, 4.5, 4.6, 4.7])

const program = Effect.gen(function*() {
  const confidenceInterval = confidenceIntervalMean(oneSample, {
    confidenceLevel: 0.95,
    alternative: "twoSided"
  })
  const oneSampleReport = oneSampleTTest(oneSample, {
    nullValue: 2,
    alpha: 0.05,
    alternative: "twoSided"
  })
  const twoSampleReport = twoSampleTTest(groupA, groupB, {
    alpha: 0.05,
    alternative: "twoSided"
  })
  const powerReport = powerForMeanDifference(0.6, 24, {
    alpha: 0.05,
    alternative: "twoSided"
  })
  const sampleSizeReport = sampleSizeForTargetPower(0.6, 0.8, {
    alpha: 0.05,
    alternative: "twoSided",
    maxSampleSize: 256
  })

  yield* Console.log("confidenceIntervalMean:", confidenceInterval)
  yield* Console.log("oneSampleTTest:", oneSampleReport)
  yield* Console.log("twoSampleTTest:", twoSampleReport)
  yield* Console.log("powerForMeanDifference:", powerReport)
  yield* Console.log("sampleSizeForTargetPower:", sampleSizeReport)

  const validatedConfidenceInterval = yield* confidenceIntervalMeanValidated({
    values: Chunk.toReadonlyArray(oneSample),
    confidenceLevel: 0.9,
    alternative: "greater"
  })
  const validatedOneSample = yield* oneSampleTTestValidated({
    values: Chunk.toReadonlyArray(oneSample),
    nullValue: 2,
    alpha: 0.1,
    alternative: "greater"
  })
  const validatedSampleSize = yield* sampleSizeForTargetPowerValidated({
    effectSize: 0.6,
    targetPower: 0.85,
    alpha: 0.05,
    alternative: "greater",
    maxSampleSize: 256
  })

  yield* Console.log("confidenceIntervalMeanValidated:", validatedConfidenceInterval)
  yield* Console.log("oneSampleTTestValidated:", validatedOneSample)
  yield* Console.log("sampleSizeForTargetPowerValidated:", validatedSampleSize)

  const policies = makeDeterministicRuntimePoliciesLayer({
    seed: Seed.make(42),
    precision: "strict",
    backend: "scalar",
    diagnostics: "disabled"
  })

  const policyPower = yield* powerForMeanDifferenceWithPolicies(0.6, 24, {
    alpha: 0.05,
    alternative: "twoSided"
  }).pipe(Effect.provide(policies))

  yield* Console.log("powerForMeanDifferenceWithPolicies:", policyPower)
})

BunRuntime.runMain(program)
