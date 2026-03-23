import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Option, Ref, Schema, Stream } from "effect"

import * as Sampler from "../../../src/Sampler/index.js"
import * as SearchSpace from "../../../src/SearchSpace/index.js"
import * as Study from "../../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1),
    y: SearchSpace.float(-1, 1)
  })

const objectiveFromSpace = (space: SearchSpace.SearchSpace) => {
  const decode = Schema.decodeUnknownSync(space.schema)

  return (raw: unknown) => {
    const config = decode(raw)
    return Effect.succeed((config.x - 0.3) ** 2 + (config.y + 0.1) ** 2)
  }
}

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective"
    ? Option.some(result)
    : Option.none()

const memorySink = Effect.gen(function*() {
  const stdout = yield* Ref.make<ReadonlyArray<string>>([])
  const stderr = yield* Ref.make<ReadonlyArray<string>>([])

  return {
    sink: Study.makeTerminalSink({
      supportsAnsi: Effect.succeed(false),
      writeStdout: (line) => Ref.update(stdout, (lines) => Arr.append(lines, line)),
      writeStderr: (line) => Ref.update(stderr, (lines) => Arr.append(lines, line))
    }),
    stdout,
    stderr
  }
})

describe("terminal reporter stream composition", () => {
  it.effect("keeps optimizeStream event sequence unchanged while emitting terminal lines", () =>
    Effect.gen(function*() {
      const space = makeSpace()
      const objective = objectiveFromSpace(space)
      const baselineEvents = yield* Stream.runCollect(
        Study.optimizeStream({
          space,
          sampler: Sampler.random({ seed: 343 }),
          direction: "minimize",
          trials: 5,
          objective
        })
      )
      const sinkCapture = yield* memorySink
      const instrumentedEvents = yield* Stream.runCollect(
        Study.optimizeStream({
          space,
          sampler: Sampler.random({ seed: 343 }),
          direction: "minimize",
          trials: 5,
          objective
        }).pipe(Study.tapTerminalProgress({ sink: sinkCapture.sink }))
      )

      const baselineTags = Chunk.toReadonlyArray(baselineEvents).map((event) => event._tag)
      const instrumentedTags = Chunk.toReadonlyArray(instrumentedEvents).map((event) => event._tag)

      expect(instrumentedTags).toEqual(baselineTags)
      expect(instrumentedTags[instrumentedTags.length - 1]).toBe("StudyCompleted")

      const stdoutLines = yield* Ref.get(sinkCapture.stdout)
      expect(stdoutLines.length).toBeGreaterThan(0)
    }))

  it.effect("composes with resumeStream and emits completion output through the same reporter boundary", () =>
    Effect.gen(function*() {
      const space = makeSpace()
      const objective = objectiveFromSpace(space)
      const initial = yield* Study.optimize({
        space,
        sampler: Sampler.random({ seed: 512 }),
        direction: "minimize",
        trials: 4,
        objective
      })
      const single = asSingleObjective(initial)

      expect(Option.isSome(single)).toBe(true)

      if (Option.isNone(single)) {
        return
      }

      const snapshot = yield* Study.snapshot(single.value)
      const sinkCapture = yield* memorySink
      const resumedEvents = yield* Stream.runCollect(
        Study.resumeStream({
          space,
          sampler: Sampler.random({ seed: 512 }),
          snapshot,
          direction: "minimize",
          trials: 2,
          objective
        }).pipe(Study.tapTerminalProgress({ sink: sinkCapture.sink }))
      )

      const tags = Chunk.toReadonlyArray(resumedEvents).map((event) => event._tag)
      expect(tags).toContain("StudyCompleted")
      expect(tags[tags.length - 1]).toBe("StudyCompleted")

      const stdoutLines = yield* Ref.get(sinkCapture.stdout)
      expect(stdoutLines.some((line) => line.includes("study completed reason="))).toBe(true)
    }))
})
