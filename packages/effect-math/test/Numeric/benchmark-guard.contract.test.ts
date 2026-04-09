import { describe, expect, it } from "@effect/vitest"
import { Effect, Number, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import { validateNumericBoundary } from "../../src/Numeric/operations.js"
import { BenchmarkBudgetSchema, BenchmarkPlanSchema, runBenchmarkPlan } from "../helpers/benchmark.js"

const deterministicLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(144),
  precision: "strict",
  backend: "typed-array",
  diagnostics: "enabled"
})

describe("Numeric benchmark guard", () => {
  it.effect("keeps numeric boundary baseline within benchmark budget", () =>
    Effect.gen(function*() {
      const budget = yield* Schema.decodeUnknown(BenchmarkBudgetSchema)({
        maxDurationMs: 200
      })
      const plan = yield* Schema.decodeUnknown(BenchmarkPlanSchema)({
        runs: 200,
        maxMeanDurationMs: 1.4
      })

      const benchmark = yield* runBenchmarkPlan(plan, () =>
        validateNumericBoundary({
          values: [0.1, 0.2, 0.3, 0.4, 0.5],
          tolerance: 1e-9,
          budget: 256
        }))

      expect(Number.Equivalence(benchmark.meanDurationMs <= plan.maxMeanDurationMs ? 1 : 0, 1)).toStrictEqual(true)
      expect(Number.Equivalence(benchmark.elapsed <= budget.maxDurationMs ? 1 : 0, 1)).toStrictEqual(true)
    }).pipe(Effect.provide(deterministicLayer)))
})
