import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { multiObjectiveSpec, singleObjectiveSpec } from "../../src/contracts/index.js"
import { constantLiar } from "../../src/internal/constantLiar.js"
import { SuggestCompletedTrial, SuggestContext, SuggestPendingTrial } from "../../src/Sampler/index.js"

const pending = [
  new SuggestPendingTrial({ trialNumber: 10, config: { lr: 0.01 } }),
  new SuggestPendingTrial({ trialNumber: 11, config: { lr: 0.05 } })
]

const completed = [
  new SuggestCompletedTrial({ trialNumber: 0, config: { lr: 0.01 }, value: 0.2 }),
  new SuggestCompletedTrial({ trialNumber: 1, config: { lr: 0.02 }, value: 0.5 }),
  new SuggestCompletedTrial({ trialNumber: 2, config: { lr: 0.03 }, value: 0.1 })
]

describe("constant liar", () => {
  it.effect("uses the worst seen value for minimize studies", () =>
    Effect.sync(() => {
      const lied = constantLiar(
        new SuggestContext({
          completed,
          pending,
          objectiveSpec: singleObjectiveSpec("minimize"),
          nextTrialNumber: 12,
          epsilon: 0
        })
      )

      expect(lied).toHaveLength(2)
      expect(lied.map((trial) => trial.value)).toEqual([0.5, 0.5])
    }))

  it.effect("uses the worst seen value for maximize studies", () =>
    Effect.sync(() => {
      const lied = constantLiar(
        new SuggestContext({
          completed,
          pending,
          objectiveSpec: singleObjectiveSpec("maximize"),
          nextTrialNumber: 12,
          epsilon: 0
        })
      )

      expect(lied).toHaveLength(2)
      expect(lied.map((trial) => trial.value)).toEqual([0.1, 0.1])
    }))

  it.effect("applies objective-specific worst values for multi-objective studies", () =>
    Effect.sync(() => {
      const lied = constantLiar(
        new SuggestContext({
          completed: [
            new SuggestCompletedTrial({ trialNumber: 0, config: { lr: 0.01 }, value: [0.2, 0.9] }),
            new SuggestCompletedTrial({ trialNumber: 1, config: { lr: 0.02 }, value: [0.5, 0.4] }),
            new SuggestCompletedTrial({ trialNumber: 2, config: { lr: 0.03 }, value: [0.1, 0.8] })
          ],
          pending,
          objectiveSpec: multiObjectiveSpec(["minimize", "maximize"]),
          nextTrialNumber: 12,
          epsilon: 0
        })
      )

      expect(lied).toHaveLength(2)
      expect(lied.map((trial) => trial.value)).toEqual([
        [0.5, 0.4],
        [0.5, 0.4]
      ])
    }))
})
