/**
 * Ask/Tell Manual Orchestration — drive trial execution outside Study.optimize.
 *
 * Real use case: external workers evaluate configs while the Study handle owns state transitions.
 *
 * What this shows: `Study.open`, `Study.ask`, `Study.tell`, `Study.snapshot`, and `Study.result`
 * in a deterministic manual loop using only public APIs.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Study.StudyHandle}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/25-ask-tell.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const objectiveValue = (config: {
  readonly x: number
  readonly y: number
  readonly depth: number
}): number => (config.x - 1.5) ** 2 + (config.y + 0.75) ** 2 + config.depth / 20

const program = Effect.scoped(
  Effect.gen(function*() {
    const space = yield* SearchSpace.make({
      x: SearchSpace.float(-4, 4),
      y: SearchSpace.float(-4, 4),
      depth: SearchSpace.int(1, 4)
    })

    const evaluateReservedTrial = (handle: Study.StudyHandle<typeof space>) =>
      Study.ask(handle).pipe(
        Effect.tap((asked) => Study.tell(handle, asked.trialNumber, objectiveValue(asked.config)))
      )

    const handle = yield* Study.open({
      space,
      sampler: Sampler.random({ seed: 25 }),
      direction: "minimize",
      trials: 4,
      objective: (config) => Effect.succeed(objectiveValue(config))
    })

    const first = yield* evaluateReservedTrial(handle)
    const second = yield* evaluateReservedTrial(handle)

    const checkpoint = yield* Study.snapshot(handle)

    const third = yield* evaluateReservedTrial(handle)
    const fourth = yield* evaluateReservedTrial(handle)

    const summary = yield* Study.result(handle)

    yield* Match.value(summary).pipe(
      Match.tag(
        "SingleObjective",
        ({ bestTrial, completionReason, trials }) =>
          Effect.log("Ask/tell orchestration complete", {
            reservedTrialNumbers: [first.trialNumber, second.trialNumber, third.trialNumber, fourth.trialNumber],
            checkpointTrialCount: checkpoint.trials.length,
            checkpointNextTrial: checkpoint.nextTrialNumber,
            completionReason,
            bestValue: bestTrial.state.value,
            bestConfig: bestTrial.config,
            totalTrials: trials.length
          })
      ),
      Match.tag("MultiObjective", ({ paretoFront, completionReason }) =>
        Effect.log("Ask/tell orchestration complete", {
          checkpointTrialCount: checkpoint.trials.length,
          checkpointNextTrial: checkpoint.nextTrialNumber,
          completionReason,
          paretoFrontSize: paretoFront.length
        })),
      Match.exhaustive
    )
  })
)

BunRuntime.runMain(program)
