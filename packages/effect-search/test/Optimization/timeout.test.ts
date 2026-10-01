import { describe, expect, it } from "@effect/vitest"
import {
  Cause,
  Chunk,
  Deferred,
  Duration,
  Effect,
  Exit,
  Fiber,
  Number as Num,
  Option,
  Predicate,
  Stream,
  TestClock
} from "effect"

import { evaluateObjectiveWithTimeout } from "../../src/internal/optimization/runtime/objectiveTimeout.js"
import * as Optimization from "../../src/Optimization.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(Num.negate(1), 1)
  })

describe("Optimization objective timeout", () => {
  it.effect("cancels timed-out trials and emits TrialCancelled events", () =>
    Effect.gen(function*() {
      const started = yield* Deferred.make<void>()
      const eventsFiber = yield* Effect.fork(
        Stream.runCollect(
          Optimization.stream({
            space: yield* makeSpace(),
            sampler: Sampler.random({ seed: 17 }),
            direction: "minimize",
            trials: 1,
            trialTimeout: "10 millis",
            objective: () =>
              Deferred.succeed(started, undefined).pipe(
                Effect.zipRight(Effect.never),
                Effect.as(0.25)
              )
          })
        )
      )

      yield* Deferred.await(started)
      yield* TestClock.adjust("10 millis")

      const events = yield* Fiber.join(eventsFiber)
      const tags = Chunk.map(events, (event) => event._tag)
      const cancelledReasons = Chunk.map(
        Chunk.filter(events, (event) => Predicate.isTagged(event, "TrialCancelled")),
        ({ reason }) => reason
      )

      expect(tags).toContain("TrialCancelled")
      expect(tags).not.toContain("TrialFailed")
      expect(cancelledReasons).toEqual(Chunk.of("timeout"))
    }))

  it.effect("returns None for a plain timeout interruption after running cleanup", () =>
    Effect.gen(function*() {
      const started = yield* Deferred.make<void>()
      const cleaned = yield* Deferred.make<void>()
      const resultFiber = yield* Effect.fork(
        evaluateObjectiveWithTimeout(
          Deferred.succeed(started, undefined).pipe(
            Effect.zipRight(Effect.never),
            Effect.ensuring(Deferred.succeed(cleaned, undefined))
          ),
          Duration.millis(10)
        )
      )

      yield* Deferred.await(started)
      yield* TestClock.adjust(Duration.millis(10))

      const result = yield* Fiber.join(resultFiber)
      yield* Deferred.await(cleaned)

      expect(result).toEqual(Option.none())
    }))

  it.effect("preserves the full interruption and cleanup-defect cause on timeout", () =>
    Effect.gen(function*() {
      const started = yield* Deferred.make<void>()
      const resultFiber = yield* Effect.fork(
        evaluateObjectiveWithTimeout(
          Deferred.succeed(started, undefined).pipe(
            Effect.zipRight(Effect.never),
            Effect.ensuring(Effect.die("cleanup-defect"))
          ),
          Duration.millis(10)
        )
      )

      yield* Deferred.await(started)
      yield* TestClock.adjust(Duration.millis(10))

      const result = yield* Fiber.join(resultFiber)
      const cause = Option.flatMap(
        result,
        Exit.match({
          onSuccess: () => Option.none(),
          onFailure: Option.some
        })
      )

      expect(Option.map(cause, Cause.isInterrupted)).toEqual(Option.some(true))
      expect(Option.map(cause, Cause.defects)).toEqual(Option.some(Chunk.of("cleanup-defect")))
    }))

  it.effect("returns the successful Exit when the objective completes before its timeout", () =>
    Effect.gen(function*() {
      const started = yield* Deferred.make<void>()
      const complete = yield* Deferred.make<number>()
      const resultFiber = yield* Effect.fork(
        evaluateObjectiveWithTimeout(
          Deferred.succeed(started, undefined).pipe(Effect.zipRight(Deferred.await(complete))),
          Duration.millis(10)
        )
      )

      yield* Deferred.await(started)
      yield* TestClock.adjust(Duration.millis(9))
      yield* Deferred.succeed(complete, 0.25)

      expect(yield* Fiber.join(resultFiber)).toEqual(Option.some(Exit.succeed(0.25)))
    }))
})
