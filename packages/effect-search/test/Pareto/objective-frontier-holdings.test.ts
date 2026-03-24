import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect } from "effect"

import type { Direction } from "../../src/contracts/index.js"
import * as Pareto from "../../src/Pareto/index.js"

const directions = (...values: ReadonlyArray<Direction>): ReadonlyArray<Direction> => Arr.fromIterable(values)

describe("Pareto objective frontier holdings", () => {
  it.effect("tracks maximize-direction holders and ties for each objective", () =>
    Effect.sync(() => {
      const points = Arr.make(
        Arr.make(0.8, 0.4, 0.6),
        Arr.make(0.7, 0.9, 0.5),
        Arr.make(0.8, 0.9, 0.2)
      )
      const holdings = Pareto.objectiveFrontierHoldings(points, directions("maximize", "maximize", "maximize"))

      expect(holdings).toEqual([
        new Pareto.ObjectiveFrontierHolding({
          objectiveIndex: 0,
          bestValue: 0.8,
          holders: Arr.make(0, 2)
        }),
        new Pareto.ObjectiveFrontierHolding({
          objectiveIndex: 1,
          bestValue: 0.9,
          holders: Arr.make(1, 2)
        }),
        new Pareto.ObjectiveFrontierHolding({
          objectiveIndex: 2,
          bestValue: 0.6,
          holders: Arr.make(0)
        })
      ])
    }))

  it.effect("defaults to minimize-direction holdings when directions are omitted", () =>
    Effect.sync(() => {
      const points = Arr.make(
        Arr.make(1, 4),
        Arr.make(2, 2),
        Arr.make(3, 1),
        Arr.make(4, 3),
        Arr.make(2, 2)
      )
      const holdings = Pareto.objectiveFrontierHoldings(points)

      expect(holdings).toEqual([
        new Pareto.ObjectiveFrontierHolding({
          objectiveIndex: 0,
          bestValue: 1,
          holders: Arr.make(0)
        }),
        new Pareto.ObjectiveFrontierHolding({
          objectiveIndex: 1,
          bestValue: 1,
          holders: Arr.make(2)
        })
      ])
    }))

  it.effect("returns an empty holdings vector for an empty point set", () =>
    Effect.sync(() => {
      expect(Pareto.objectiveFrontierHoldings(Arr.empty<ReadonlyArray<number>>())).toEqual([])
    }))

  it.effect("derives per-candidate weights from objective frontier holdings", () =>
    Effect.sync(() => {
      const points = Arr.make(
        Arr.make(0.8, 0.4, 0.6),
        Arr.make(0.7, 0.9, 0.5),
        Arr.make(0.8, 0.9, 0.2)
      )

      expect(Pareto.objectiveFrontierWeights(points, directions("maximize", "maximize", "maximize"))).toEqual([
        new Pareto.ObjectiveFrontierWeight({ candidateIndex: 0, weight: 2 }),
        new Pareto.ObjectiveFrontierWeight({ candidateIndex: 1, weight: 1 }),
        new Pareto.ObjectiveFrontierWeight({ candidateIndex: 2, weight: 2 })
      ])
    }))

  it.effect("exposes dominated-index complements and maximize direction helpers", () =>
    Effect.sync(() => {
      const points = Arr.make(
        Arr.make(1, 4),
        Arr.make(2, 2),
        Arr.make(3, 1),
        Arr.make(4, 3),
        Arr.make(2, 2)
      )

      expect(Pareto.maximizeDirections(3)).toEqual(directions("maximize", "maximize", "maximize"))
      expect(Pareto.dominatedIndices(points, directions("minimize", "minimize"))).toEqual(Arr.make(3))
    }))

  it.effect("aliases objective frontier weights as objective holding weights", () =>
    Effect.sync(() => {
      const points = Arr.make(
        Arr.make(0.8, 0.4, 0.6),
        Arr.make(0.7, 0.9, 0.5),
        Arr.make(0.8, 0.9, 0.2)
      )
      const maximize = directions("maximize", "maximize", "maximize")

      expect(Pareto.objectiveHoldingWeights(points, maximize)).toEqual(
        Pareto.objectiveFrontierWeights(points, maximize)
      )
    }))

  it.effect("builds deterministic frontier snapshots with dominated complements and holding weights", () =>
    Effect.sync(() => {
      const points = Arr.make(
        Arr.make(1, 4),
        Arr.make(2, 2),
        Arr.make(3, 1),
        Arr.make(4, 3),
        Arr.make(2, 2)
      )

      expect(Pareto.frontierSnapshot(points, directions("minimize", "minimize"))).toEqual(
        new Pareto.FrontierSnapshot({
          frontierIndices: Arr.make(0, 1, 2, 4),
          dominatedIndices: Arr.make(3),
          objectiveHoldings: Arr.make(
            new Pareto.ObjectiveFrontierHolding({
              objectiveIndex: 0,
              bestValue: 1,
              holders: Arr.make(0)
            }),
            new Pareto.ObjectiveFrontierHolding({
              objectiveIndex: 1,
              bestValue: 1,
              holders: Arr.make(2)
            })
          ),
          holdingWeights: Arr.make(
            new Pareto.ObjectiveFrontierWeight({ candidateIndex: 0, weight: 1 }),
            new Pareto.ObjectiveFrontierWeight({ candidateIndex: 1, weight: 0 }),
            new Pareto.ObjectiveFrontierWeight({ candidateIndex: 2, weight: 1 }),
            new Pareto.ObjectiveFrontierWeight({ candidateIndex: 3, weight: 0 }),
            new Pareto.ObjectiveFrontierWeight({ candidateIndex: 4, weight: 0 })
          )
        })
      )
    }))
})
