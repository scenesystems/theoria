import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Match, Number as Num, Option, Ref, Schedule, Stream } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"
import * as Trial from "../../src/Trial.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(1), 1)
  })

const asSingleObjective = (
  result: Optimization.Result
): Option.Option<Optimization.SingleObjectiveResult> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", (single) => Option.some(single)),
    Match.orElse(() => Option.none())
  )

describe("Optimization objective retry", () => {
  it.effect("retries transient objective failures and emits TrialRetried events", () =>
    Effect.gen(function*() {
      const attemptsRef = yield* Ref.make(0)
      const events = yield* Stream.runCollect(
        Optimization.stream({
          space: yield* makeSpace(),
          sampler: Sampler.random({ seed: 7 }),
          direction: "minimize",
          trials: 1,
          retrySchedule: Schedule.recurs(2),
          objective: () =>
            Ref.updateAndGet(attemptsRef, Num.increment).pipe(
              Effect.flatMap((attempts) =>
                Match.value(Num.lessThanOrEqualTo(attempts, 2)).pipe(
                  Match.when(true, () => Effect.fail(`transient-${attempts}`)),
                  Match.orElse(() => Effect.succeed(0.5))
                )
              )
            )
        })
      )
      const attempts = yield* Ref.get(attemptsRef)
      const eventList = Chunk.toReadonlyArray(events)
      const retryAttempts = Arr.flatMap(eventList, (event) =>
        Match.value(event).pipe(
          Match.tag("TrialRetried", ({ attempt }) => Arr.of(attempt)),
          Match.orElse(Arr.empty)
        ))

      expect(attempts).toBe(3)
      expect(retryAttempts).toEqual(Arr.make(1, 2))
      expect(Arr.map(eventList, (event) => event._tag)).toContain("TrialCompleted")
    }))

  it.effect("records retryCount on completed trials and preserves it through snapshot and resume", () =>
    Effect.gen(function*() {
      const attemptsRef = yield* Ref.make(0)

      const result = yield* Optimization.run({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 7 }),
        direction: "minimize",
        trials: 1,
        retrySchedule: Schedule.recurs(2),
        objective: () =>
          Ref.updateAndGet(attemptsRef, Num.increment).pipe(
            Effect.flatMap((attempts) =>
              Match.value(Num.lessThanOrEqualTo(attempts, 2)).pipe(
                Match.when(true, () => Effect.fail(`transient-${attempts}`)),
                Match.orElse(() => Effect.succeed(0.5))
              )
            )
          )
      })

      const single = asSingleObjective(result)
      expect(Option.isSome(single)).toBe(true)
      const completed = yield* single

      const firstTrial = Arr.head(Arr.fromIterable(completed.trials))
      expect(Option.isSome(firstTrial)).toBe(true)
      const first = yield* firstTrial

      expect(first.state._tag).toBe("Completed")
      const firstCompleted = yield* Option.liftPredicate(first.state, Trial.isState("Completed"))
      expect(firstCompleted.retryCount).toBe(2)

      const snapshot = yield* Optimization.snapshot(completed)
      const snapshotTrial = Arr.head(snapshot.trials)
      expect(Option.isSome(snapshotTrial)).toBe(true)
      const persisted = yield* snapshotTrial

      expect(persisted.state._tag).toBe("Completed")
      const persistedCompleted = yield* Option.liftPredicate(persisted.state, Trial.isState("Completed"))
      expect(persistedCompleted.retryCount).toBe(2)

      const resumed = yield* Optimization.resume({
        space: yield* makeSpace(),
        sampler: Sampler.random({ seed: 7 }),
        snapshot,
        direction: "minimize",
        trials: 0,
        objective: () => Effect.succeed(0.5)
      })

      const resumedSingle = asSingleObjective(resumed)
      expect(Option.isSome(resumedSingle)).toBe(true)
      const resumedResult = yield* resumedSingle

      const resumedTrial = Arr.head(Arr.fromIterable(resumedResult.trials))
      expect(Option.isSome(resumedTrial)).toBe(true)
      const replayed = yield* resumedTrial

      expect(replayed.state._tag).toBe("Completed")
      const replayedCompleted = yield* Option.liftPredicate(replayed.state, Trial.isState("Completed"))
      expect(replayedCompleted.retryCount).toBe(2)
      expect(yield* Ref.get(attemptsRef)).toBe(3)
    }))
})
