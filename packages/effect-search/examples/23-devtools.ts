/**
 * Supplies the Effect DevTools layer so study spans and fibers can be inspected
 * during an optimization run.
 *
 * Run: bun run examples/23-devtools.ts
 */
import * as DevTools from "@effect/experimental/DevTools"
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-5, 5)
  })

  const result = yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 23 }),
    trials: 20,
    objective: (config) => Effect.succeed(Numeric.pow(config.x - 1.5, 2))
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
