/**
 * Example contract: effect-search trial-cache behavior through the shared
 * study runtime helper.
 */
import { describe, expect, it } from "@effect/vitest"
import * as ObjectiveCache from "@scenesystems/effect-search/ObjectiveCache"
import * as Sampler from "@scenesystems/effect-search/Sampler"
import * as SearchSpace from "@scenesystems/effect-search/SearchSpace"
import * as Study from "@scenesystems/effect-search/Study"
import { Array as Arr, Effect, Match, Number as Num, Ref } from "effect"

const singleChoiceSpace = SearchSpace.make({
  choice: SearchSpace.categorical(["only"])
})

describe("examples/trial-cache-contract", () => {
  it.effect("returns cached trial outcomes for repeated configs in example runtime", () =>
    Effect.gen(function*() {
      const invocations = yield* Ref.make(0)
      const space = yield* singleChoiceSpace

      const result = yield* Study.optimize({
        space,
        sampler: Sampler.random({ seed: 31 }),
        direction: "maximize",
        trials: 4,
        concurrency: 1,
        objective: () => Ref.updateAndGet(invocations, Num.increment)
      }).pipe(
        Effect.provide(
          ObjectiveCache.layerMemory(new ObjectiveCache.Options({ scope: "effect-dsp/examples/trial-cache" }))
        )
      )

      expect(yield* Ref.get(invocations)).toBe(1)
      expect(Arr.fromIterable(result.trials)).toHaveLength(4)
      expect(
        Arr.every(Arr.fromIterable(result.trials), (trial) =>
          Match.value(trial.state).pipe(
            Match.tag("Completed", ({ value }) =>
              Match.value(value).pipe(
                Match.when(Match.number, (score) => Num.Equivalence(score, 1)),
                Match.orElse(() => false)
              )),
            Match.orElse(() => false)
          ))
      ).toBe(true)
    }))

  it.effect("invokes objective on every trial when no cache layer is provided", () =>
    Effect.gen(function*() {
      const invocations = yield* Ref.make(0)
      const space = yield* singleChoiceSpace

      yield* Study.optimize({
        space,
        sampler: Sampler.random({ seed: 31 }),
        direction: "maximize",
        trials: 4,
        concurrency: 1,
        objective: () => Ref.updateAndGet(invocations, Num.increment)
      })

      expect(yield* Ref.get(invocations)).toBe(4)
    }))
})
