/**
 * Drives trial evaluation through `Optimization.ask` and `Optimization.tell`,
 * then reads a snapshot and final result from the same optimization handle.
 *
 * Run: bun run examples/25-ask-tell.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array as Arr, Effect, Iterable, Match, Number as Num } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Optimization, Sampler, SearchSpace } from "@scenesystems/effect-search"

const program = Effect.scoped(
  Effect.gen(function*() {
    const space = yield* SearchSpace.make({
      x: SearchSpace.float(-4, 4),
      y: SearchSpace.float(-4, 4),
      depth: SearchSpace.int(1, 4)
    })
    const objectiveValue = (config: SearchSpace.Type<typeof space>): number =>
      Num.sumAll(Arr.make(
        Numeric.pow(Num.subtract(config.x, 1.5), 2),
        Numeric.pow(Num.sum(config.y, 0.75), 2),
        Num.unsafeDivide(config.depth, 20)
      ))

    const evaluateReservedTrial = (handle: Optimization.Optimization<typeof space>) =>
      Optimization.ask(handle).pipe(
        Effect.tap((asked) => Optimization.tell(handle, asked.trialNumber, objectiveValue(asked.config)))
      )

    const handle = yield* Optimization.open({
      space,
      sampler: Sampler.random({ seed: 25 }),
      direction: "minimize",
      trials: 4,
      objective: (config) => Effect.succeed(objectiveValue(config))
    })

    const first = yield* evaluateReservedTrial(handle)
    const second = yield* evaluateReservedTrial(handle)

    const checkpoint = yield* Optimization.snapshot(handle)

    const third = yield* evaluateReservedTrial(handle)
    const fourth = yield* evaluateReservedTrial(handle)

    const summary = yield* Optimization.result(handle)

    yield* Match.value(summary).pipe(
      Match.tag(
        "SingleObjective",
        ({ bestTrial, completionReason, trials }) =>
          Effect.log("Ask/tell orchestration complete", {
            reservedTrialNumbers: Arr.make(
              first.trialNumber,
              second.trialNumber,
              third.trialNumber,
              fourth.trialNumber
            ),
            checkpointTrialCount: Arr.length(checkpoint.trials),
            checkpointNextTrial: checkpoint.nextTrialNumber,
            completionReason,
            bestValue: bestTrial.state.value,
            bestConfig: bestTrial.config,
            totalTrials: Iterable.size(trials)
          })
      ),
      Match.tag("MultiObjective", ({ paretoFront, completionReason }) =>
        Effect.log("Ask/tell orchestration complete", {
          checkpointTrialCount: Arr.length(checkpoint.trials),
          checkpointNextTrial: checkpoint.nextTrialNumber,
          completionReason,
          paretoFrontSize: Iterable.size(paretoFront)
        })),
      Match.exhaustive
    )
  })
)

BunRuntime.runMain(program)
