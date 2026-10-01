import { describe, expect, it } from "@effect/vitest"
import { Effect, Number as Num } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(1), 1)
  })

describe("Optimization handle guard", () => {
  it.effect("accepts an opened optimization handle and rejects a tag-only impostor", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handle = yield* Optimization.open({
          space: yield* makeSpace(),
          sampler: Sampler.random({ seed: 555 }),
          direction: "minimize",
          trials: 1,
          objective: () => Effect.succeed(0)
        })

        expect(Optimization.isOptimization(handle)).toBe(true)
        expect(Optimization.isOptimization({ _tag: "effect-search/Optimization" })).toBe(false)
      })
    ))
})
