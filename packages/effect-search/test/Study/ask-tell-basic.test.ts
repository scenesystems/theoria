import { describe, expect, it } from "@effect/vitest"
import { Effect, Match } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1),
    depth: SearchSpace.int(1, 3)
  })

const score = (config: { readonly x: number; readonly depth: number }) => config.x + config.depth

describe("Study ask-tell basic", () => {
  it.effect("supports deterministic ask -> tell accumulation and returns StudyResult contracts", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const space = makeSpace()
        const handle = yield* Study.open({
          space,
          sampler: Sampler.random({ seed: 111 }),
          direction: "minimize",
          trials: 3,
          objective: () => Effect.succeed(0)
        })

        const first = yield* Study.ask(handle)
        yield* Study.tell(handle, first.trialNumber, score(first.config))

        const second = yield* Study.ask(handle)
        yield* Study.tell(handle, second.trialNumber, score(second.config))

        const third = yield* Study.ask(handle)
        yield* Study.tell(handle, third.trialNumber, score(third.config))

        const result = yield* Study.result(handle)

        expect(result._tag).toBe("SingleObjective")

        if (result._tag !== "SingleObjective") {
          return
        }

        expect(result.trials).toHaveLength(3)
        expect(result.trials.map((trial) => trial.trialNumber)).toEqual([0, 1, 2])

        const completedValues = result.trials.flatMap((trial) =>
          Match.value(trial.state).pipe(
            Match.tag("Completed", ({ value }) => [value]),
            Match.orElse(() => [])
          )
        )

        expect(completedValues).toHaveLength(3)
        expect(result.bestTrial.trialNumber).toBeGreaterThanOrEqual(0)
      })
    ))
})
