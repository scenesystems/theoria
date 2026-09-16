import { describe, expect, it } from "@effect/vitest"
import { Pareto, Sampler, SearchSpace, Study } from "@scenesystems/effect-search"
import { Array as Arr, Effect, Fiber, Match, Schema, Stream, String } from "effect"

const space = SearchSpace.make({ x: SearchSpace.float(0, 1) })

describe("integration/effect-search direct", () => {
  it.effect("runs deterministic seeded ask/tell through the public Study and Sampler modules", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const searchSpace = yield* space
        const handle = yield* Study.open({
          direction: "maximize",
          space: searchSpace,
          sampler: Sampler.tpe({ seed: 71, acquisition: "ei" }),
          trials: 2,
          objective: () => Effect.succeed(0),
          concurrency: 1
        })
        const eventFiber = yield* Stream.runCollect(Study.events(handle)).pipe(Effect.fork)
        const first = yield* Study.ask(handle)
        yield* Study.tell(handle, first.trialNumber, first.config.x)
        const second = yield* Study.ask(handle)
        yield* Study.tell(handle, second.trialNumber, second.config.x)
        const result = yield* Study.result(handle)
        const observed = Arr.fromIterable(yield* Fiber.join(eventFiber))

        expect(result.trials).toHaveLength(2)
        expect(
          Match.value(result).pipe(
            Match.tag("SingleObjective", () => true),
            Match.tag("MultiObjective", () => false),
            Match.exhaustive
          )
        ).toBe(true)
        expect(Arr.some(observed, (event) => String.Equivalence(event._tag, "StudyCompleted"))).toBe(true)
        expect(Schema.is(Schema.Finite)(first.config.x)).toBe(true)
      })
    ))

  it.effect("uses the public Pareto module for ranking and hypervolume", () =>
    Effect.gen(function*() {
      const vectors = Arr.make(Arr.make(1, 1), Arr.make(2, 0), Arr.make(0, 2), Arr.make(1.5, 1.5))
      const directions = yield* Schema.decodeUnknown(Schema.Array(Schema.Literal("maximize", "minimize")))(
        Arr.make("maximize", "maximize")
      )
      expect(Pareto.nonDominatedIndices(vectors, directions)).toEqual([1, 2, 3])
      expect(Pareto.nonDominatedRanks(vectors, directions)).toEqual([1, 0, 0, 0])
      expect(Pareto.hypervolume2d(vectors, Arr.make(0, 0), directions)).toBeGreaterThan(0)
    }))
})
