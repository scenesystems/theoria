/**
 * DevTools Tracing — inspect optimization spans and fibers in real time.
 *
 * Real use case: diagnose orchestration and sampler behavior under load.
 *
 * What this shows: wiring DevTools so Study spans and fibers are visible while the run executes.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/23-devtools.ts
 */
import * as DevTools from "@effect/experimental/DevTools"
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-5, 5)
  })

  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 23 }),
    trials: 20,
    objective: (config) => Effect.succeed((config.x - 1.5) ** 2)
  })

  yield* Match.value(result).pipe(
    Match.tag(
      "SingleObjective",
      ({ bestTrial, completionReason, trials }) =>
        Effect.log("DevTools trace example complete", {
          completionReason,
          trialsEvaluated: trials.length,
          bestValue: bestTrial.state.value,
          bestConfig: bestTrial.config
        })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program.pipe(Effect.provide(DevTools.layer())))
