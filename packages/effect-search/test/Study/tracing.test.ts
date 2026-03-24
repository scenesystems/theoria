import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, MutableRef, Schema, Stream, Tracer, Tuple } from "effect"

import { emptySuggestContext } from "../../src/Sampler/index.js"
import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1),
    depth: SearchSpace.int(1, 3)
  })

const objectiveValue = (space: SearchSpace.SearchSpace) => {
  const decode = Schema.decodeUnknownSync(space.schema)

  return (raw: unknown) => {
    const config = decode(raw)
    return Effect.succeed(Math.abs(config.x) + config.depth)
  }
}

const collectSpanNames = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<readonly [A, ReadonlyArray<string>], E, R> =>
  Effect.gen(function*() {
    const spanNamesRef = MutableRef.make<ReadonlyArray<string>>(Arr.empty())
    const baseTracer = yield* Effect.tracer
    const collectingTracer = Tracer.make({
      span: (name, parent, context, links, startTime, kind, options) => {
        MutableRef.update(spanNamesRef, (names) => Arr.append(names, name))
        return baseTracer.span(name, parent, context, links, startTime, kind, options)
      },
      context: (run, fiber) => baseTracer.context(run, fiber)
    })
    const result = yield* effect.pipe(
      Effect.withTracer(collectingTracer),
      Effect.withTracerEnabled(true)
    )

    return Tuple.make(result, MutableRef.get(spanNamesRef))
  })

describe("Study and Sampler tracing", () => {
  it.live("emits expected public and runtime span names", () =>
    Effect.gen(function*() {
      const captured = yield* collectSpanNames(
        Effect.gen(function*() {
          const space = makeSpace()
          const objective = objectiveValue(space)
          const optimizeResult = yield* Study.optimize({
            space,
            sampler: Sampler.random({ seed: 11 }),
            direction: "minimize",
            trials: 3,
            objective
          })
          const checkpoint = yield* Study.snapshot(optimizeResult)

          yield* Study.resume({
            space,
            sampler: Sampler.random({ seed: 11 }),
            snapshot: checkpoint,
            direction: "minimize",
            trials: 1,
            objective
          })
          yield* Stream.runDrain(
            Study.optimizeStream({
              space,
              sampler: Sampler.random({ seed: 21 }),
              direction: "minimize",
              trials: 1,
              objective
            })
          )
        })
      )
      const spanNames = captured[1]

      expect(spanNames).toContain("effect-search/Study.optimize")
      expect(spanNames).toContain("effect-search/Study.optimizeStream")
      expect(spanNames).toContain("effect-search/Study.resume")
      expect(spanNames).toContain("effect-search/Study.snapshot")
      expect(spanNames).toContain("effect-search/Study.restoreSnapshot")
      expect(spanNames).toContain("effect-search/Study.reserveTrial")
      expect(spanNames).toContain("effect-search/Study.executeReservedTrial")
    }))

  it.effect("emits tracing span for Sampler.suggest combinator", () =>
    Effect.gen(function*() {
      const captured = yield* collectSpanNames(
        Sampler.suggest(Sampler.random({ seed: 33 }), makeSpace(), emptySuggestContext())
      )

      expect(captured[1]).toContain("effect-search/Sampler.suggest")
    }))
})
