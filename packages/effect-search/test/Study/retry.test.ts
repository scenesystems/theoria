import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Option, Ref, Schedule, Stream } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import * as Study from "../../src/Study/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1)
  })

describe("Study objective retry", () => {
  it.effect("retries transient objective failures and emits TrialRetried events", () =>
    Effect.gen(function*() {
      const attemptsRef = yield* Ref.make(0)
      const events = yield* Stream.runCollect(
        Study.optimizeStream({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 7 }),
          direction: "minimize",
          trials: 1,
          retrySchedule: Schedule.recurs(2),
          objective: () =>
            Ref.updateAndGet(attemptsRef, (attempts) => attempts + 1).pipe(
              Effect.flatMap((attempts) =>
                attempts <= 2
                  ? Effect.fail(`transient-${attempts}`)
                  : Effect.succeed(0.5)
              )
            )
        })
      )
      const attempts = yield* Ref.get(attemptsRef)
      const eventList = Chunk.toReadonlyArray(events)
      const retryAttempts = eventList.flatMap((event) =>
        event._tag === "TrialRetried"
          ? [event.attempt]
          : []
      )

      expect(attempts).toBe(3)
      expect(retryAttempts).toEqual([1, 2])
      expect(eventList.map((event) => event._tag)).toContain("TrialCompleted")
    }))

  it.effect("records retryCount on completed trials and preserves it through snapshot and resume", () =>
    Effect.gen(function*() {
      const attemptsRef = yield* Ref.make(0)

      const result = yield* Study.optimize({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 7 }),
        direction: "minimize",
        trials: 1,
        retrySchedule: Schedule.recurs(2),
        objective: () =>
          Ref.updateAndGet(attemptsRef, (attempts) => attempts + 1).pipe(
            Effect.flatMap((attempts) =>
              attempts <= 2
                ? Effect.fail(`transient-${attempts}`)
                : Effect.succeed(0.5)
            )
          )
      })

      const single = result._tag === "SingleObjective" ? Option.some(result) : Option.none()
      expect(Option.isSome(single)).toBe(true)

      if (Option.isNone(single)) {
        return
      }

      const firstTrial = Option.fromNullable(single.value.trials[0])
      expect(Option.isSome(firstTrial)).toBe(true)

      if (Option.isNone(firstTrial)) {
        return
      }

      expect(firstTrial.value.state._tag).toBe("Completed")

      if (firstTrial.value.state._tag !== "Completed") {
        return
      }

      expect(firstTrial.value.state.retryCount).toBe(2)

      const snapshot = yield* Study.snapshot(single.value)
      const snapshotTrial = Option.fromNullable(snapshot.trials[0])
      expect(Option.isSome(snapshotTrial)).toBe(true)

      if (Option.isNone(snapshotTrial)) {
        return
      }

      expect(snapshotTrial.value.state._tag).toBe("Completed")

      if (snapshotTrial.value.state._tag !== "Completed") {
        return
      }

      expect(snapshotTrial.value.state.retryCount).toBe(2)

      const resumed = yield* Study.resume({
        space: makeSpace(),
        sampler: Sampler.random({ seed: 7 }),
        snapshot,
        direction: "minimize",
        trials: 0,
        objective: () => Effect.succeed(0.5)
      })

      const resumedSingle = resumed._tag === "SingleObjective" ? Option.some(resumed) : Option.none()
      expect(Option.isSome(resumedSingle)).toBe(true)

      if (Option.isNone(resumedSingle)) {
        return
      }

      const resumedTrial = Option.fromNullable(resumedSingle.value.trials[0])
      expect(Option.isSome(resumedTrial)).toBe(true)

      if (Option.isNone(resumedTrial)) {
        return
      }

      expect(resumedTrial.value.state._tag).toBe("Completed")

      if (resumedTrial.value.state._tag !== "Completed") {
        return
      }

      expect(resumedTrial.value.state.retryCount).toBe(2)
      expect(yield* Ref.get(attemptsRef)).toBe(3)
    }))
})
