import { describe, expect, it } from "@effect/vitest"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Clock, Effect, Equal, Number as Num, Option, Schema } from "effect"

import { splitMultiObjective } from "../../../src/internal/tpe/split/multiSplit.js"
import * as Sampler from "../../../src/Sampler.js"
import {
  type FixtureName,
  FixtureRegistryLive,
  loadFixture,
  MotpeHsspBelowWeightsFixture,
  MotpeHsspFeasibilityFixture,
  MotpeHsspManyObjectiveFixture,
  MotpeHsspTiesFixture
} from "../../helpers/fixtures/index.js"

const load = <S extends Schema.Top>(name: FixtureName, schema: S) =>
  loadFixture(name).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.provide(FixtureRegistryLive)
  )

const pointObservations = (points: ReadonlyArray<ReadonlyArray<number>>) =>
  Arr.map(points, (point, trialNumber) => Sampler.observation(trialNumber, { trialNumber }, point))

const constrainedObservations = (
  trials: ReadonlyArray<{
    readonly trialNumber: number
    readonly values: ReadonlyArray<number>
    readonly constraints: ReadonlyArray<number>
  }>
) =>
  Arr.map(trials, (trial) =>
    Sampler.observation(trial.trialNumber, { trialNumber: trial.trialNumber }, trial.values, {
      constraints: trial.constraints
    }))

const numbers = (trials: ReadonlyArray<{ readonly trialNumber: number }>) =>
  Arr.map(trials, (trial) => trial.trialNumber)

// Optuna's 3-objective `_compute_3d` sums through BLAS `np.dot` (OpenBLAS FMA kernels), so only
// those weights may differ from sequential IEEE sums in the last bits; every other case is exact.
const threeObjectiveRelativeBound = 4e-15

// One upstream split took 21-82 ms for these sizes; the exact recursive subset volume took 1.9-257 s.
const splitBudgetMillis = 3000

describe("MOTPE split parity against live Optuna 4.9", () => {
  it.effect("motpe-hssp.ties: HSSP ties follow upstream lexicographic unique order and duplicate fill", () =>
    Effect.gen(function*() {
      const { payload } = yield* load("motpe-hssp.ties", MotpeHsspTiesFixture)
      yield* Effect.forEach(payload.cases, (testCase) =>
        Effect.sync(() => {
          const split = splitMultiObjective(pointObservations(testCase.points), testCase.directions, testCase.nBelow)
          expect(numbers(split.below), testCase.id).toEqual(testCase.expectedBelow)
          expect(numbers(split.above), testCase.id).toEqual(testCase.expectedAbove)
        }))
    }))

  it.effect("motpe-hssp.feasibility-fronts: only feasible trials form fronts; infeasible trials fill by violation", () =>
    Effect.gen(function*() {
      const { payload } = yield* load("motpe-hssp.feasibility-fronts", MotpeHsspFeasibilityFixture)
      yield* Effect.forEach(payload.cases, (testCase) =>
        Effect.sync(() => {
          const split = splitMultiObjective(
            constrainedObservations(testCase.trials),
            testCase.directions,
            testCase.nBelow
          )
          expect(numbers(split.below), testCase.id).toEqual(testCase.expectedBelow)
          expect(numbers(split.above), testCase.id).toEqual(testCase.expectedAbove)
        }))
    }))

  it.live(
    "motpe-hssp.many-objective: exact upstream below sets within a bounded split time",
    () =>
      Effect.gen(function*() {
        const { payload } = yield* load("motpe-hssp.many-objective", MotpeHsspManyObjectiveFixture)
        yield* Effect.forEach(payload.cases, (testCase) =>
          Effect.gen(function*() {
            const observations = pointObservations(testCase.points)
            const started = yield* Clock.currentTimeMillis
            const split = splitMultiObjective(observations, testCase.directions, testCase.nBelow)
            const elapsed = Num.subtract(yield* Clock.currentTimeMillis, started)
            expect(Arr.length(split.below), testCase.id).toBe(testCase.nBelow)
            expect(numbers(split.below), testCase.id).toEqual(testCase.expectedBelow)
            expect(elapsed, `${testCase.id} split milliseconds`).toBeLessThan(splitBudgetMillis)
          }))
      }),
    120_000
  )

  it.effect("motpe-hssp.below-weights: below kernels carry upstream hypervolume-contribution weights", () =>
    Effect.gen(function*() {
      const { payload } = yield* load("motpe-hssp.below-weights", MotpeHsspBelowWeightsFixture)
      yield* Effect.forEach(payload.cases, (testCase) =>
        Effect.sync(() => {
          const split = splitMultiObjective(
            constrainedObservations(testCase.trials),
            testCase.directions,
            Arr.length(testCase.trials)
          )
          expect(numbers(split.below), testCase.id).toEqual(numbers(testCase.trials))
          const weights = Arr.map(
            split.below,
            (trial) => Option.getOrElse(Option.fromNullishOr(trial.belowWeight), () => Number.NaN)
          )
          Bool.match(Equal.equals(Arr.length(testCase.directions), 3), {
            onFalse: () => expect(weights, testCase.id).toEqual(testCase.expectedWeights),
            onTrue: () =>
              Arr.forEach(Arr.zip(weights, testCase.expectedWeights), ([actual, expected]) =>
                expect(
                  Numeric.abs(Num.subtract(actual, expected)),
                  `${testCase.id}: ${actual} vs ${expected}`
                ).toBeLessThanOrEqual(Num.multiply(threeObjectiveRelativeBound, Num.max(1, Numeric.abs(expected)))))
          })
        }))
    }))
})
