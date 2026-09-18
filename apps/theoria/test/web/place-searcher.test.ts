import { Worker, WorkerError } from "@effect/platform"
import { describe, expect, it } from "@effect/vitest"
import {
  Duration,
  Effect,
  Exit,
  Fiber,
  Function as Fn,
  Layer,
  Match,
  Number as Num,
  Option,
  type ParseResult,
  Ref,
  Schema,
  Scope,
  Stream,
  TestClock
} from "effect"
import * as Arr from "effect/Array"

import {
  AskedMeander,
  AskSearch,
  CloseSearch,
  OpenSearch,
  PlaceSearchId,
  PlaceSearchRequest,
  TellSearch
} from "../../app/contracts/demo/imagined-place-search.js"
import { answerWithin, bootWithin, PlaceSearcher, PlaceSearchUnanswered } from "../../app/web/services/PlaceSearcher.js"

/**
 * How a worker of the fake manager behaves: never ready, so its spawn never
 * returns; or ready, and answering every request never, by failing as the
 * platform does, or properly, as the search worker does — or properly but
 * for one request: never answering a close, or failing every ask.
 */
type Answering = "unready" | "silent" | "failing" | "answering" | "never-closing" | "failing-asks"

/** What the fake manager saw: workers spawned, workers ended with their scope, and every request posted to one. */
class Spawns extends Effect.Service<Spawns>()("test/Spawns", {
  effect: Effect.all({
    spawned: Ref.make(0),
    ended: Ref.make(0),
    requests: Ref.make(Arr.empty<PlaceSearchRequest>()),
    searches: Ref.make(0)
  })
}) {}

const meander = { edge: 0.7, swing: 0.1, phase: 0, turns: 1, top: 0.2, step: 0.1 }

/**
 * What the search worker puts on the wire for each request, encoded as the
 * worker runner encodes it: a new search's number, a meander with its trial,
 * nothing for a tell or a close. The wire itself carries whatever the
 * request's schema encodes, which the serialized worker decodes.
 */
const answeredOnTheWire = (
  spawns: Spawns,
  request: PlaceSearchRequest
): Effect.Effect<unknown, ParseResult.ParseError> =>
  Match.value(request).pipe(
    Match.tag("OpenSearch", () => Ref.updateAndGet(spawns.searches, Num.increment)),
    Match.tag("AskSearch", (asked) => Schema.encode(AskedMeander)(new AskedMeander({ trial: asked.search, meander }))),
    Match.tag("TellSearch", () => Effect.void),
    Match.tag("CloseSearch", () => Effect.void),
    Match.exhaustive
  )

const crashed = Effect.fail(new WorkerError.WorkerError({ reason: "unknown", cause: "the worker crashed" }))

/** How a worker in one mode answers a request posted to it while it is alive. */
const behaving = (
  answering: Answering,
  spawns: Spawns,
  request: PlaceSearchRequest
): Effect.Effect<unknown, WorkerError.WorkerError | ParseResult.ParseError> =>
  Match.value({ answering, request: request._tag }).pipe(
    Match.when({ answering: "failing" }, () => crashed),
    Match.when({ answering: "silent" }, () => Effect.never),
    Match.when({ answering: "never-closing", request: "CloseSearch" }, () => Effect.never),
    Match.when({ answering: "failing-asks", request: "AskSearch" }, () => crashed),
    Match.orElse(() => answeredOnTheWire(spawns, request))
  )

const wire = Schema.decodeUnknown(Schema.Any)

