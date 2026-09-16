import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as Num, Option, Schema, Tuple } from "effect"

import * as Direction from "../../../src/Direction.js"
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
        constraints: Arr.of(() => Effect.succeed(0))
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
        Arr.make(
          completed(0, Num.negate(100), Arr.of(2)),
          completed(1, 1, Arr.of(Num.negate(0.2))),
          completed(2, 2, Arr.of(Num.negate(0.1)))
        ),
        "minimize"
      )

      expect(Arr.map(split.below, (trial) => trial.trialNumber)).toEqual(Arr.of(1))
    }))

  it.effect("falls back to unconstrained split when feasible history is absent", () =>
    Effect.sync(() => {
      const split = splitSingleObjective(
        Arr.make(
          completed(0, Num.negate(10), Arr.of(1)),
          completed(1, 0, Arr.of(0.5)),
          completed(2, 2, Arr.of(2))
        ),
        "minimize"
      )

      expect(Arr.map(split.below, (trial) => trial.trialNumber)).toEqual(Arr.of(0))
    }))

  it.effect("uses constraint density-ratio product to rank infeasible carry-over trials", () =>
    Effect.sync(() => {
      const split = splitMultiObjective(
        Arr.make(
          completed(0, Arr.make(10, 10), Arr.of(Num.negate(0.5))),
          completed(1, Arr.make(0, 0), Arr.of(0.05)),
          completed(2, Arr.make(0, 0), Arr.of(3))
        ),
        Tuple.make(Direction.minimize, Direction.minimize),
        2
      )
      const densityModels = buildConstraintDensityModels(
        Arr.make(Arr.of(Num.negate(0.5)), Arr.of(0.05), Arr.of(3))
      )
      const nearBoundaryProduct = constraintDensityRatioProduct(densityModels, Arr.of(0.05))
      const farViolationProduct = constraintDensityRatioProduct(densityModels, Arr.of(3))

      expect(nearBoundaryProduct).toBeGreaterThan(farViolationProduct)
      expect(Arr.map(split.below, (trial) => trial.trialNumber)).toEqual(Arr.make(0, 1))
      expect(Arr.map(split.above, (trial) => trial.trialNumber)).toEqual(Arr.of(2))
    }))

  it.effect("enforces feasibility-first behavior for multi-objective split", () =>
    Effect.sync(() => {
      const split = splitMultiObjective(
        Arr.make(
          completed(0, Arr.make(0, 0), Arr.of(1)),
          completed(1, Arr.make(5, 5), Arr.of(Num.negate(0.3))),
          completed(2, Arr.make(6, 4), Arr.of(Num.negate(0.2)))
        ),
        Tuple.make(Direction.minimize, Direction.minimize),
        1
      )
      const selected = Arr.map(split.below, (trial) => trial.trialNumber)

      expect(selected).toHaveLength(1)
      expect(Arr.head(selected)).not.toEqual(Option.some(0))
    }))
})
