/**
 * Combines a retry schedule with per-trial timeouts and inspects retry and
 * cancellation events from the optimization stream.
 *
 * Run: bun run examples/17-trial-timeout-retry.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import {
  Array as Arr,
  Boolean as Bool,
  Chunk,
  Data,
  Effect,
  Match,
  Number as Num,
  Option,
  Ref,
  Schedule,
  Stream,
  Tuple
} from "effect"

import { Optimization, OptimizationEvent, Sampler, SearchSpace } from "@scenesystems/effect-search"

class TransientFailure extends Data.TaggedError("TransientFailure")<{
  readonly attempt: number
}> {}

const program = Effect.gen(function*() {
  const space = yield* SearchSpace.make({
    mode: SearchSpace.categorical(Tuple.make<["transient", "timeout"]>("transient", "timeout"))
  })
  const attemptsRef = yield* Ref.make(0)

  const events = yield* Optimization.stream({
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
              Bool.match(Num.lessThanOrEqualTo(attempt, 2), {
                onFalse: () => Effect.succeed(0.25),
                onTrue: () => Effect.fail(new TransientFailure({ attempt }))
              })
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

  const retries = Arr.length(Arr.filter(events, OptimizationEvent.is("TrialRetried")))
  const cancelled = Arr.length(Arr.filter(events, OptimizationEvent.is("TrialCancelled")))
  const completed = Arr.length(Arr.filter(events, OptimizationEvent.is("TrialCompleted")))
  const completionReasons = Arr.flatMap(events, (event) =>
    Match.value(event).pipe(
      Match.tag("Completed", ({ completionReason }) => Arr.of(completionReason)),
      Match.orElse(Arr.empty)
    ))

  yield* Effect.log("Timeout + retry stream complete", {
    attempts,
    retries,
    cancelled,
    completed,
    completionReason: Option.getOrElse(Arr.head(completionReasons), () => "none")
  })
})

BunRuntime.runMain(program)
