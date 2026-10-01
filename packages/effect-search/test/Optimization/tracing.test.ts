import { describe, expect, it } from "@effect/vitest"
import { abs } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Chunk, Effect, MutableRef, Number as Num, Schema, Stream, Tracer, Tuple } from "effect"

import * as Optimization from "../../src/Optimization.js"
import { emptyContext } from "../../src/Sampler.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(1), 1),
    depth: SearchSpace.int(1, 3)
  })

const objectiveValue = <Space extends SearchSpace.SearchSpace>(space: Space) => {
  const decode = Schema.decodeUnknownSync(space.schema)

  return (raw: unknown) => {
    const config = decode(raw)
    return Effect.succeed(Num.sum(abs(config.x), config.depth))
  }
}

const collectSpanNames = <A, E, R>(
  effect: Effect.Effect<A, E, R>
) =>
  Effect.gen(function*() {
    const spanNamesRef = MutableRef.make(Chunk.empty<string>())
    const baseTracer = yield* Effect.tracer
    const collectingTracer = Tracer.make({
      span: (name, parent, context, links, startTime, kind, options) => {
        MutableRef.update(spanNamesRef, (names) => Chunk.append(names, name))
        return baseTracer.span(name, parent, context, links, startTime, kind, options)
      },
      context: (run, fiber) => baseTracer.context(run, fiber)
    })
    const result = yield* effect.pipe(
      Effect.withTracer(collectingTracer),
      Effect.withTracerEnabled(true)
    )

    return Tuple.make(result, Arr.fromIterable(MutableRef.get(spanNamesRef)))
  })

describe("Optimization and Sampler tracing", () => {
  it.live("emits expected public and runtime span names", () =>
    Effect.gen(function*() {
      const captured = yield* collectSpanNames(
        Effect.gen(function*() {
          const space = yield* makeSpace()
          const objective = objectiveValue(space)
          const optimizeResult = yield* Optimization.run({
            space,
            sampler: Sampler.random({ seed: 11 }),
            direction: "minimize",
            trials: 3,
            objective
          })
          const checkpoint = yield* Optimization.snapshot(optimizeResult)

          yield* Optimization.resume({
            space,
            sampler: Sampler.random({ seed: 11 }),
            snapshot: checkpoint,
            direction: "minimize",
            trials: 1,
            objective
          })
          yield* Stream.runDrain(
            Optimization.stream({
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

      expect(spanNames).toContain("effect-search/Optimization.run")
      expect(spanNames).toContain("effect-search/Optimization.stream")
      expect(spanNames).toContain("effect-search/Optimization.resume")
      expect(spanNames).toContain("effect-search/Optimization.snapshot")
      expect(spanNames).toContain("effect-search/OptimizationSnapshot.restore")
      expect(spanNames).toContain("effect-search/Optimization.reserveTrial")
      expect(spanNames).toContain("effect-search/Optimization.executeReservedTrial")
    }))

  it.effect("emits tracing span for Sampler.suggest combinator", () =>
    Effect.gen(function*() {
      const captured = yield* collectSpanNames(
        Sampler.suggest(Sampler.random({ seed: 33 }), yield* makeSpace(), emptyContext())
      )

      expect(captured[1]).toContain("effect-search/Sampler.suggest")
    }))
})
