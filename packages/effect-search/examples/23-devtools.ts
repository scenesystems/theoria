/**
 * Supplies the Effect DevTools layer so optimization spans and fibers can be inspected
 * during an optimization run.
 *
 * Run: bun run examples/23-devtools.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Iterable, Match, Number as Num } from "effect"
import { DevTools } from "effect/devtools"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-5, 5)
  })

  const result = yield* Optimization.minimize(
    new Optimization.FlatOptions({
      space,
      sampler: Sampler.tpe(new Sampler.TpeOptions({ seed: 23 })),
      trials: 20,
      objective: (config) => Effect.succeed(Numeric.pow(Num.subtract(config.x, 1.5), 2))
    })
  )

  yield* Match.value(result).pipe(
    Match.tag(
      "SingleObjective",
      ({ bestTrial, completionReason, trials }) =>
        Effect.log("DevTools trace example complete", {
          completionReason,
          trialsEvaluated: Iterable.size(trials),
          bestValue: bestTrial.state.value,
          bestConfig: bestTrial.config
        })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program.pipe(Effect.provide(DevTools.layer())))
