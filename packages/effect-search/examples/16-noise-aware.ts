/**
 * Evaluates each trial three times and uses noise-aware TPE to model the
 * resulting variance.
 *
 * Run: bun run examples/16-noise-aware.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Iterable, Match, Number as Num, Ref } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    learningRate: SearchSpace.float(1e-4, 1e-1, { scale: "log" }),
    dropout: SearchSpace.float(0, 0.4)
  })
  const objectiveCallsRef = yield* Ref.make(0)

  const noisyObjective = (config: SearchSpace.Type<typeof space>) =>
    Ref.updateAndGet(objectiveCallsRef, Num.increment).pipe(
      Effect.map((callIndex) => {
        const stableTerm = Num.sum(
          Numeric.pow(Num.subtract(config.learningRate, 0.03), 2),
          Numeric.pow(Num.subtract(config.dropout, 0.15), 2)
        )
        const deterministicNoise = Num.sumAll(Arr.make(
          Num.multiply(Numeric.sin(Num.multiply(callIndex, 0.7)), 0.05),
          Num.multiply(Numeric.cos(Num.multiply(callIndex, 0.3)), 0.03)
        ))

        return Num.sum(stableTerm, deterministicNoise)
      })
    )

  const result = yield* Optimization.minimize({
    space,
    sampler: Sampler.tpe({
      seed: 117,
      noiseAware: true,
      noiseAlpha: 2
    }),
    trials: 40,
    evaluationsPerTrial: 3,
    objective: noisyObjective
  })
  const objectiveCalls = yield* Ref.get(objectiveCallsRef)

  yield* Match.value(result).pipe(
    Match.tag(
      "SingleObjective",
      ({ bestTrial, completionReason, trials }) =>
        Effect.log("Noise-aware optimization complete", {
          completionReason,
          trialsEvaluated: Iterable.size(trials),
          objectiveCalls,
          bestValue: bestTrial.state.value,
          bestConfig: bestTrial.config,
          varianceEstimate: bestTrial.state.variance
        })
    ),
    Match.tag("MultiObjective", () => Effect.void),
    Match.exhaustive
  )
})

BunRuntime.runMain(program)
