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

const score = (config: { readonly x: number; readonly depth: number }) => Num.sum(config.x, config.depth)

const asSingleObjective = (
  result: Optimization.Result
): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

describe("Optimization ask-tell basic", () => {
  it.effect("supports deterministic ask -> tell accumulation and returns Result contracts", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const space = yield* makeSpace()
        const handle = yield* Optimization.open({
          space,
          sampler: Sampler.random({ seed: 111 }),
          direction: "minimize",
          trials: 3,
          objective: () => Effect.succeed(0)
        })

        const first = yield* Optimization.ask(handle)
        yield* Optimization.tell(handle, first.trialNumber, score(first.config))

        const second = yield* Optimization.ask(handle)
        yield* Optimization.tell(handle, second.trialNumber, score(second.config))

        const third = yield* Optimization.ask(handle)
        yield* Optimization.tell(handle, third.trialNumber, score(third.config))

        const result = yield* Optimization.result(handle)

        expect(result._tag).toBe("SingleObjective")
        const single = yield* asSingleObjective(result)

        expect(single.trials).toHaveLength(3)
        expect(Arr.map(Arr.fromIterable(single.trials), (trial) => trial.trialNumber)).toEqual(Arr.make(0, 1, 2))

        const completedValues = Arr.flatMap(Arr.fromIterable(single.trials), (trial) =>
          Match.value(trial.state).pipe(
            Match.tag("Completed", ({ value }) => Arr.of(value)),
            Match.orElse(Arr.empty)
          ))

        expect(completedValues).toHaveLength(3)
        expect(single.bestTrial.trialNumber).toBeGreaterThanOrEqual(0)
      })
    ))
})
