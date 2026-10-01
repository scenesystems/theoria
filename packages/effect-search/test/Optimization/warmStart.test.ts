import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Equal, Number as Num, Ref } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Optimization from "../../src/Optimization.js"
import { type Context, pendingAsZeroPolicy } from "../../src/Sampler.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(1), 1)
  })

const captureSampler = (contextsRef: Ref.Ref<Iterable<Context>>): Sampler.Sampler =>
  new Sampler.Sampler({
    kind: Sampler.Random({ options: { seed: 0 } }),
    pendingImputationPolicy: pendingAsZeroPolicy,
    checkpoint: Effect.succeed({ _tag: "Random", seed: 0 }),
    restore: () => Effect.void,
    suggest: (_space, context) => Ref.update(contextsRef, Arr.append(context)).pipe(Effect.as({ x: 0 }))
  })

describe("warm-starting", () => {
  it.effect("injects prior trials into sampler context and preserves trial-budget semantics", () =>
    Effect.gen(function*() {
      const capturedContextsRef = yield* Ref.make<Iterable<Context>>(Arr.empty())
      const space = yield* makeSpace()

      const result = yield* Optimization.run({
        space,
        sampler: captureSampler(capturedContextsRef),
        direction: "minimize",
        trials: 2,
        priorWeight: 0.25,
        priorTrials: Arr.make(
          {
            config: { x: Num.negate(0.75) },
            value: 0.75
          },
          {
            config: { x: 0.5 },
            value: 0.5
          }
        ),
        objective: (raw) => {
          const config = raw
          return Effect.succeed(Numeric.abs(config.x))
        }
      })

      const trials = Arr.fromIterable(result.trials)
      expect(Arr.length(trials)).toBe(4)

      const priorTrials = Arr.filter(trials, (trial) => Equal.equals(trial.prior, true))
      const freshTrials = Arr.filter(trials, (trial) => Bool.not(Equal.equals(trial.prior, true)))

      expect(Arr.length(priorTrials)).toBe(2)
      expect(Arr.map(priorTrials, (trial) => trial.trialNumber)).toEqual(Arr.make(Num.negate(2), Num.negate(1)))
      expect(Arr.length(freshTrials)).toBe(2)
      expect(Arr.map(freshTrials, (trial) => trial.trialNumber)).toEqual(Arr.make(0, 1))

      const capturedContexts = Arr.fromIterable(yield* Ref.get(capturedContextsRef))
      const firstContext = yield* Arr.get(capturedContexts, 0)
      const secondContext = yield* Arr.get(capturedContexts, 1)

      expect(Arr.length(capturedContexts)).toBe(2)
      expect(Arr.length(firstContext.completed)).toBe(2)
      expect(Arr.map(firstContext.completed, (trial) => trial.observationWeight)).toEqual(Arr.make(0.25, 0.25))
      expect(firstContext.nextTrialNumber).toBe(0)
      expect(Arr.length(secondContext.completed)).toBe(3)
      expect(secondContext.nextTrialNumber).toBe(1)
    }))
})
