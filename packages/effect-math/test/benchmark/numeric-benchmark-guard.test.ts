import { describe, expect, it } from "@effect/vitest"
import { Clock, Effect, Schema } from "effect"

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import { validateNumericBoundary } from "../../src/Numeric/operations.js"

const BenchmarkBudgetSchema = Schema.Struct({
  maxDurationMs: Schema.Number.pipe(Schema.greaterThan(0))
})

const deterministicLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(144),
  precision: "strict",
  backend: "typed-array",
  diagnostics: "enabled"
})

describe("numeric benchmark guard", () => {
  it.effect("numeric boundary baseline stays under benchmark guardrail", () =>
    Effect.gen(function*() {
      const budget = yield* Schema.decodeUnknown(BenchmarkBudgetSchema)({
        maxDurationMs: 100
      })

      const startedAt = yield* Clock.currentTimeMillis

      yield* validateNumericBoundary({
        values: [0.1, 0.2, 0.3, 0.4, 0.5],
        tolerance: 1e-9,
        budget: 256
      })

      const finishedAt = yield* Clock.currentTimeMillis
      const elapsed = finishedAt - startedAt

      expect(elapsed).toBeLessThanOrEqual(budget.maxDurationMs)
    }).pipe(Effect.provide(deterministicLayer)))
})
