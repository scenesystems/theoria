import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect } from "effect"

import { constantLiar } from "../../src/internal/constantLiar.js"
import { multi, single } from "../../src/Objective.js"
import { Context, Observation, Pending } from "../../src/Sampler.js"

const pending = [
  new Pending({ trialNumber: 10, config: { lr: 0.01 } }),
  new Pending({ trialNumber: 11, config: { lr: 0.05 } })
]

const completed = [
  new Observation({ trialNumber: 0, config: { lr: 0.01 }, value: 0.2 }),
  new Observation({ trialNumber: 1, config: { lr: 0.02 }, value: 0.5 }),
  new Observation({ trialNumber: 2, config: { lr: 0.03 }, value: 0.1 })
]

describe("constant liar", () => {
  it.effect("uses the worst seen value for minimize studies", () =>
    Effect.sync(() => {
      const lied = constantLiar(
        new Context({
          completed,
          pending,
          objectiveSpec: single("minimize"),
          nextTrialNumber: 12,
          epsilon: 0
        })
      )

      expect(lied).toHaveLength(2)
      expect(Chunk.toReadonlyArray(Chunk.map(lied, (trial) => trial.value))).toEqual([0.5, 0.5])
    }))

  it.effect("uses the worst seen value for maximize studies", () =>
    Effect.sync(() => {
      const lied = constantLiar(
        new Context({
          completed,
          pending,
          objectiveSpec: single("maximize"),
          nextTrialNumber: 12,
          epsilon: 0
        })
      )

      expect(lied).toHaveLength(2)
      expect(Chunk.toReadonlyArray(Chunk.map(lied, (trial) => trial.value))).toEqual([0.1, 0.1])
    }))

  it.effect("applies objective-specific worst values for multi-objective studies", () =>
    Effect.sync(() => {
      const lied = constantLiar(
        new Context({
          completed: [
            new Observation({ trialNumber: 0, config: { lr: 0.01 }, value: [0.2, 0.9] }),
            new Observation({ trialNumber: 1, config: { lr: 0.02 }, value: [0.5, 0.4] }),
            new Observation({ trialNumber: 2, config: { lr: 0.03 }, value: [0.1, 0.8] })
          ],
          pending,
          objectiveSpec: multi(["minimize", "maximize"]),
          nextTrialNumber: 12,
          epsilon: 0
        })
      )

      expect(lied).toHaveLength(2)
      expect(Chunk.toReadonlyArray(Chunk.map(lied, (trial) => trial.value))).toEqual([
        [0.5, 0.4],
        [0.5, 0.4]
      ])
    }))
})
