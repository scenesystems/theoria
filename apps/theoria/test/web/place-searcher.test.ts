import { Worker, WorkerError } from "@effect/platform"
import { describe, expect, it } from "@effect/vitest"
import { Duration, Effect, Exit, Layer, Option, Ref, Stream, TestClock } from "effect"

import { answerWithin, PlaceSearcher, PlaceSearchUnanswered } from "../../app/web/services/PlaceSearcher.js"

/** How a worker of the fake manager answers every request: never, or by failing as the platform does. */
type Answering = "silent" | "failing"

/** What the fake manager saw: workers spawned, and workers ended with their scope. */
class Spawns extends Effect.Service<Spawns>()("test/Spawns", {
  effect: Effect.all({ spawned: Ref.make(0), ended: Ref.make(0) })
}) {}

/**
 * A worker manager whose workers behave like a real one that is gone: a
 * closed or reclaimed worker says nothing, a crashed one reports an error.
 * Each spawn is counted, and each worker's end with its scope.
 */
const managerLayer = (answering: Answering): Layer.Layer<Worker.WorkerManager | Worker.Spawner, never, Spawns> =>
  Layer.merge(
    Layer.effect(
      Worker.WorkerManager,
      Effect.map(Spawns, (spawns) =>
        Worker.WorkerManager.of({
          [Worker.WorkerManagerTypeId]: Worker.WorkerManagerTypeId,
          spawn: <I, O, E>(): Effect.Effect<Worker.Worker<I, O, E>, WorkerError.WorkerError, never> =>
            Effect.gen(function*() {
              const id = yield* Ref.updateAndGet(spawns.spawned, (count) => count + 1)
              yield* Effect.addFinalizer(() => Ref.update(spawns.ended, (count) => count + 1))
              const answer: Effect.Effect<O, E | WorkerError.WorkerError> = answering === "silent"
                ? Effect.never
                : Effect.fail(new WorkerError.WorkerError({ reason: "unknown", cause: "the worker crashed" }))
              return { id, execute: () => Stream.fromEffect(answer), executeEffect: () => answer }
            }).pipe(Effect.scoped)
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
