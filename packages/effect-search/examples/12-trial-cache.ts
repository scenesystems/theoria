/**
 * Reuses objective results for repeated configurations through a scoped
 * `ObjectiveCache` and reports the number of actual evaluations.
 *
 * Run: bun run examples/12-trial-cache.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Iterable, Match, Number as Num, Ref, Tuple } from "effect"

import { ObjectiveCache, Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    choice: SearchSpace.categorical(Tuple.make("only"))
  })
  const objectiveCalls = yield* Ref.make(0)

  const cachedRuns = Effect.gen(function*() {
    const objective = () => Ref.updateAndGet(objectiveCalls, Num.increment)

    const first = yield* Optimization.minimize({
      space,
      sampler: Sampler.random({ seed: 31 }),
      trials: 4,
      concurrency: 1,
      objective
    })

    const second = yield* Optimization.minimize({
      space,
      sampler: Sampler.random({ seed: 31 }),
      trials: 4,
      concurrency: 1,
      objective
    })

    return { first, second }
  }).pipe(
    Effect.provide(ObjectiveCache.layerMemory(new ObjectiveCache.Options({ scope: "trial-cache-example" })))
  )

  const { first, second } = yield* cachedRuns
  const calls = yield* Ref.get(objectiveCalls)

  yield* Match.value(second).pipe(
    Match.tag("SingleObjective", ({ bestTrial, trials }) =>
      Effect.log("Trial cache complete", {
        firstRunTrials: Iterable.size(first.trials),
        secondRunTrials: Iterable.size(trials),
        objectiveCalls: calls,
        bestValue: bestTrial.state.value
      })),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
