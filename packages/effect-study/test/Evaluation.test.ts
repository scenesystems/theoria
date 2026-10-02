import { expect, it } from "@effect/vitest"
import { Array as Arr, Context, Deferred, Effect, Exit, Fiber, Number as Num, Ref, Result, Schema } from "effect"
import { TestClock } from "effect/testing"

import * as Evaluation from "@scenesystems/effect-study/Evaluation"

class Rejected extends Schema.TaggedError<Rejected>()("Rejected", { input: Schema.Finite }) {}
class Prefix extends Context.Service<Prefix, string>()("study-test/Prefix") {}

const Observation = Schema.Struct({ prefix: Schema.String, config: Schema.Finite, trialNumber: Schema.Finite })

it.effect("evaluates fixed inputs with typed services and preserves input order across concurrent completion", () =>
  Effect.gen(function*() {
    const fastFinished = yield* Deferred.make<void>()
    const fiber = yield* Evaluation.run(
      Arr.make(3, 1),
      (config, trialNumber) =>
        Effect.gen(function*() {
          const prefix = yield* Prefix
          yield* Effect.sleep(Num.multiply(config, 100))
          yield* Deferred.succeed(fastFinished, undefined).pipe(Effect.when(Effect.succeed(Num.Equivalence(config, 1))))
          return Observation.make({ prefix, config, trialNumber })
        }),
      { concurrency: 2 }
    ).pipe(Effect.provideService(Prefix, "fixed"), Effect.forkChild)
    yield* TestClock.adjust("100 millis")
    yield* Deferred.await(fastFinished)
    yield* TestClock.adjust("200 millis")
    const trials = yield* Fiber.join(fiber)
    expect(Arr.map(trials, (trial) => trial.state.value)).toEqual(Arr.make(
      { prefix: "fixed", config: 3, trialNumber: 0 },
      { prefix: "fixed", config: 1, trialNumber: 1 }
    ))
    expect(Arr.map(trials, (trial) => trial.state.duration)).toEqual(Arr.make(300, 100))
  }))

it.effect("propagates typed evaluator failure and interrupts sibling evaluation resources", () =>
  Effect.gen(function*() {
    const started = yield* Deferred.make<void>()
    const finalized = yield* Ref.make(false)
    const result = yield* Evaluation.run(
      Arr.make(0, 1),
      (input) =>
        Num.Equivalence(input, 0)
          ? Deferred.await(started).pipe(Effect.andThen(Effect.fail(new Rejected({ input }))))
          : Effect.acquireUseRelease(
            Deferred.succeed(started, undefined),
            () => Effect.never,
            () => Ref.set(finalized, true)
          ),
      { concurrency: 2 }
    ).pipe(Effect.result)
    expect(result).toEqual(Result.fail(new Rejected({ input: 0 })))
    expect(yield* Ref.get(finalized)).toBe(true)
  }))

it.effect("waits for all active evaluator finalizers when the caller interrupts", () =>
  Effect.gen(function*() {
    const started = yield* Deferred.make<void>()
    const active = yield* Ref.make(0)
    const fiber = yield* Evaluation.run(Arr.make("left", "right"), () =>
      Effect.acquireUseRelease(
        Ref.updateAndGet(active, Num.increment).pipe(
          Effect.flatMap((count) => Num.Equivalence(count, 2) ? Deferred.succeed(started, undefined) : Effect.void)
        ),
        () => Effect.never,
        () => Ref.update(active, Num.decrement)
      ), { concurrency: 2 }).pipe(Effect.forkChild)
    yield* Deferred.await(started)
    yield* Fiber.interrupt(fiber)
    expect(yield* Ref.get(active)).toBe(0)
    expect(Exit.hasInterrupts(yield* Fiber.await(fiber))).toBe(true)
  }))
