import { expect, it } from "@effect/vitest"
import { Effect, Either } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

it.effect("rejects reservations after the manual handle's scope closes", () =>
  Effect.gen(function*() {
    const space = yield* SearchSpace.make({ x: SearchSpace.float(0, 1) })
    const handle = yield* Optimization.open({
      space,
      sampler: Sampler.random({ seed: 5 }),
      direction: "minimize",
      trials: 2,
      objective: () => Effect.succeed(0)
    }).pipe(Effect.scoped)

    const outcome = yield* Optimization.ask(handle).pipe(Effect.either)
    const error = yield* Either.getLeft(outcome)
    expect(error._tag).toBe("effect-search/InvalidOptimizationConfig")
  }))
