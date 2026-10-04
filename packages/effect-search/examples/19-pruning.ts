/**
 * Reports intermediate loss values and prunes trials that cross the configured
 * threshold after the warm-up steps.
 *
 * Run: bun run examples/19-pruning.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Match, Number as Num, Stream } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, OptimizationEvent, Pruning, Sampler, SearchSpace } from "@scenesystems/effect-search"
import type { InvalidObjectiveReport } from "@scenesystems/effect-search/SearchError"
import type { Failure } from "@scenesystems/effect-study/Journal"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-2, 2)
  })
  const pruningPolicy = Pruning.threshold(3.5, "minimize", 2)

  const objective = (
    config: SearchSpace.Type<typeof space>,
    runtime: Pruning.Runtime
  ): Effect.Effect<number, InvalidObjectiveReport | Failure> => {
    const evaluateStep = (step: number): Effect.Effect<number, InvalidObjectiveReport | Failure> => {
      const rawLoss = Num.sum(Num.multiply(Numeric.abs(Num.subtract(config.x, 0.6)), 8), 1)
      const nextValue = Num.divideUnsafe(rawLoss, Num.increment(step))

      return runtime.report(step, nextValue).pipe(
        Effect.flatMap((decision) =>
          Match.value(decision).pipe(
            Match.tag("Prune", () => Effect.succeed(nextValue)),
            Match.tag("Continue", () =>
              Num.isLessThan(Num.increment(step), 6) ? evaluateStep(Num.increment(step)) : Effect.succeed(nextValue)),
            Match.exhaustive
          )
        )
      )
    }

    return evaluateStep(0)
  }

  const events = yield* Optimization.stream(
    new Optimization.FlatOptions({
      space,
      sampler: Sampler.tpe(new Sampler.TpeOptions({ seed: 90 })),
      direction: "minimize",
      trials: 24,
      pruningPolicy,
      objective
    })
  ).pipe(
    Stream.runCollect
  )

  const prunedTrials = Arr.length(Arr.filter(events, OptimizationEvent.is("TrialPruned")))
  const completedTrials = Arr.length(Arr.filter(events, OptimizationEvent.is("TrialCompleted")))
  const reportedSteps = Arr.length(Arr.filter(events, OptimizationEvent.is("TrialReported")))

  yield* Effect.log("Pruning stream complete", {
    prunedTrials,
    completedTrials,
    reportedSteps
  })
})

BunRuntime.runMain(program)
