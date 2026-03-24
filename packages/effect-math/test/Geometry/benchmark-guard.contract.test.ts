import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Number, Schema } from "effect"
import * as Arr from "effect/Array"

import { euclideanDistance } from "../../src/Geometry/operations.js"

const BenchmarkBudgetSchema = Schema.Struct({
  maxDurationMs: Schema.Number.pipe(Schema.greaterThan(0))
})

const BenchmarkPlanSchema = Schema.Struct({
  runs: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  maxMeanDurationMs: Schema.Number.pipe(Schema.greaterThan(0))
})

const a = Chunk.fromIterable([1.5, 2.3, 3.7])
const b = Chunk.fromIterable([6.2, 7.8, 8.4])

describe("Geometry benchmark guard", () => {
  it.effect("keeps euclidean distance baseline within benchmark budget", () =>
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
        () => Effect.sync(() => euclideanDistance(a, b)),
        { discard: true }
      )

      const elapsed = performance.now() - startedAt
      const meanDurationMs = elapsed / plan.runs

      expect(Number.Equivalence(meanDurationMs <= plan.maxMeanDurationMs ? 1 : 0, 1)).toStrictEqual(true)
      expect(Number.Equivalence(elapsed <= budget.maxDurationMs ? 1 : 0, 1)).toStrictEqual(true)
    }))
})
