/**
 * Executes trials with bounded concurrency and records the highest observed
 * number of in-flight objectives.
 *
 * Run: bun run examples/21-parallel-evaluation.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match, Number as Num, Ref } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-2, 2),
    y: SearchSpace.float(-2, 2)
  })
  const activeRef = yield* Ref.make(0)
  const maxActiveRef = yield* Ref.make(0)

  const result = yield* Study.minimize({
    space,
    sampler: Sampler.random({ seed: 221 }),
    trials: 24,
    concurrency: 4,
    objective: (config) =>
      Effect.acquireUseRelease(
        Ref.updateAndGet(activeRef, Num.increment).pipe(
          Effect.tap((active) => Ref.update(maxActiveRef, (maxActive) => Num.max(maxActive, active)))
        ),
        () =>
          Effect.sleep("20 millis").pipe(
            Effect.as(
              Numeric.pow(config.x - 0.4, 2) + Numeric.pow(config.y + 0.2, 2)
            )
          ),
        () => Ref.update(activeRef, Num.decrement)
      )
  })
  const maxActive = yield* Ref.get(maxActiveRef)

  yield* Match.value(result).pipe(
    Match.tag(
      "SingleObjective",
      ({ bestTrial, completionReason, trials }) =>
        Effect.log("Parallel evaluation complete", {
          completionReason,
          trialsEvaluated: trials.length,
          maxActive,
          bestValue: bestTrial.state.value,
          bestConfig: bestTrial.config
        })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
