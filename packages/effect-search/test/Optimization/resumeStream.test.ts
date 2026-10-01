import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Either, Match, Number as Num, Option, Schema, Stream } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import { InvalidOptimizationConfig } from "../../src/SearchError.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(1), 1),
    depth: SearchSpace.int(1, 3)
  })

const makeIncompatibleSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(1), 1),
    width: SearchSpace.int(1, 3)
  })

const objectiveFromSpace = (space: SearchSpace.SearchSpace) => {
  const decode = Schema.decodeUnknownSync(space.schema)

  return (raw: unknown) => {
    const config = decode(raw)
    return Effect.succeed(Num.sum(config.x, config.depth))
  }
}

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

describe("Optimization.resumeStream", () => {
  it.effect("streams resumed lifecycle events and completes with Completed", () =>
    Effect.gen(function*() {
      const space = yield* makeSpace()
      const objective = objectiveFromSpace(space)
      const baseline = yield* Optimization.run({
        space,
        sampler: Sampler.random({ seed: 908 }),
        direction: "minimize",
        trials: 4,
        objective
      })
      const single = yield* asSingleObjective(baseline)

      const snapshot = yield* Optimization.snapshot(single)
      const eventsChunk = yield* Stream.runCollect(
        Optimization.resumeStream({
          space,
          sampler: Sampler.random({ seed: 908 }),
          snapshot,
          direction: "minimize",
          trials: 2,
          objective
        })
      )
      const events = Chunk.toReadonlyArray(eventsChunk)
      const tags = Arr.map(events, (event) => event._tag)

      expect(tags).toContain("TrialStarted")
      expect(tags).toContain("Completed")
      expect(Arr.last(tags)).toEqual(Option.some("Completed"))
    }))

  it.effect("preserves resume snapshot validation failures", () =>
    Effect.gen(function*() {
      const space = yield* makeSpace()
      const objective = objectiveFromSpace(space)
      const baseline = yield* Optimization.run({
        space,
        sampler: Sampler.random({ seed: 321 }),
        direction: "minimize",
        trials: 3,
        objective
      })
      const single = yield* asSingleObjective(baseline)

      const snapshot = yield* Optimization.snapshot(single)
      const resumed = yield* Effect.either(
        Stream.runCollect(
          Optimization.resumeStream({
            space: yield* makeIncompatibleSpace(),
            sampler: Sampler.random({ seed: 321 }),
            snapshot,
            direction: "minimize",
            trials: 2,
            objective: objectiveFromSpace(yield* makeIncompatibleSpace())
          })
        )
      )

      const failure = Either.getOrThrow(Either.flip(resumed))
      expect(failure).toBeInstanceOf(InvalidOptimizationConfig)
      expect(failure._tag).toBe("effect-search/InvalidOptimizationConfig")
    }))
})
