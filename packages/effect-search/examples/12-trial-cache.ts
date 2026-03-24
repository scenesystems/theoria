/**
 * Study Objective Cache — deduplicate objective evaluations by scoped config keys.
 *
 * Real use case: avoid re-running expensive objectives across repeated studies.
 *
 * What this shows: deduplicating repeated configs with StudyObjectiveCache so expensive objectives are not rerun.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/12-trial-cache.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match, Number as Num, Ref } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    choice: SearchSpace.categorical(["only"])
  })
  const objectiveCalls = yield* Ref.make(0)

  const cachedRuns = Effect.gen(function*() {
    const objective = () => Ref.updateAndGet(objectiveCalls, Num.increment)

    const first = yield* Study.minimize({
      space,
      sampler: Sampler.random({ seed: 31 }),
      trials: 4,
      concurrency: 1,
      objective
    })

    const second = yield* Study.minimize({
      space,
      sampler: Sampler.random({ seed: 31 }),
      trials: 4,
      concurrency: 1,
      objective
    })

    return { first, second }
  }).pipe(Effect.provide(Study.StudyObjectiveCacheMemory(Study.studyObjectiveCacheOptions("m344-example-cache"))))

  const { first, second } = yield* cachedRuns
  const calls = yield* Ref.get(objectiveCalls)

  yield* Match.value(second).pipe(
    Match.tag("SingleObjective", ({ bestTrial, trials }) =>
      Effect.log("Trial cache complete", {
        firstRunTrials: first.trials.length,
        secondRunTrials: trials.length,
        objectiveCalls: calls,
        bestValue: bestTrial.state.value
      })),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
