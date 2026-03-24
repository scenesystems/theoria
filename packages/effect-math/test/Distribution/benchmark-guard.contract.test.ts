import { describe, expect, it } from "@effect/vitest"
import { Effect, Number, Schema } from "effect"
import * as Arr from "effect/Array"

import { normalPdf } from "../../src/Distribution/operations.js"

const BenchmarkBudgetSchema = Schema.Struct({
  maxDurationMs: Schema.Number.pipe(Schema.greaterThan(0))
})

const BenchmarkPlanSchema = Schema.Struct({
  runs: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  maxMeanDurationMs: Schema.Number.pipe(Schema.greaterThan(0))
})

describe("Distribution benchmark guard", () => {
  it.effect("keeps normal PDF baseline within benchmark budget", () =>
    Effect.gen(function*() {
      const budget = yield* Schema.decodeUnknown(BenchmarkBudgetSchema)({
        maxDurationMs: 300
      })
      const plan = yield* Schema.decodeUnknown(BenchmarkPlanSchema)({
        runs: 100,
        maxMeanDurationMs: 2
      })

      const startedAt = performance.now()

      yield* Effect.forEach(
        Arr.range(1, plan.runs),
        () => Effect.sync(() => normalPdf(0.5, 0, 1)),
        { discard: true }
      )

      const elapsed = performance.now() - startedAt
      const meanDurationMs = elapsed / plan.runs

      expect(Number.Equivalence(meanDurationMs <= plan.maxMeanDurationMs ? 1 : 0, 1)).toStrictEqual(true)
      expect(Number.Equivalence(elapsed <= budget.maxDurationMs ? 1 : 0, 1)).toStrictEqual(true)
    }))
})
