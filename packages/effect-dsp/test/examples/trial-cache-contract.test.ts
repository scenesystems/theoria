/**
 * Example contract: effect-search trial-cache behavior through the shared
 * study runtime helper.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Number as Num, Ref } from "effect"
import { Sampler, SearchSpace, Study } from "effect-search"

const singleChoiceSpace = () =>
  SearchSpace.unsafeMake({
    choice: SearchSpace.categorical(["only"])
  })

describe("examples/trial-cache-contract", () => {
  it.effect("returns cached trial outcomes for repeated configs in example runtime", () =>
    Effect.gen(function*() {
      const invocations = yield* Ref.make(0)

      const result = yield* Study.optimize({
        space: singleChoiceSpace(),
        sampler: Sampler.random({ seed: 31 }),
        direction: "maximize",
        trials: 4,
        concurrency: 1,
        objective: () => Ref.updateAndGet(invocations, Num.increment)
      }).pipe(
        Effect.provide(
          Study.StudyObjectiveCacheMemory(
            Study.studyObjectiveCacheOptions("effect-dsp/examples/trial-cache")
          )
        )
      )

      expect(yield* Ref.get(invocations)).toBe(1)
      expect(result.trials).toHaveLength(4)
      expect(
        result.trials.every(
          (trial) => trial.state._tag === "Completed" && trial.state.value === 1
        )
      ).toBe(true)
    }))

  it.effect("invokes objective on every trial when no cache layer is provided", () =>
    Effect.gen(function*() {
      const invocations = yield* Ref.make(0)

      yield* Study.optimize({
        space: singleChoiceSpace(),
        sampler: Sampler.random({ seed: 31 }),
        direction: "maximize",
        trials: 4,
        concurrency: 1,
        objective: () => Ref.updateAndGet(invocations, Num.increment)
      })

      expect(yield* Ref.get(invocations)).toBe(4)
    }))
})
