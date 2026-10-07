import { expect, it } from "@effect/vitest"
import * as Evaluation from "@scenesystems/effect-study/Evaluation"
import {
  Array as Arr,
  Boolean as Bool,
  Chunk,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Number,
  Option,
  Ref,
  Schema
} from "effect"
import { TestClock } from "effect/testing"

class Rejected extends Schema.TaggedError<Rejected>()("Rejected", { input: Schema.Int }) {}

it.effect("collects typed failures and retains input order despite concurrent completion", () =>
  Effect.gen(function*() {
    const fiber = yield* Evaluation.runCollecting(
      [3, 1, 2],
      (input) =>
        Effect.sleep(input * 100).pipe(
          Effect.andThen(
            Bool.match(input === 1, {
              onFalse: () => Effect.succeed(input * 7),
              onTrue: () => Effect.fail(new Rejected({ input }))
            })
          )
        ),
      { concurrency: 3, maxFailures: Option.none(), onFailure: "record" }
    ).pipe(Effect.forkChild)
    yield* TestClock.adjust("300 millis")
    const trials = Chunk.toReadonlyArray(yield* Fiber.join(fiber))
    expect(Arr.map(trials, (trial) => trial.trialNumber)).toEqual([0, 1, 2])
    expect(Arr.map(trials, (trial) => trial.state)).toEqual([
      { _tag: "Completed", value: 21, duration: 300 },
      { _tag: "Failed", error: new Rejected({ input: 1 }), duration: 100 },
      { _tag: "Completed", value: 14, duration: 200 }
    ])
  }))

it.effect("stops admitting work over the limit and drains in-flight evaluations", () =>
  Effect.gen(function*() {
    const secondStarted = yield* Deferred.make<void>()
    const started = yield* Ref.make(0)
    const finished = yield* Ref.make(false)
    const fiber = yield* Evaluation.runCollecting([0, 1, 2, 3], (input) =>
      Ref.update(started, Number.increment).pipe(Effect.andThen(
        Bool.match(input === 0, {
          onFalse: () =>
            Deferred.succeed(secondStarted, undefined).pipe(
              Effect.andThen(Effect.sleep("1 second")),
              Effect.andThen(Ref.set(finished, true)),
              Effect.andThen(Effect.fail(new Rejected({ input })))
            ),
          onTrue: () =>
            Deferred.await(secondStarted).pipe(Effect.andThen(Effect.fail(new Rejected({ input }))))
        })
      )), { concurrency: 2, maxFailures: Option.some(0), onFailure: "record" }).pipe(Effect.flip, Effect.forkChild)
    yield* Deferred.await(secondStarted)
    yield* TestClock.adjust("1 second")
    const failure = yield* Fiber.join(fiber)
    expect(failure).toEqual(new Evaluation.TooManyFailures({ count: 2, limit: 0 }))
    expect(yield* Ref.get(started)).toBe(2)
    expect(yield* Ref.get(finished)).toBe(true)
  }))

it.effect("does not count defects or interruption as expected failures", () =>
  Effect.gen(function*() {
    const defect = yield* Evaluation.runCollecting([0], () => Effect.die("broken"), {
      maxFailures: Option.none(),
      onFailure: "record"
    }).pipe(Effect.exit)
    expect(Exit.hasDies(defect)).toBe(true)
    const started = yield* Deferred.make<void>()
    const finalized = yield* Ref.make(false)
    const fiber = yield* Evaluation.runCollecting([0], () =>
      Effect.acquireUseRelease(
        Deferred.succeed(started, undefined),
        () => Effect.never,
        () => Ref.set(finalized, true)
      ), { maxFailures: Option.none(), onFailure: "record" }).pipe(Effect.forkChild)
    yield* Deferred.await(started)
    yield* Fiber.interrupt(fiber)
    expect(Exit.hasInterrupts(yield* Fiber.await(fiber))).toBe(true)
    expect(yield* Ref.get(finalized)).toBe(true)
  }))