/**
 * A worker manager whose workers behave like a real one that is gone: a
 * script that never loads is never ready, a closed or reclaimed worker says
 * nothing, a crashed one reports an error — or like the search worker,
 * answering every request on the wire. Each spawn is counted, and each
 * worker's end with the scope it was spawned in — the caller's, as the
 * platform's is — so a worker still in use has not ended. Every request
 * posted is recorded, answered or not; a worker that has ended records it
 * and, as the platform's does, never answers.
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
              const id = yield* Ref.updateAndGet(spawns.spawned, Num.increment)
              const alive = yield* Ref.make(true)
              yield* Effect.addFinalizer(() =>
                Effect.zipRight(Ref.set(alive, false), Ref.update(spawns.ended, Num.increment))
              )
              const answer = (message: I): Effect.Effect<O, E | WorkerError.WorkerError> =>
                Schema.decodeUnknown(PlaceSearchRequest)(message).pipe(
                  Effect.tap((request) => Ref.update(spawns.requests, Arr.append(request))),
                  Effect.flatMap((request) =>
                    Effect.if(Ref.get(alive), {
                      onTrue: () => behaving(answering, spawns, request),
                      onFalse: () => Effect.never
                    })
                  ),
                  Effect.flatMap(wire),
                  Effect.catchTag("ParseError", (error) => Effect.die(error))
                )
              const ready: Worker.Worker<I, O, E> = {
                id,
                execute: (message) => Stream.fromEffect(answer(message)),
                executeEffect: answer
              }
              return yield* Match.value(answering).pipe(
                Match.when("unready", () => Effect.never),
                Match.orElse(() => Effect.succeed(ready))
              )
            })
        }))
    ),
    Worker.layerSpawner(Fn.constVoid)
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

  it.effect("a search that opens asks and tells under its own name, and is closed with the scope it was opened in", () =>
    Effect.gen(function*() {
      const spawns = yield* Spawns
      const searcher = yield* PlaceSearcher
      const scope = yield* Scope.make()
      const search = yield* searcher.open.pipe(Scope.extend(scope))
      const asked = yield* search.ask
      expect(asked.trial).toBe(1)
      yield* search.tell(asked.trial, 0.25)
      expect(yield* Ref.get(spawns.requests)).toEqual([
        new OpenSearch(),
        new AskSearch({ search: PlaceSearchId.make(1) }),
        new TellSearch({ search: PlaceSearchId.make(1), trial: 1, loss: 0.25 })
      ])
      yield* Scope.close(scope, Exit.void)
      expect(Arr.last(yield* Ref.get(spawns.requests))).toEqual(
        Option.some(new CloseSearch({ search: PlaceSearchId.make(1) }))
      )
      // The worker is kept for the next search; only its search was closed.
      expect(yield* Ref.get(spawns.ended)).toBe(0)
      const next = yield* Effect.scoped(Effect.flatMap(searcher.open, (opened) => opened.ask))
      expect(next.trial).toBe(2)
      expect(yield* Ref.get(spawns.spawned)).toBe(1)
    }).pipe(Effect.provide(searcherWith("answering"))))

  it.effect("a worker that never answers a close does not hold the scope: the close is given up on at the bound, and the worker with it", () =>
    Effect.gen(function*() {
      const spawns = yield* Spawns
      const searcher = yield* PlaceSearcher
      const scope = yield* Scope.make()
      const search = yield* searcher.open.pipe(Scope.extend(scope))
      expect((yield* search.ask).trial).toBe(1)
      const closing = yield* Effect.fork(Scope.close(scope, Exit.void))
      yield* TestClock.adjust(Duration.subtract(answerWithin, Duration.millis(1)))
      expect(Arr.last(yield* Ref.get(spawns.requests))).toEqual(
        Option.some(new CloseSearch({ search: PlaceSearchId.make(1) }))
      )
      expect(yield* closing.poll).toEqual(Option.none())
      yield* TestClock.adjust(Duration.millis(1))
      expect(yield* closing.poll).toEqual(Option.some(Exit.void))
      // The worker fell silent, so it is gone: ended, and the next search spawns another.
      expect(yield* Ref.get(spawns.ended)).toBe(1)
      // The next worker answers the same way, so its search's close is given up on at the bound too.
      const nextOpen = yield* Effect.fork(Effect.scoped(Effect.flatMap(searcher.open, (opened) => opened.ask)))
      yield* TestClock.adjust(answerWithin)
      expect((yield* nextOpen).trial).toBe(2)
      expect(yield* Ref.get(spawns.spawned)).toBe(2)
      expect(yield* Ref.get(spawns.ended)).toBe(2)
    }).pipe(Effect.provide(searcherWith("never-closing"))))

  it.effect("a worker that fails after opening is forgotten at once, and closing the search asks nothing of it", () =>
    Effect.gen(function*() {
      const spawns = yield* Spawns
      const searcher = yield* PlaceSearcher
      const scope = yield* Scope.make()
      const search = yield* searcher.open.pipe(Scope.extend(scope))
      expect(Exit.isFailure(yield* Effect.exit(search.ask))).toBe(true)
      expect(yield* Ref.get(spawns.ended)).toBe(1)
      // The worker is gone; a close posted to it would never be answered. None is posted, and the scope closes at once.
      const closing = yield* Effect.fork(Scope.close(scope, Exit.void))
      yield* TestClock.adjust(Duration.millis(1))
      expect(yield* closing.poll).toEqual(Option.some(Exit.void))
      expect(yield* Ref.get(spawns.requests)).toEqual([
        new OpenSearch(),
        new AskSearch({ search: PlaceSearchId.make(1) })
      ])
      expect(yield* Ref.get(spawns.ended)).toBe(1)
    }).pipe(Effect.provide(searcherWith("failing-asks"))))

  it.effect("two searches open at once are told apart on the one worker", () =>
    Effect.gen(function*() {
      const searcher = yield* PlaceSearcher
      const first = yield* searcher.open
      const second = yield* searcher.open
      expect((yield* first.ask).trial).toBe(1)
      expect((yield* second.ask).trial).toBe(2)
      expect((yield* first.ask).trial).toBe(1)
    }).pipe(Effect.scoped, Effect.provide(searcherWith("answering"))))
})
