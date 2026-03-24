import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeScalarSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-2, 2)
  })

const makeTypedSpace = () =>
  SearchSpace.unsafeMake({
    lr: SearchSpace.float(0.0001, 0.1),
    optimizer: SearchSpace.categorical(["adam", "sgd"])
  })

const expectTypedConfig = (config: { readonly lr: number; readonly optimizer: "adam" | "sgd" }) => config

describe("Study convenience combinators", () => {
  it.effect("Study.minimize matches Study.optimize with minimize direction", () =>
    Effect.gen(function*() {
      const space = makeScalarSpace()
      const objective = (config: SearchSpace.Type<typeof space>) => Effect.succeed(config.x)

      const minimized = yield* Study.minimize({
        space,
        sampler: Sampler.random({ seed: 111 }),
        trials: 14,
        objective
      })

      const optimized = yield* Study.optimize({
        space,
        sampler: Sampler.random({ seed: 111 }),
        direction: "minimize",
        trials: 14,
        objective
      })

      expect(minimized._tag).toBe("SingleObjective")
      expect(optimized._tag).toBe("SingleObjective")

      if (minimized._tag !== "SingleObjective" || optimized._tag !== "SingleObjective") {
        return
      }

      expect(minimized.bestTrial.state.value).toBe(optimized.bestTrial.state.value)
      expect(minimized.trials).toHaveLength(optimized.trials.length)
    }))

  it.effect("Study.maximize matches Study.optimize with maximize direction", () =>
    Effect.gen(function*() {
      const space = makeScalarSpace()
      const objective = (config: SearchSpace.Type<typeof space>) => Effect.succeed(config.x)

      const maximized = yield* Study.maximize({
        space,
        sampler: Sampler.random({ seed: 222 }),
        trials: 14,
        objective
      })

      const optimized = yield* Study.optimize({
        space,
        sampler: Sampler.random({ seed: 222 }),
        direction: "maximize",
        trials: 14,
        objective
      })

      expect(maximized._tag).toBe("SingleObjective")
      expect(optimized._tag).toBe("SingleObjective")

      if (maximized._tag !== "SingleObjective" || optimized._tag !== "SingleObjective") {
        return
      }

      expect(maximized.bestTrial.state.value).toBe(optimized.bestTrial.state.value)
      expect(maximized.trials).toHaveLength(optimized.trials.length)
    }))

  it.effect("infers typed objective config for Study.minimize and Study.maximize", () =>
    Effect.gen(function*() {
      const space = makeTypedSpace()
      const score = (config: SearchSpace.Type<typeof space>) =>
        Effect.succeed(config.lr + (config.optimizer === "adam" ? 0 : 1))

      const minimized = yield* Study.minimize({
        space,
        sampler: Sampler.random({ seed: 5 }),
        trials: 6,
        objective: (config) => score(expectTypedConfig(config))
      })

      const maximized = yield* Study.maximize({
        space,
        sampler: Sampler.random({ seed: 5 }),
        trials: 6,
        objective: (config) => score(expectTypedConfig(config))
      })

      expect(minimized._tag).toBe("SingleObjective")
      expect(maximized._tag).toBe("SingleObjective")
    }))
})
