import { expect, it } from "@effect/vitest"
import { Array as Arr, Cause, Deferred, Effect, Exit, Fiber, Number as Num, Ref, References, Stream } from "effect"

import * as Emitter from "@scenesystems/effect-study/Emitter"
import * as Evaluation from "@scenesystems/effect-study/Evaluation"

it.effect("never settles a typed failure combined with a finalizer defect", () =>
  Effect.gen(function*() {
    const evaluate = () => Effect.fail("expected").pipe(Effect.ensuring(Effect.die("cleanup defect")))
    const expected = Exit.failCause(Cause.combine(Cause.fail("expected"), Cause.die("cleanup defect")))
    expect(yield* Evaluation.runSettled(Arr.of(0), evaluate).pipe(Effect.exit)).toEqual(expected)
    expect(yield* Evaluation.runWithEvents(Arr.of(0), evaluate, {}, () => Effect.void).pipe(Effect.exit)).toEqual(
      expected
    )
  }))

it.effect("settled interruption awaits every active resource and returns no partial report", () =>
  Effect.gen(function*() {
    const ready = yield* Deferred.make<void>()
    const active = yield* Ref.make(0)
    const fiber = yield* Evaluation.runSettled(Arr.make(1, 2, 3), () =>
      Effect.acquireUseRelease(
        Ref.updateAndGet(active, Num.increment).pipe(
          Effect.tap((count) => Num.Equivalence(count, 2) ? Deferred.succeed(ready, undefined) : Effect.void)
        ),
        () => Effect.never,
        () => Ref.update(active, Num.decrement)
      ), { concurrency: 2 }).pipe(Effect.forkChild)
    yield* Deferred.await(ready)
    yield* Fiber.interrupt(fiber)
    expect(Exit.hasInterrupts(yield* Fiber.await(fiber))).toBe(true)
    expect(yield* Ref.get(active)).toBe(0)
  }))

it.effect("interruption during start or terminal acknowledgment leaves only the acknowledged prefix", () =>
  Effect.forEach(Arr.make("TrialStarted", "TrialSettled"), (blockedTag) =>
    Effect.gen(function*() {
      const blocked = yield* Deferred.make<void>()
      const executed = yield* Ref.make(0)
      const seen = yield* Ref.make(Arr.empty<string>())
      const fiber = yield* Evaluation.runWithEvents(
        Arr.make(7, 9),
        () => Ref.update(executed, Num.increment),
        { concurrency: 2 },
        (event) =>
          event._tag === blockedTag
            ? Deferred.succeed(blocked, undefined).pipe(Effect.andThen(Effect.never))
            : Ref.update(seen, Arr.append(event._tag))
      ).pipe(Effect.forkChild)
      yield* Deferred.await(blocked)
      yield* Fiber.interrupt(fiber)
      expect(Exit.hasInterrupts(yield* Fiber.await(fiber))).toBe(true)
      expect(yield* Ref.get(executed)).toBe(blockedTag === "TrialStarted" ? 0 : 1)
      expect(yield* Ref.get(seen)).toEqual(
        blockedTag === "TrialStarted"
          ? Arr.of("Planned")
          : Arr.make("Planned", "TrialStarted")
      )
    })))

it.effect("a defect after acknowledged success retains evidence and the original cause", () =>
  Effect.gen(function*() {
    const seen = yield* Ref.make(Arr.empty<Evaluation.EvaluationEvent<number, number, never>>())
    const defect = Cause.die("evaluator defect")
    const exit = yield* Evaluation.runWithEvents(
      Arr.make(11, 22, 33),
      (input) => Num.Equivalence(input, 11) ? Effect.succeed(91) : Effect.failCause(defect),
      {},
      (event) => Ref.update(seen, Arr.append(event))
    ).pipe(Effect.exit)
    expect(exit).toEqual(Exit.failCause(defect))
    const events = yield* Ref.get(seen)
    expect(Arr.map(events, (event) => event._tag)).toEqual(
      Arr.make("Planned", "TrialStarted", "TrialSettled", "TrialStarted", "Terminated")
    )
    expect(Arr.flatMap(events, (event) => event._tag === "TrialSettled" ? Arr.of(event.trial) : Arr.empty()))
      .toEqual(Arr.of({ trialNumber: 0, config: 11, state: { _tag: "Completed", value: 91, duration: 0 } }))
    expect(Arr.flatMap(events, (event) => event._tag === "Terminated" ? Arr.of(event.cause) : Arr.empty()))
      .toEqual(Arr.of(defect))
    expect(yield* Evaluation.runSettled(Arr.of(0), () => Effect.failCause(defect)).pipe(Effect.exit))
      .toEqual(Exit.failCause(defect))
  }))

