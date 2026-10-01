/**
 * Reports intermediate loss values and prunes trials that cross the configured
 * threshold after the warm-up steps.
 *
 * Run: bun run examples/19-pruning.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Boolean as Bool, Chunk, Effect, Match, Number as Num, Stream } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, OptimizationEvent, Pruning, Sampler, SearchSpace } from "@scenesystems/effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-2, 2)
  })
  const pruningPolicy = Pruning.threshold(3.5, "minimize", 2)

  const objective = (
    config: SearchSpace.Type<typeof space>,
    runtime: Pruning.Runtime
  ) =>
    Effect.iterate(
      { step: 0, stopped: false, value: 0 },
      {
        while: ({ step, stopped }) => Bool.and(Num.lessThan(step, 6), Bool.not(stopped)),
        body: ({ step }) => {
          const rawLoss = Num.sum(Num.multiply(Numeric.abs(Num.subtract(config.x, 0.6)), 8), 1)
          const nextValue = Num.unsafeDivide(rawLoss, Num.increment(step))

          return runtime.report(step, nextValue).pipe(
            Effect.map((decision) =>
              Match.value(decision).pipe(
                Match.tag("Prune", () => ({ step: 6, stopped: true, value: nextValue })),
                Match.tag("Continue", () => ({ step: Num.increment(step), stopped: false, value: nextValue })),
                Match.exhaustive
              )
            )
          )
        }
      }
    ).pipe(Effect.map(({ value }) => value))

  const events = yield* Optimization.stream({
    space,
    sampler: Sampler.tpe({ seed: 90 }),
    direction: "minimize",
    trials: 24,
    pruningPolicy,
    objective
  }).pipe(
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
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
