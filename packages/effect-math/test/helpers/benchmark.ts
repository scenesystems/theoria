import { Effect, Schema } from "effect"
import * as Arr from "effect/Array"

export const BenchmarkBudgetSchema = Schema.Struct({
  maxDurationMs: Schema.Number.pipe(Schema.greaterThan(0))
})

export const BenchmarkPlanSchema = Schema.Struct({
  runs: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  maxMeanDurationMs: Schema.Number.pipe(Schema.greaterThan(0))
})

const defaultWarmupRuns = 5

export const runBenchmarkPlan = <A, E, R>(
  plan: typeof BenchmarkPlanSchema.Type,
  task: () => Effect.Effect<A, E, R>,
  options?: {
    readonly warmupRuns?: number
  }
) =>
  Effect.gen(function*() {
    const warmupRuns = options?.warmupRuns ?? defaultWarmupRuns

    yield* Effect.forEach(
      Arr.range(1, warmupRuns),
      () => task(),
      { discard: true }
    )

    const startedAt = performance.now()

    yield* Effect.forEach(
      Arr.range(1, plan.runs),
      () => task(),
      { discard: true }
    )

    const elapsed = performance.now() - startedAt

    return {
      elapsed,
      meanDurationMs: elapsed / plan.runs
    }
  })
