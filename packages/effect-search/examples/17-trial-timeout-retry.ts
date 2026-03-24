/**
 * Trial Timeout + Retry — recover transient failures and cancel slow trials.
 *
 * Real use case: flaky external APIs with strict per-evaluation SLA limits.
 *
 * What this shows: combining retry schedules with per-trial timeouts and observing retry or cancellation events.
 *
 * Feature Type Links:
 * - {@link SearchSpace.Type}
 * - {@link Sampler.Sampler}
 * - {@link Study.StudyResult}
 *
 * Run: bun run examples/17-trial-timeout-retry.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Chunk, Effect, Match, Number as Num, Ref, Schedule, Stream } from "effect"

import { Sampler, SearchSpace, Study } from "effect-search"

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    mode: SearchSpace.categorical(["transient", "timeout"])
  })
  const attemptsRef = yield* Ref.make(0)

  const events = yield* Study.optimizeStream({
    space,
    sampler: Sampler.grid({ seed: 17 }),
    direction: "minimize",
    trials: 2,
    retrySchedule: Schedule.exponential("10 millis").pipe(Schedule.intersect(Schedule.recurs(2))),
    trialTimeout: "40 millis",
    objective: (config) =>
      Match.value(config.mode).pipe(
        Match.when("transient", () =>
          Ref.updateAndGet(attemptsRef, Num.increment).pipe(
            Effect.flatMap((attempt) =>
              attempt <= 2
                ? Effect.fail(`transient-${attempt}`)
                : Effect.succeed(0.25)
            )
          )),
        Match.when("timeout", () => Effect.sleep("120 millis").pipe(Effect.as(0.9))),
        Match.exhaustive
      )
  }).pipe(
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )
  const attempts = yield* Ref.get(attemptsRef)

  const retries = events.filter((event) => event._tag === "TrialRetried").length
  const cancelled = events.filter((event) => event._tag === "TrialCancelled").length
  const completed = events.filter((event) => event._tag === "TrialCompleted").length
  const completionReasons = events.flatMap((event) =>
    event._tag === "StudyCompleted"
      ? [event.completionReason]
      : []
  )

  yield* Effect.log("Timeout + retry stream complete", {
    attempts,
    retries,
    cancelled,
    completed,
    completionReason: completionReasons[0] ?? "none"
  })
})

BunRuntime.runMain(program)
