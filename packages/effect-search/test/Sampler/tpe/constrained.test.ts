import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Schema } from "effect"

import {
  buildConstraintDensityModels,
  constraintDensityRatioProduct
} from "../../../src/internal/tpe/constrainedDensity.js"
import { splitMultiObjective } from "../../../src/internal/tpe/split/multiSplit.js"
import { splitSingleObjective } from "../../../src/internal/tpe/split/singleSplit.js"
import type { Value } from "../../../src/Objective.js"
import * as Sampler from "../../../src/Sampler.js"

const completed = (
  trialNumber: number,
  value: Value,
  constraintsInput?: Iterable<number>
): Sampler.Observation => {
  const constraints = Option.map(Option.fromNullable(constraintsInput), Arr.fromIterable)
  return Sampler.observation(
    trialNumber,
    { trialNumber },
    value,
    Option.match(constraints, {
      onNone: () => ({}),
      onSome: (resolved) => ({ constraints: resolved })
    })
  )
}

describe("constrained tpe", () => {
  it.effect("keeps runtime constraint evaluators out of snapshot metadata", () =>
    Effect.sync(() => {
      const sampler = Sampler.tpe({
        seed: 23,
        constraints: [() => Effect.succeed(0)]
      })
      const decode = Schema.decodeUnknownEither(Sampler.Kind)
      const decoded = decode(sampler.kind)
      const constraintsCount = Sampler.matchKind({
        Random: () => 0,
        Grid: () => 0,
        Tpe: ({ options }) => Option.fromNullable(options.constraintsCount).pipe(Option.getOrElse(() => 0)),
        CmaEs: () => 0,
        GpBo: () => 0
      })(sampler.kind)

      expect(decoded._tag).toBe("Right")
      expect(constraintsCount).toBe(1)
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
