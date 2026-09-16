import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Ref } from "effect"

import { type Context, pendingAsZeroPolicy } from "../../src/Sampler.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"
import * as Study from "../../src/Study.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(-1, 1)
  })

const captureSampler = (contextsRef: Ref.Ref<ReadonlyArray<Context>>): Sampler.Sampler =>
  new Sampler.Sampler({
    kind: Sampler.Random({ options: { seed: 0 } }),
    pendingImputationPolicy: pendingAsZeroPolicy,
    checkpoint: Effect.succeed({ _tag: "Random", seed: 0 }),
    restore: () => Effect.void,
    suggest: (_space, context) =>
      Ref.update(contextsRef, (contexts) => [...contexts, context]).pipe(Effect.as({ x: 0 }))
  })

describe("warm-starting", () => {
  it.effect("injects prior trials into sampler context and preserves trial-budget semantics", () =>
    Effect.gen(function*() {
      const capturedContextsRef = yield* Ref.make<ReadonlyArray<Context>>([])
      const space = yield* makeSpace()

      const result = yield* Study.optimize({
        space,
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
          const config = raw
          return Effect.succeed(Math.abs(config.x))
        }
      })

      const trials = Arr.fromIterable(result.trials)
      expect(Arr.length(trials)).toBe(4)

      const priorTrials = Arr.filter(trials, (trial) => trial.prior === true)
      const freshTrials = Arr.filter(trials, (trial) => trial.prior !== true)

      expect(Arr.length(priorTrials)).toBe(2)
      expect(Arr.map(priorTrials, (trial) => trial.trialNumber)).toEqual([-2, -1])
      expect(Arr.length(freshTrials)).toBe(2)
      expect(Arr.map(freshTrials, (trial) => trial.trialNumber)).toEqual([0, 1])

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
