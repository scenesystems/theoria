import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Either, Schema, Stream } from "effect"

import { InvalidStudyConfig } from "../../src/Errors/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1),
    depth: SearchSpace.int(1, 3)
  })

const makeIncompatibleSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1),
    width: SearchSpace.int(1, 3)
  })

const objectiveFromSpace = (space: SearchSpace.SearchSpace) => {
  const decode = Schema.decodeUnknownSync(space.schema)

  return (raw: unknown) => {
    const config = decode(raw)
    return Effect.succeed(config.x + config.depth)
  }
}

const asSingleObjective = (result: Study.StudyResult) => result._tag === "SingleObjective" ? result : undefined

describe("Study.resumeStream", () => {
  it.effect("streams resumed lifecycle events and completes with StudyCompleted", () =>
    Effect.gen(function*() {
      const space = makeSpace()
      const objective = objectiveFromSpace(space)
      const baseline = yield* Study.optimize({
        space,
        sampler: Sampler.random({ seed: 908 }),
        direction: "minimize",
        trials: 4,
        objective
      })
      const single = asSingleObjective(baseline)
      expect(single).toBeDefined()

      if (!single) {
        return
      }

      const snapshot = yield* Study.snapshot(single)
      const eventsChunk = yield* Stream.runCollect(
        Study.resumeStream({
          space,
          sampler: Sampler.random({ seed: 908 }),
          snapshot,
          direction: "minimize",
          trials: 2,
          objective
        })
      )
      const events = Chunk.toReadonlyArray(eventsChunk)
      const tags = events.map((event) => event._tag)

      expect(tags).toContain("TrialStarted")
      expect(tags).toContain("StudyCompleted")
      expect(tags[tags.length - 1]).toBe("StudyCompleted")
    }))

  it.effect("preserves resume snapshot validation failures", () =>
    Effect.gen(function*() {
      const space = makeSpace()
      const objective = objectiveFromSpace(space)
      const baseline = yield* Study.optimize({
        space,
        sampler: Sampler.random({ seed: 321 }),
        direction: "minimize",
        trials: 3,
        objective
      })
      const single = asSingleObjective(baseline)
      expect(single).toBeDefined()

      if (!single) {
        return
      }

      const snapshot = yield* Study.snapshot(single)
      const resumed = yield* Effect.either(
        Stream.runCollect(
          Study.resumeStream({
            space: makeIncompatibleSpace(),
            sampler: Sampler.random({ seed: 321 }),
            snapshot,
            direction: "minimize",
            trials: 2,
            objective: objectiveFromSpace(makeIncompatibleSpace())
          })
        )
      )

      expect(Either.isLeft(resumed)).toBe(true)

      if (Either.isRight(resumed)) {
        return
      }

      expect(resumed.left).toBeInstanceOf(InvalidStudyConfig)
      expect(resumed.left._tag).toBe("effect-search/InvalidStudyConfig")
    }))
})
