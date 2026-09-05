/**
 * Combines a retry schedule with per-trial timeouts and inspects retry and
 * cancellation events from the optimization stream.
 *
 * Run: bun run examples/17-trial-timeout-retry.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Chunk, Data, Effect, Match, Number as Num, Ref, Schedule, Stream } from "effect"

import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

class TransientFailure extends Data.TaggedError("TransientFailure")<{
  readonly attempt: number
}> {}

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
                ? Effect.fail(new TransientFailure({ attempt }))
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
