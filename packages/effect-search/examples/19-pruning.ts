/**
 * Pruning — stop underperforming trials using intermediate reports.
 *
 * Real use case: cut expensive model runs early when loss is already too high.
 *
 * What this shows: reporting intermediate metrics and pruning weak trials early to save compute.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/19-pruning.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Chunk, Effect, Match, Stream } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-2, 2)
  })
  const pruningPolicy = Study.thresholdPruningPolicy(3.5, "minimize", 2)

  const objective = (
    config: SearchSpace.Type<typeof space>,
    runtime: Study.ObjectiveTrialRuntime
  ) =>
    Effect.iterate(
      { step: 0, stopped: false, value: 0 },
      {
        while: ({ step, stopped }) => step < 6 && !stopped,
        body: ({ step }) => {
          const rawLoss = Math.abs(config.x - 0.6) * 8 + 1
          const nextValue = rawLoss / (step + 1)

          return runtime.report(step, nextValue).pipe(
            Effect.map((decision) =>
              Match.value(decision).pipe(
                Match.tag("Prune", () => ({ step: 6, stopped: true, value: nextValue })),
                Match.tag("Continue", () => ({ step: step + 1, stopped: false, value: nextValue })),
                Match.exhaustive
              )
            )
          )
        }
      }
    ).pipe(Effect.map(({ value }) => value))

  const events = yield* Study.optimizeStream({
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

  const prunedTrials = events.filter((event) => event._tag === "TrialPruned").length
  const completedTrials = events.filter((event) => event._tag === "TrialCompleted").length
  const reportedSteps = events.filter((event) => event._tag === "TrialReported").length

  yield* Effect.log("Pruning stream complete", {
    prunedTrials,
    completedTrials,
    reportedSteps
  })
})

BunRuntime.runMain(program)
