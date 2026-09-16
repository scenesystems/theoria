import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as Num, Option } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(1), 1),
    depth: SearchSpace.int(1, 3)
  })

const objective = (config: { readonly x: number; readonly depth: number }) => Num.sum(config.x, config.depth)

const valueForTrial = (result: Optimization.Result, trialNumber: number): Option.Option<number> =>
  Arr.findFirst(result.trials, (trial) => Num.Equivalence(trial.trialNumber, trialNumber)).pipe(
    Option.flatMap((trial) =>
      Match.value(trial.state).pipe(
        Match.tag("Completed", ({ value }) =>
          Match.value(value).pipe(
            Match.when(Match.number, (resolved) => Option.some(resolved)),
            Match.orElse(() => Option.none())
          )),
        Match.orElse(() => Option.none())
      )
    )
  )

describe("Optimization ask-tell snapshot compatibility", () => {
  it.effect("emits snapshots that resume through existing snapshot codecs", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const space = yield* makeSpace()
        const handle = yield* Optimization.open({
          space,
          sampler: Sampler.random({ seed: 333 }),
          direction: "minimize",
          trials: 2,
          objective: () => Effect.succeed(0)
        })

        const first = yield* Optimization.ask(handle)
        const firstValue = objective(first.config)
        yield* Optimization.tell(handle, first.trialNumber, firstValue)

        const second = yield* Optimization.ask(handle)
        const secondValue = objective(second.config)
        yield* Optimization.tell(handle, second.trialNumber, secondValue)

        const checkpoint = yield* Optimization.snapshot(handle)

        const resumed = yield* Optimization.resume({
          space,
          sampler: Sampler.random({ seed: 333 }),
          snapshot: checkpoint,
          direction: "minimize",
          trials: 1,
          objective: (config) => Effect.succeed(objective(config))
        })

        const firstRecovered = valueForTrial(resumed, first.trialNumber)
        const secondRecovered = valueForTrial(resumed, second.trialNumber)

        expect(Option.getOrElse(firstRecovered, () => Number.NaN)).toBe(firstValue)
        expect(Option.getOrElse(secondRecovered, () => Number.NaN)).toBe(secondValue)
      })
    ))
})
