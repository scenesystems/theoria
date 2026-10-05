import { expect, it } from "@effect/vitest"
import { Array as Arr, Context, Deferred, Effect, Exit, Fiber, Number as Num, Option, Ref } from "effect"
import { TestClock } from "effect/testing"

import * as Evaluation from "@scenesystems/effect-study/Evaluation"

class Sink extends Context.Service<Sink, string>()("study-test/EventSink") {}
class Evaluator extends Context.Service<Evaluator, number>()("study-test/Evaluator") {}

it.effect("awaits start and terminal acknowledgments before execution and completion", () =>
  Effect.gen(function*() {
    const start = yield* Deferred.make<void>()
    const terminal = yield* Deferred.make<void>()
    const allowStart = yield* Deferred.make<void>()
    const allowTerminal = yield* Deferred.make<void>()
    const executed = yield* Ref.make(false)
    const published = yield* Ref.make(false)
    const seen = yield* Ref.make(Arr.empty<string>())
    const fiber = yield* Evaluation.runWithEvents(
      Arr.of("input"),
      () => Ref.set(executed, true).pipe(Effect.as(9)),
      {},
      (event) =>
        Effect.gen(function*() {
          if (event._tag === "TrialStarted") {
            yield* Deferred.succeed(start, undefined)
            yield* Deferred.await(allowStart)
          }
          if (event._tag === "TrialSettled") {
            yield* Deferred.succeed(terminal, undefined)
            yield* Deferred.await(allowTerminal)
          }
          yield* Ref.update(seen, Arr.append(event._tag))
        })
    ).pipe(Effect.tap(() => Ref.set(published, true)), Effect.forkChild)
    yield* Deferred.await(start)
    expect(yield* Ref.get(executed)).toBe(false)
    expect(yield* Ref.get(seen)).toEqual(Arr.of("Planned"))
    yield* TestClock.adjust(50)
    yield* Deferred.succeed(allowStart, undefined)
    yield* Deferred.await(terminal)
    expect(yield* Ref.get(executed)).toBe(true)
    expect(yield* Ref.get(published)).toBe(false)
    expect(yield* Ref.get(seen)).toEqual(Arr.make("Planned", "TrialStarted"))
    yield* TestClock.adjust(70)
    yield* Deferred.succeed(allowTerminal, undefined)
    expect(yield* Fiber.join(fiber)).toEqual(Arr.of({
      trialNumber: 0,
      config: "input",
      state: { _tag: "Completed", value: 9, duration: 0 }
    }))
    expect(yield* Ref.get(seen)).toEqual(Arr.make("Planned", "TrialStarted", "TrialSettled", "Completed"))
  }))

it.effect("serializes slow observers while evaluators overlap and preserves both service channels", () =>
  Effect.gen(function*() {
    const active = yield* Ref.make(0)
    const maximum = yield* Ref.make(0)
    const evaluating = yield* Ref.make(0)
    const overlap = yield* Deferred.make<void>()
    const secondSettled = yield* Deferred.make<void>()
    const observed = yield* Ref.make(Arr.empty<Evaluation.EvaluationEvent<number, number, string>>())
    const program: Effect.Effect<
      ReadonlyArray<Evaluation.SettledTrial<number, number, string>>,
      string,
      Sink | Evaluator
    > = Evaluation.runWithEvents(
      Arr.make(4, 2),
      (input) =>
        Effect.gen(function*() {
          const value = yield* Evaluator
          const count = yield* Ref.updateAndGet(evaluating, Num.increment)
          if (Num.Equivalence(count, 2)) yield* Deferred.succeed(overlap, undefined)
          yield* Deferred.await(overlap)
          if (Num.Equivalence(input, 2)) return yield* Effect.fail("expected")
          yield* Deferred.await(secondSettled)
          return value
        }),
      { concurrency: 2 },
      (event) =>
        Effect.gen(function*() {
          yield* Sink
          const count = yield* Ref.updateAndGet(active, Num.increment)
          yield* Ref.update(maximum, Num.max(count))
          yield* Effect.sleep(10)
          yield* Ref.update(observed, Arr.append(event))
          if (event._tag === "TrialSettled" && Num.Equivalence(event.trial.trialNumber, 1)) {
            yield* Deferred.succeed(secondSettled, undefined)
          }
          yield* Ref.update(active, Num.decrement)
        })
    )
    const fiber = yield* program.pipe(
      Effect.provideService(Sink, "sink"),
      Effect.provideService(Evaluator, 13),
      Effect.forkChild
    )
    yield* TestClock.adjust(100)
    const trials = yield* Fiber.join(fiber)
    expect(yield* Ref.get(maximum)).toBe(1)
    expect(trials).toEqual(Arr.make(
      { trialNumber: 0, config: 4, state: { _tag: "Completed", value: 13, duration: 20 } },
      { trialNumber: 1, config: 2, state: { _tag: "Failed", error: "expected", duration: 0 } }
    ))
    const events = yield* Ref.get(observed)
    expect(Arr.head(events)).toEqual(Option.some({ _tag: "Planned", inputs: Arr.make(4, 2) }))
    expect(Arr.last(events)).toEqual(Option.some({ _tag: "Completed", completionReason: "Settled" }))
    expect(Arr.flatMap(events, (event) => event._tag === "TrialSettled" ? Arr.of(event.trial) : Arr.empty()))
      .toEqual(Arr.make(
        { trialNumber: 1, config: 2, state: { _tag: "Failed", error: "expected", duration: 0 } },
        { trialNumber: 0, config: 4, state: { _tag: "Completed", value: 13, duration: 20 } }
      ))
  }))

it.effect("observer failure closes admission and waits for active evaluator cleanup", () =>
  Effect.gen(function*() {
    const active = yield* Deferred.make<void>()
    const finalized = yield* Ref.make(false)
    const started = yield* Ref.make(Arr.empty<number>())
    const seen = yield* Ref.make(Arr.empty<string>())
    const exit = yield* Evaluation.runWithEvents(
      Arr.make(0, 1, 2),
      (input) =>
        Ref.update(started, Arr.append(input)).pipe(Effect.andThen(
          Effect.acquireUseRelease(
            Deferred.succeed(active, undefined),
            () => Effect.never,
            () => Ref.set(finalized, true)
          )
        )),
      { concurrency: 3 },
      (event) =>
        Effect.gen(function*() {
          if (event._tag === "TrialStarted" && Num.Equivalence(event.trialNumber, 1)) {
            yield* Deferred.await(active)
            return yield* Effect.fail("sink unavailable")
          }
          yield* Ref.update(seen, Arr.append(event._tag))
        })
    ).pipe(Effect.exit)
    expect(exit).toEqual(Exit.fail("sink unavailable"))
    expect(yield* Ref.get(started)).toEqual(Arr.of(0))
    expect(yield* Ref.get(finalized)).toBe(true)
    expect(yield* Ref.get(seen)).toEqual(Arr.make("Planned", "TrialStarted"))
  }))
