import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Schema } from "effect"

import { buildConstraintDensityModels } from "../../../src/internal/tpe/constrainedDensity.js"
import { logDensity } from "../../../src/internal/tpe/continuousParzen.js"
import { splitSingleObjective } from "../../../src/internal/tpe/split/singleSplit.js"
import { observation } from "../../../src/Sampler.js"
import { ConstrainedTpeFixture, FixtureRegistryLive, loadFixture } from "../../helpers/fixtures/index.js"

const fixture = loadFixture("constrained-tpe.parity").pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(ConstrainedTpeFixture)),
  Effect.provide(FixtureRegistryLive)
)

describe("constraint observations against Optuna kernels", () => {
  it.effect("matches feasible and infeasible Parzen log densities", () =>
    Effect.gen(function*() {
      const reference = yield* fixture
      yield* Effect.forEach(reference.payload.densityCases, (entry) =>
        Effect.gen(function*() {
          const models = buildConstraintDensityModels(entry.observations)
          yield* Effect.forEach(entry.expectedLogDensities, (expected, dimension) =>
            Effect.gen(function*() {
              const model = yield* Effect.fromOption(Arr.get(models, dimension))
              const bounds = yield* Effect.fromOption(Arr.get(entry.bounds, dimension))
              expect(model.feasibleParzen.low).toBe(bounds.low)
              expect(model.feasibleParzen.high).toBe(bounds.high)
              yield* Effect.forEach(entry.probes, (probe, index) =>
                Effect.gen(function*() {
                  const value = yield* Effect.fromOption(Arr.get(probe, dimension))
                  const feasible = yield* Effect.fromOption(Arr.get(expected.feasible, index))
                  const infeasible = yield* Effect.fromOption(Arr.get(expected.infeasible, index))
                  expect(logDensity(model.feasibleParzen, value), `${entry.id} feasible ${dimension}/${index}`)
                    .toBeCloseTo(feasible, 9)
                  expect(logDensity(model.infeasibleParzen, value), `${entry.id} infeasible ${dimension}/${index}`)
                    .toBeCloseTo(infeasible, 9)
                }))
            }))
        }))
    }))

  it.effect("matches the feasibility-first split", () =>
    Effect.gen(function*() {
      const { payload: { splitCases } } = yield* fixture
      Arr.forEach(splitCases, (splitCase) => {
        const split = splitSingleObjective(
          Arr.map(splitCase.trials, (trial) =>
            observation(
              trial.trialNumber,
              { trialNumber: trial.trialNumber },
              trial.value,
              { constraints: trial.constraints }
            )),
          splitCase.direction
        )
        expect(Arr.map(split.below, (trial) => trial.trialNumber)).toEqual(splitCase.expectedBelow)
        expect(Arr.map(split.above, (trial) => trial.trialNumber)).toEqual(splitCase.expectedAbove)
      })
    }))
})
