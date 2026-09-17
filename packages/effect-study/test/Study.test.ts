import { expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Deferred, Effect, Either, Exit, Fiber, Stream, Tuple } from "effect"

import * as History from "@scenesystems/effect-study/History"
import * as Study from "@scenesystems/effect-study/Study"
import * as Trial from "@scenesystems/effect-study/Trial"

const running = (trialNumber: number, config: string) => Trial.makeRunning(trialNumber, config, 0)

it.scoped("rejects an illegal lifecycle transaction without committing or publishing its history", () =>
  Effect.gen(function*() {
    const study = yield* Study.make<string, Trial.Running>()
    yield* Study.transition(study, "Running")
    const subscribed = yield* Deferred.make<void>()
    const observed = yield* Study.changes(study).pipe(
      Stream.tap(() => Deferred.succeed(subscribed, undefined)),
      Stream.take(2),
      Stream.runCollect,
      Effect.forkScoped
    )
    yield* Deferred.await(subscribed)

    const outcome = yield* Study.modify(study, (state) =>
      Effect.succeed(Tuple.make(
        undefined,
        new Study.State({
          lifecycle: "Created",
          history: History.set(state.history, running(10, "illegal"))
        })
      ))).pipe(Effect.exit)
    yield* Study.transition(study, "Completed")

    expect(outcome).toEqual(
      Exit.die("Study.modify invariant violated: illegal lifecycle transition Running -> Created")
    )
    const snapshots = Chunk.toReadonlyArray(yield* Fiber.join(observed))
    expect(Arr.map(snapshots, (snapshot) => snapshot.lifecycle)).toEqual(Arr.make("Running", "Completed"))
    expect(Arr.every(snapshots, (snapshot) => Arr.isEmptyReadonlyArray(History.values(snapshot.history)))).toBe(true)
  }))

it.scoped("serializes state transactions without publishing an interrupted mutation", () =>
  Effect.gen(function*() {
    const study = yield* Study.make<string, Trial.Running>()
    yield* Study.transition(study, "Running")
    const subscribed = yield* Deferred.make<void>()
    const observed = yield* Study.changes(study).pipe(
      Stream.tap(() => Deferred.succeed(subscribed, undefined)),
      Stream.take(3),
      Stream.runCollect,
      Effect.forkScoped
    )
    yield* Deferred.await(subscribed)

    const entered = yield* Deferred.make<void>()
    const interrupted = yield* Study.modify(study, (state) =>
      Deferred.succeed(entered, undefined).pipe(
        Effect.zipRight(Effect.never),
        Effect.as(Tuple.make(
          undefined,
          new Study.State({
            lifecycle: state.lifecycle,
            history: History.set(state.history, running(10, "interrupted"))
          })
        ))
      )).pipe(Effect.forkScoped)
    yield* Deferred.await(entered)

    const committed = yield* Study.modify(study, (state) =>
      Effect.succeed(Tuple.make(
        History.values(state.history),
        new Study.State({
          lifecycle: state.lifecycle,
          history: History.set(state.history, running(2, "committed"))
        })
      ))).pipe(Effect.forkScoped)

    yield* Fiber.interrupt(interrupted)
    expect(yield* Fiber.join(committed)).toEqual(Arr.empty())
    yield* Study.transition(study, "Completed")

    const snapshots = Chunk.toReadonlyArray(yield* Fiber.join(observed))
    expect(Arr.map(snapshots, (snapshot) => snapshot.lifecycle)).toEqual(
      Arr.make("Running", "Running", "Completed")
    )
    const committedSnapshot = yield* Arr.get(snapshots, 1)
    expect(Arr.map(History.values(committedSnapshot.history), (trial) => trial.config)).toEqual(Arr.of("committed"))
  }))

it.scoped("releases the transaction serializer after a typed failure without committing", () =>
  Effect.gen(function*() {
    const study = yield* Study.make<string, Trial.Running>()
    const entered = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    const failed = yield* Study.modify(study, (state) =>
      Deferred.succeed(entered, undefined).pipe(
        Effect.zipRight(Deferred.await(release)),
        Effect.zipRight(Effect.fail("transaction rejected")),
        Effect.as(Tuple.make(
          undefined,
          new Study.State({
            lifecycle: state.lifecycle,
            history: History.set(state.history, running(10, "failed"))
          })
        ))
      )).pipe(Effect.either, Effect.forkScoped)
    yield* Deferred.await(entered)

    const committed = yield* Study.modify(study, (state) =>
      Effect.succeed(Tuple.make(
        History.values(state.history),
        new Study.State({
          lifecycle: state.lifecycle,
          history: History.set(state.history, running(2, "committed"))
        })
      ))).pipe(Effect.forkScoped)

    yield* Deferred.succeed(release, undefined)
    expect(yield* Fiber.join(failed)).toEqual(Either.left("transaction rejected"))
    expect(yield* Fiber.join(committed)).toEqual(Arr.empty())
    expect(Arr.map(History.values((yield* Study.read(study)).history), (trial) => trial.config)).toEqual(
      Arr.of("committed")
    )
  }))

it.effect("restores snapshots atomically and never reopens a terminal study", () =>
  Effect.gen(function*() {
    const snapshot = new Study.State({
      lifecycle: "Paused",
      history: History.fromIterable(Arr.of(running(4, "restored")))
    })
    const study = yield* Study.fromState(snapshot)
    yield* Study.transition(study, "Running")
    yield* Study.transition(study, "Completed")
    yield* Study.transition(study, "Running")
    yield* Study.modify(study, (state) =>
      Effect.succeed(Tuple.make(
        undefined,
        new Study.State({ lifecycle: state.lifecycle, history: History.set(state.history, running(7, "late")) })
      )))

    const restored = yield* Study.read(study)
    expect(restored.lifecycle).toBe("Completed")
    expect(Arr.map(History.values(restored.history), (trial) => trial.config)).toEqual(Arr.make("restored", "late"))
  }).pipe(Effect.scoped))

it.effect("cancels a created study when its owning scope closes", () =>
  Effect.gen(function*() {
    const study = yield* Effect.scoped(Study.make<string, Trial.Running>())

    expect((yield* Study.read(study)).lifecycle).toBe("Cancelled")
  }))

it.effect("cancels a running study when its owning scope closes", () =>
  Effect.gen(function*() {
    const study = yield* Effect.scoped(
      Effect.gen(function*() {
        const scoped = yield* Study.make<string, Trial.Running>()
        yield* Study.transition(scoped, "Running")
        return scoped
      })
    )

    expect((yield* Study.read(study)).lifecycle).toBe("Cancelled")
  }))

it.effect("cancels a paused study when its owning scope closes", () =>
  Effect.gen(function*() {
    const study = yield* Effect.scoped(
      Effect.gen(function*() {
        const scoped = yield* Study.make<string, Trial.Running>()
        yield* Study.transition(scoped, "Running")
        yield* Study.transition(scoped, "Paused")
        return scoped
      })
    )

    expect((yield* Study.read(study)).lifecycle).toBe("Cancelled")
  }))
