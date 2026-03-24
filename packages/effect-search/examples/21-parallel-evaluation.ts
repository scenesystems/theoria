/**
 * Parallel Evaluation — run multiple trials concurrently with bounded workers.
 *
 * Real use case: saturate available compute while keeping study semantics safe.
 *
 * What this shows: bounded parallel trial execution and measuring in-flight worker concurrency.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/21-parallel-evaluation.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Match, Number as Num, Ref } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

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
        () => Effect.sleep("20 millis").pipe(Effect.as((config.x - 0.4) ** 2 + (config.y + 0.2) ** 2)),
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
