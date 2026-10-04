import { expect, it } from "@effect/vitest"
import { Effect, Result } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

it.effect("rejects reservations after the manual handle's scope closes", () =>
  Effect.gen(function*() {
    const space = yield* SearchSpace.make({ x: SearchSpace.float(0, 1) })
    const handle = yield* Optimization.open(
      new Optimization.FlatOptions({
        space,
        sampler: Sampler.random({ seed: 5 }),
        direction: "minimize",
        trials: 2,
        objective: () => Effect.succeed(0)
      })
    ).pipe(Effect.scoped)

    const outcome = yield* Optimization.ask(handle).pipe(Effect.result)
    const error = yield* Effect.fromOption(Result.getFailure(outcome))
    expect(error._tag).toBe("effect-search/InvalidOptimizationConfig")
  }))
