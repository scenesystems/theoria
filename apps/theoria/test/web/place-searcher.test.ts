import { Worker, WorkerError } from "@effect/platform"
import { describe, expect, it } from "@effect/vitest"
import { Duration, Effect, Exit, Fiber, Layer, Option, Ref, type Scope, Stream, TestClock } from "effect"

import { answerWithin, bootWithin, PlaceSearcher, PlaceSearchUnanswered } from "../../app/web/services/PlaceSearcher.js"

/**
 * How a worker of the fake manager behaves: never ready, so its spawn never
 * returns; or ready, and answering every request never, or by failing as
 * the platform does.
 */
type Answering = "unready" | "silent" | "failing"

/** What the fake manager saw: workers spawned, and workers ended with their scope. */
class Spawns extends Effect.Service<Spawns>()("test/Spawns", {
  effect: Effect.all({ spawned: Ref.make(0), ended: Ref.make(0) })
}) {}

/**
 * A worker manager whose workers behave like a real one that is gone: a
 * script that never loads is never ready, a closed or reclaimed worker says
 * nothing, a crashed one reports an error. Each spawn is counted, and each
 * worker's end with the scope it was spawned in — the caller's, as the
 * platform's is — so a worker still in use has not ended.
 */
const managerLayer = (answering: Answering): Layer.Layer<Worker.WorkerManager | Worker.Spawner, never, Spawns> =>
  Layer.merge(
    Layer.effect(
      Worker.WorkerManager,
      Effect.map(Spawns, (spawns) =>
        Worker.WorkerManager.of({
          [Worker.WorkerManagerTypeId]: Worker.WorkerManagerTypeId,
          spawn: <I, O, E>(): Effect.Effect<Worker.Worker<I, O, E>, WorkerError.WorkerError, Scope.Scope> =>
            Effect.gen(function*() {
              const id = yield* Ref.updateAndGet(spawns.spawned, (count) => count + 1)
              yield* Effect.addFinalizer(() => Ref.update(spawns.ended, (count) => count + 1))
              const answer: Effect.Effect<O, E | WorkerError.WorkerError> = answering === "failing"
                ? Effect.fail(new WorkerError.WorkerError({ reason: "unknown", cause: "the worker crashed" }))
                : Effect.never
              const ready: Worker.Worker<I, O, E> = {
                id,
                execute: () => Stream.fromEffect(answer),
                executeEffect: () => answer
              }
              return yield* (answering === "unready" ? Effect.never : Effect.succeed(ready))
            })
        }))
    ),
    Worker.layerSpawner(() => undefined)
  )

const searcherWith = (answering: Answering) =>
  PlaceSearcher.DefaultWithoutDependencies.pipe(
    Layer.provide(managerLayer(answering)),
    Layer.provideMerge(Spawns.Default)
  )

/** Opens a search and waits out the answer bound, so a silent worker is found out. */
const openPastTheBound = Effect.gen(function*() {
  const searcher = yield* PlaceSearcher
  const opened = yield* Effect.fork(Effect.exit(Effect.scoped(searcher.open)))
  yield* TestClock.adjust(answerWithin)
  return yield* opened
})

describe("PlaceSearcher", () => {
  it.effect("a worker that never answers is given up on at the answer bound, with the request named", () =>
    Effect.gen(function*() {
      const searcher = yield* PlaceSearcher
      const opened = yield* Effect.fork(Effect.exit(Effect.scoped(searcher.open)))
      yield* TestClock.adjust(Duration.subtract(answerWithin, Duration.millis(1)))
      expect(yield* opened.poll).toEqual(Option.none())
      yield* TestClock.adjust(Duration.millis(1))
      const exit = yield* opened
      expect(exit).toEqual(Exit.fail(new PlaceSearchUnanswered({ request: "OpenSearch", after: answerWithin })))
    }).pipe(Effect.provide(searcherWith("silent"))))

  it.effect("a worker in use has not ended; it ends when it is given up on", () =>
    Effect.gen(function*() {
      const spawns = yield* Spawns
      const searcher = yield* PlaceSearcher
      const opened = yield* Effect.fork(Effect.exit(Effect.scoped(searcher.open)))
      yield* TestClock.adjust(Duration.subtract(answerWithin, Duration.millis(1)))
      expect(yield* Ref.get(spawns.spawned)).toBe(1)
      expect(yield* Ref.get(spawns.ended)).toBe(0)
      yield* TestClock.adjust(Duration.millis(1))
      yield* opened
      expect(yield* Ref.get(spawns.ended)).toBe(1)
    }).pipe(Effect.provide(searcherWith("silent"))))

  it.effect("a worker that is never ready is given up on at the boot bound, and the next search spawns another", () =>
    Effect.gen(function*() {
      const spawns = yield* Spawns
      const searcher = yield* PlaceSearcher
      // The service spawns its first worker as it is made; the search waits on that spawn, not a second one.
      const opened = yield* Effect.fork(Effect.exit(Effect.scoped(searcher.open)))
      yield* TestClock.adjust(Duration.subtract(bootWithin, Duration.millis(1)))
      expect(yield* Ref.get(spawns.spawned)).toBe(1)
      expect(yield* opened.poll).toEqual(Option.none())
      // The boot spawn is given up on and ended; the search spawns its own, and gives up on that at its bound.
      yield* TestClock.adjust(Duration.millis(1))
      expect(yield* Ref.get(spawns.ended)).toBe(1)
      expect(yield* Ref.get(spawns.spawned)).toBe(2)
      yield* TestClock.adjust(bootWithin)
      expect(yield* opened).toEqual(Exit.fail(new PlaceSearchUnanswered({ request: "spawn", after: bootWithin })))
      expect(yield* Ref.get(spawns.ended)).toBe(2)
    }).pipe(Effect.provide(searcherWith("unready"))))

  it.effect("a search given up on while opening forgets the worker, so nothing it may have opened is kept", () =>
    Effect.gen(function*() {
      const spawns = yield* Spawns
      const searcher = yield* PlaceSearcher
      const opening = yield* Effect.fork(Effect.scoped(searcher.open))
      yield* TestClock.adjust(Duration.millis(100))
      expect(yield* Ref.get(spawns.ended)).toBe(0)
      yield* Fiber.interrupt(opening)
      expect(yield* Ref.get(spawns.ended)).toBe(1)
      yield* openPastTheBound
      expect(yield* Ref.get(spawns.spawned)).toBe(2)
    }).pipe(Effect.provide(searcherWith("silent"))))

  it.effect("a silent worker is ended and forgotten, and the next search spawns another", () =>
    Effect.gen(function*() {
      const spawns = yield* Spawns
      yield* openPastTheBound
      expect(yield* Ref.get(spawns.spawned)).toBe(1)
      expect(yield* Ref.get(spawns.ended)).toBe(1)
      yield* openPastTheBound
      expect(yield* Ref.get(spawns.spawned)).toBe(2)
      expect(yield* Ref.get(spawns.ended)).toBe(2)
    }).pipe(Effect.provide(searcherWith("silent"))))

  it.effect("a worker that fails is ended and forgotten at once", () =>
    Effect.gen(function*() {
      const spawns = yield* Spawns
      const searcher = yield* PlaceSearcher
      const exit = yield* Effect.exit(Effect.scoped(searcher.open))
      expect(Exit.isFailure(exit)).toBe(true)
      expect(yield* Ref.get(spawns.ended)).toBe(1)
      yield* Effect.exit(Effect.scoped(searcher.open))
      expect(yield* Ref.get(spawns.spawned)).toBe(2)
    }).pipe(Effect.provide(searcherWith("failing"))))
})
