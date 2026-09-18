import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as Num, Option, Schema } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeScalarSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(2), 2)
  })

const makeTypedSpace = () =>
  SearchSpace.make({
    lr: SearchSpace.float(0.0001, 0.1),
    optimizer: SearchSpace.categorical(Schema.Literal("adam", "sgd").literals)
  })

const expectTypedConfig = (config: { readonly lr: number; readonly optimizer: "adam" | "sgd" }) => config

const asSingleObjective = (
  result: Optimization.Result
): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

describe("Optimization convenience combinators", () => {
  it.effect("Optimization.minimize matches Optimization.run with minimize direction", () =>
    Effect.gen(function*() {
      const space = yield* makeScalarSpace()
      const objective = (config: SearchSpace.Type<typeof space>) => Effect.succeed(config.x)

      const minimized = yield* Optimization.minimize({
        space,
        sampler: Sampler.random({ seed: 111 }),
        trials: 14,
        objective
      })

      const optimized = yield* Optimization.run({
        space,
        sampler: Sampler.random({ seed: 111 }),
        direction: "minimize",
        trials: 14,
        objective
      })

      expect(minimized._tag).toBe("SingleObjective")
      expect(optimized._tag).toBe("SingleObjective")
      const minimizedSingle = yield* asSingleObjective(minimized)
      const optimizedSingle = yield* asSingleObjective(optimized)

      expect(minimizedSingle.bestTrial.state.value).toBe(optimizedSingle.bestTrial.state.value)
      expect(minimizedSingle.trials).toHaveLength(Arr.length(Arr.fromIterable(optimizedSingle.trials)))
    }))

  it.effect("Optimization.maximize matches Optimization.run with maximize direction", () =>
    Effect.gen(function*() {
      const space = yield* makeScalarSpace()
      const objective = (config: SearchSpace.Type<typeof space>) => Effect.succeed(config.x)

      const maximized = yield* Optimization.maximize({
        space,
        sampler: Sampler.random({ seed: 222 }),
        trials: 14,
        objective
      })

      const optimized = yield* Optimization.run({
        space,
        sampler: Sampler.random({ seed: 222 }),
        direction: "maximize",
        trials: 14,
        objective
      })

      expect(maximized._tag).toBe("SingleObjective")
      expect(optimized._tag).toBe("SingleObjective")
      const maximizedSingle = yield* asSingleObjective(maximized)
      const optimizedSingle = yield* asSingleObjective(optimized)

      expect(maximizedSingle.bestTrial.state.value).toBe(optimizedSingle.bestTrial.state.value)
      expect(maximizedSingle.trials).toHaveLength(Arr.length(Arr.fromIterable(optimizedSingle.trials)))
    }))

  it.effect("infers typed objective config for Optimization.minimize and Optimization.maximize", () =>
    Effect.gen(function*() {
      const space = yield* makeTypedSpace()
      const score = (config: SearchSpace.Type<typeof space>) =>
        Effect.succeed(Num.sum(
          config.lr,
          Match.value(config.optimizer).pipe(
            Match.when("adam", () => 0),
            Match.orElse(() => 1)
          )
        ))

      const minimized = yield* Optimization.minimize({
        space,
        sampler: Sampler.random({ seed: 5 }),
        trials: 6,
        objective: (config) => score(expectTypedConfig(config))
      })

      const maximized = yield* Optimization.maximize({
        space,
        sampler: Sampler.random({ seed: 5 }),
        trials: 6,
        objective: (config) => score(expectTypedConfig(config))
      })

      expect(minimized._tag).toBe("SingleObjective")
      expect(maximized._tag).toBe("SingleObjective")
    }))
})
