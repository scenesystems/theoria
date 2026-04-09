import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"

import {
  buildConstraintDensityModels,
  constraintDensityRatioProduct
} from "../../../src/internal/tpe/constrainedDensity.js"
import * as Sampler from "../../../src/Sampler/index.js"
import { splitMultiObjective } from "../../../src/samplers/Tpe/split/multiSplit.js"
import { splitSingleObjective } from "../../../src/samplers/Tpe/split/singleSplit.js"

const completed = (
  trialNumber: number,
  value: number | ReadonlyArray<number>,
  constraints?: ReadonlyArray<number>
): Sampler.SuggestCompletedTrial =>
  Sampler.SuggestCompletedTrial.fromObservation(
    trialNumber,
    { trialNumber },
    value,
    undefined,
    undefined,
    undefined,
    constraints
  )

describe("constrained tpe", () => {
  it.effect("keeps runtime constraint evaluators out of snapshot metadata", () =>
    Effect.sync(() => {
      const sampler = Sampler.tpe({
        seed: 23,
        constraints: [() => Effect.succeed(0)]
      })
      const decode = Schema.decodeUnknownEither(Sampler.SamplerKindSchema)
      const decoded = decode(sampler.kind)
      const tpeOptions = Sampler.matchSamplerKind({
        Random: () => Option.none<Sampler.TpeOptions>(),
        Grid: () => Option.none<Sampler.TpeOptions>(),
        Tpe: ({ options }) => Option.some(options),
        CmaEs: () => Option.none<Sampler.TpeOptions>(),
        GpBo: () => Option.none<Sampler.TpeOptions>()
      })(sampler.kind)

      expect(decoded._tag).toBe("Right")
      expect(Option.isSome(tpeOptions)).toBe(true)

      if (Option.isNone(tpeOptions)) {
        return
      }

      expect(tpeOptions.value.constraintsCount).toBe(1)
    }))

  it.effect("prefers feasible history over infeasible objective winners in single-objective split", () =>
    Effect.sync(() => {
      const split = splitSingleObjective(
        [
          completed(0, -100, [2]),
          completed(1, 1, [-0.2]),
          completed(2, 2, [-0.1])
        ],
        "minimize"
      )

      expect(split.below.map((trial) => trial.trialNumber)).toEqual([1])
    }))

  it.effect("falls back to unconstrained split when feasible history is absent", () =>
    Effect.sync(() => {
      const split = splitSingleObjective(
        [
          completed(0, -10, [1]),
          completed(1, 0, [0.5]),
          completed(2, 2, [2])
        ],
        "minimize"
      )

      expect(split.below.map((trial) => trial.trialNumber)).toEqual([0])
    }))

  it.effect("uses constraint density-ratio product to rank infeasible carry-over trials", () =>
    Effect.sync(() => {
      const split = splitMultiObjective(
        [
          completed(0, [10, 10], [-0.5]),
          completed(1, [0, 0], [0.05]),
          completed(2, [0, 0], [3])
        ],
        ["minimize", "minimize"],
        2
      )
      const densityModels = buildConstraintDensityModels([[-0.5], [0.05], [3]])
      const nearBoundaryProduct = constraintDensityRatioProduct(densityModels, [0.05])
      const farViolationProduct = constraintDensityRatioProduct(densityModels, [3])

      expect(nearBoundaryProduct).toBeGreaterThan(farViolationProduct)
      expect(split.below.map((trial) => trial.trialNumber)).toEqual([0, 1])
      expect(split.above.map((trial) => trial.trialNumber)).toEqual([2])
    }))

  it.effect("enforces feasibility-first behavior for multi-objective split", () =>
    Effect.sync(() => {
      const split = splitMultiObjective(
        [
          completed(0, [0, 0], [1]),
          completed(1, [5, 5], [-0.3]),
          completed(2, [6, 4], [-0.2])
        ],
        ["minimize", "minimize"],
        1
      )
      const selected = split.below.map((trial) => trial.trialNumber)

      expect(selected).toHaveLength(1)
      expect(selected[0]).not.toBe(0)
    }))
})
