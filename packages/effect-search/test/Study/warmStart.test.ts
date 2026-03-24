import { describe, expect, it } from "@effect/vitest"
import { Effect, Ref, Schema } from "effect"

import { pendingAsZeroImputationPolicy, type SuggestContext } from "../../src/Sampler/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1)
  })

const decodeConfig = Schema.decodeUnknownSync(makeSpace().schema)

const captureSampler = (contextsRef: Ref.Ref<ReadonlyArray<SuggestContext>>): Sampler.Sampler =>
  new Sampler.Sampler({
    kind: Sampler.Random({ options: { seed: 0 } }),
    pendingImputationPolicy: pendingAsZeroImputationPolicy,
    checkpoint: Effect.succeed({ _tag: "Random", seed: 0 }),
    restore: () => Effect.void,
    suggest: (_space, context) =>
      Ref.update(contextsRef, (contexts) => [...contexts, context]).pipe(Effect.as({ x: 0 }))
  })

describe("warm-starting", () => {
  it.effect("injects prior trials into sampler context and preserves trial-budget semantics", () =>
    Effect.gen(function*() {
      const capturedContextsRef = yield* Ref.make<ReadonlyArray<SuggestContext>>([])

      const result = yield* Study.optimize({
        space: makeSpace(),
        sampler: captureSampler(capturedContextsRef),
        direction: "minimize",
        trials: 2,
        priorWeight: 0.25,
        priorTrials: [
          {
            config: { x: -0.75 },
            value: 0.75
          },
          {
            config: { x: 0.5 },
            value: 0.5
          }
        ],
        objective: (raw) => {
          const config = decodeConfig(raw)
          return Effect.succeed(Math.abs(config.x))
        }
      })

      expect(result.trials.length).toBe(4)

      const priorTrials = result.trials.filter((trial) => trial.prior === true)
      const freshTrials = result.trials.filter((trial) => trial.prior !== true)

      expect(priorTrials.length).toBe(2)
      expect(priorTrials.map((trial) => trial.trialNumber)).toEqual([-2, -1])
      expect(freshTrials.length).toBe(2)
      expect(freshTrials.map((trial) => trial.trialNumber)).toEqual([0, 1])

      const capturedContexts = yield* Ref.get(capturedContextsRef)
      const firstContext = capturedContexts[0]
      const secondContext = capturedContexts[1]

      expect(capturedContexts.length).toBe(2)
      expect(firstContext?.completed.length).toBe(2)
      expect(firstContext?.completed.map((trial) => trial.observationWeight)).toEqual([0.25, 0.25])
      expect(firstContext?.nextTrialNumber).toBe(0)
      expect(secondContext?.completed.length).toBe(3)
      expect(secondContext?.nextTrialNumber).toBe(1)
    }))
})
