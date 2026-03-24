import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Number, Schema } from "effect"
import * as Arr from "effect/Array"

import { polyEval } from "../../src/Algebra/operations.js"

const BenchmarkBudgetSchema = Schema.Struct({
  maxDurationMs: Schema.Number.pipe(Schema.greaterThan(0))
})

const BenchmarkPlanSchema = Schema.Struct({
  runs: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  maxMeanDurationMs: Schema.Number.pipe(Schema.greaterThan(0))
})

const coefficients = Chunk.fromIterable([1, -2, 1])

describe("Algebra benchmark guard", () => {
  it.effect("keeps polyEval baseline within benchmark budget", () =>
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
        () => Effect.sync(() => polyEval(coefficients, 3)),
        { discard: true }
      )

      const elapsed = performance.now() - startedAt
      const meanDurationMs = elapsed / plan.runs

      expect(Number.Equivalence(meanDurationMs <= plan.maxMeanDurationMs ? 1 : 0, 1)).toStrictEqual(true)
      expect(Number.Equivalence(elapsed <= budget.maxDurationMs ? 1 : 0, 1)).toStrictEqual(true)
    }))
})
