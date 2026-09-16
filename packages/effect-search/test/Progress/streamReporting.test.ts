import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Match, Number as Num, Option, Ref, Schema, Stream, String as Str } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"

import * as Optimization from "../../src/Optimization.js"
import * as Progress from "../../src/Progress.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(1), 1),
    y: SearchSpace.float(Num.negate(1), 1)
  })

const objectiveFromSpace = (space: SearchSpace.SearchSpace) => {
  const decode = Schema.decodeUnknownSync(space.schema)

  return (raw: unknown) => {
    const config = decode(raw)
    return Effect.succeed(
      Num.sum(Numeric.pow(Num.subtract(config.x, 0.3), 2), Numeric.pow(Num.sum(config.y, 0.1), 2))
    )
  }
}

const asSingleObjective = (result: Optimization.Result): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

const memorySink = Effect.gen(function*() {
  const stdout = yield* Ref.make(Arr.empty<string>())
  const stderr = yield* Ref.make(Arr.empty<string>())

  return {
    sink: Progress.makeSink({
      supportsAnsi: Effect.succeed(false),
      writeStdout: (line) => Ref.update(stdout, (lines) => Arr.append(lines, line)),
      writeStderr: (line) => Ref.update(stderr, (lines) => Arr.append(lines, line))
    }),
    stdout,
    stderr
  }
})

describe("terminal reporter stream composition", () => {
  it.effect("keeps stream event sequence unchanged while emitting terminal lines", () =>
    Effect.gen(function*() {
      const space = yield* makeSpace()
      const objective = objectiveFromSpace(space)
      const baselineEvents = yield* Stream.runCollect(
        Optimization.stream({
          space,
          sampler: Sampler.random({ seed: 343 }),
          direction: "minimize",
          trials: 5,
          objective
        })
      )
      const sinkCapture = yield* memorySink
      const instrumentedEvents = yield* Stream.runCollect(
        Optimization.stream({
          space,
          sampler: Sampler.random({ seed: 343 }),
          direction: "minimize",
          trials: 5,
          objective
        }).pipe(Progress.tap(sinkCapture.sink))
      )

      const baselineTags = Arr.map(Chunk.toReadonlyArray(baselineEvents), (event) => event._tag)
      const instrumentedTags = Arr.map(Chunk.toReadonlyArray(instrumentedEvents), (event) => event._tag)

      expect(instrumentedTags).toEqual(baselineTags)
      expect(Arr.last(instrumentedTags).pipe(Option.getOrElse(() => "missing"))).toBe("Completed")

      const stdoutLines = yield* Ref.get(sinkCapture.stdout)
      expect(Arr.length(stdoutLines)).toBeGreaterThan(0)
    }))

  it.effect("composes with resumeStream and emits completion output through the same reporter boundary", () =>
    Effect.gen(function*() {
      const space = yield* makeSpace()
      const objective = objectiveFromSpace(space)
      const initial = yield* Optimization.run({
        space,
        sampler: Sampler.random({ seed: 512 }),
        direction: "minimize",
        trials: 4,
        objective
      })
      const single = asSingleObjective(initial)

      expect(Option.isSome(single)).toBe(true)

      const snapshot = yield* Option.match(single, {
        onNone: () => Effect.dieMessage("expected a single-objective result"),
        onSome: (result: Optimization.SingleObjectiveResult) => Optimization.snapshot(result)
      })
      const sinkCapture = yield* memorySink
      const resumedEvents = yield* Stream.runCollect(
        Optimization.resumeStream({
          space,
          sampler: Sampler.random({ seed: 512 }),
          snapshot,
          direction: "minimize",
          trials: 2,
          objective
        }).pipe(Progress.tap(sinkCapture.sink))
      )

      const tags = Arr.map(Chunk.toReadonlyArray(resumedEvents), (event) => event._tag)
      expect(tags).toContain("Completed")
      expect(Arr.last(tags).pipe(Option.getOrElse(() => "missing"))).toBe("Completed")

      const stdoutLines = yield* Ref.get(sinkCapture.stdout)
      expect(Arr.some(stdoutLines, Str.includes("optimization completed reason="))).toBe(true)
    }))
})