it.effect("termination observation failure cannot replace the evaluator defect", () =>
  Effect.gen(function*() {
    const exit = yield* Evaluation.runWithEvents(
      Arr.of(0),
      () => Effect.die("original"),
      {},
      (event) => event._tag === "Terminated" ? Effect.fail("cleanup sink") : Effect.void
    ).pipe(Effect.exit)
    expect(exit).toEqual(Exit.die("original"))
  }))

it.effect("observer defects and final acknowledgment failures are fatal, never trial failures", () =>
  Effect.gen(function*() {
    const seen = yield* Ref.make(Arr.empty<string>())
    expect(
      yield* Evaluation.runWithEvents(
        Arr.of(0),
        Effect.succeed,
        {},
        (event) => event._tag === "TrialSettled" ? Effect.die("sink defect") : Ref.update(seen, Arr.append(event._tag))
      )
        .pipe(Effect.exit)
    ).toEqual(Exit.die("sink defect"))
    expect(yield* Ref.get(seen)).toEqual(Arr.make("Planned", "TrialStarted"))
    expect(
      yield* Evaluation.runWithEvents(
        Arr.empty<number>(),
        () => Effect.die("not called"),
        {},
        (event) => event._tag === "Completed" ? Effect.fail("final acknowledgment") : Effect.void
      ).pipe(Effect.exit)
    )
      .toEqual(Exit.fail("final acknowledgment"))
  }))

it.effect("early derived stream termination finalizes all local evaluators", () =>
  Effect.gen(function*() {
    const ready = yield* Deferred.make<void>()
    const active = yield* Ref.make(0)
    const events = yield* Emitter.toStream((emit: Emitter.Emitter<Evaluation.EvaluationEvent<number, never, never>>) =>
      Evaluation.runWithEvents(
        Arr.make(1, 2, 3),
        () =>
          Effect.acquireUseRelease(
            Ref.updateAndGet(active, Num.increment).pipe(
              Effect.tap((count) => Num.Equivalence(count, 2) ? Deferred.succeed(ready, undefined) : Effect.void)
            ),
            () => Effect.never,
            () => Ref.update(active, Num.decrement)
          ),
        { concurrency: 2 },
        emit
      )
    ).pipe(
      Stream.tap(() => Deferred.await(ready)),
      Stream.take(3),
      Stream.runCollect
    )
    expect(Arr.map(events, (event) => event._tag)).toEqual(Arr.make("Planned", "TrialStarted", "TrialStarted"))
    expect(yield* Ref.get(active)).toBe(0)
  }))

it.effect("observer failure racing pending starts never invokes later evaluators", () =>
  Effect.forEach(Arr.make(32, 64, 128), (budget) =>
    Effect.gen(function*() {
      const called = yield* Ref.make(Arr.empty<number>())
      const exit = yield* Evaluation.runWithEvents(
        Arr.range(0, 9),
        (input) => Ref.update(called, Arr.append(input)).pipe(Effect.andThen(Effect.never)),
        { concurrency: 10 },
        (event) =>
          event._tag === "TrialStarted" && Num.Equivalence(event.trialNumber, 1)
            ? Effect.fail("closed")
            : Effect.yieldNow
      ).pipe(Effect.provideService(References.MaxOpsBeforeYield, budget), Effect.exit)
      expect(Cause.findErrorOption(Exit.isFailure(exit) ? exit.cause : Cause.empty)).toEqual(
        Cause.findErrorOption(Cause.fail("closed"))
      )
      expect(Arr.every(yield* Ref.get(called), (input) => Num.Equivalence(input, 0))).toBe(true)
    })))

it.effect("fail-fast evaluation cannot finish before a suspended sibling finalizer completes", () =>
  Effect.gen(function*() {
    const active = yield* Deferred.make<void>()
    const finalizing = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    const returned = yield* Ref.make(false)
    const fiber = yield* Evaluation.run(Arr.make(0, 1), (input) =>
      Num.Equivalence(input, 0)
        ? Deferred.await(active).pipe(Effect.andThen(Effect.fail("rejected")))
        : Effect.acquireUseRelease(Deferred.succeed(active, undefined), () =>
          Effect.never, () =>
          Deferred.succeed(finalizing, undefined).pipe(Effect.andThen(Deferred.await(release)))), { concurrency: 2 })
      .pipe(Effect.exit, Effect.tap(() => Ref.set(returned, true)), Effect.forkChild)
    yield* Deferred.await(finalizing)
    expect(yield* Ref.get(returned)).toBe(false)
    yield* Deferred.succeed(release, undefined)
    expect(yield* Fiber.join(fiber)).toEqual(Exit.fail("rejected"))
  }))
