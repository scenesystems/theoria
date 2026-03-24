import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Option } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1),
    depth: SearchSpace.int(1, 3)
  })

const objective = (config: { readonly x: number; readonly depth: number }) => config.x + config.depth

const valueForTrial = (result: Study.StudyResult, trialNumber: number): Option.Option<number> =>
  Option.fromNullable(result.trials.find((trial) => trial.trialNumber === trialNumber)).pipe(
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

describe("Study ask-tell snapshot compatibility", () => {
  it.effect("emits snapshots that resume through existing snapshot codecs", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const space = makeSpace()
        const handle = yield* Study.open({
          space,
          sampler: Sampler.random({ seed: 333 }),
          direction: "minimize",
          trials: 2,
          objective: () => Effect.succeed(0)
        })

        const first = yield* Study.ask(handle)
        const firstValue = objective(first.config)
        yield* Study.tell(handle, first.trialNumber, firstValue)

        const second = yield* Study.ask(handle)
        const secondValue = objective(second.config)
        yield* Study.tell(handle, second.trialNumber, secondValue)

        const checkpoint = yield* Study.snapshot(handle)

        const resumed = yield* Study.resume({
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
