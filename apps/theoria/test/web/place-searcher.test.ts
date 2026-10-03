import { describe, expect, it } from "@effect/vitest"
import {
  Context,
  Data,
  Deferred,
  Duration,
  Effect,
  Exit,
  Fiber,
  Layer,
  Match,
  Option,
  Queue,
  Ref,
  Schema,
  Scope
} from "effect"
import * as Arr from "effect/Array"
import { TestClock } from "effect/testing"
import * as Worker from "effect/workers/Worker"
import { WorkerError, WorkerReceiveError } from "effect/workers/WorkerError"

import { AskedMeander, PlaceSearchId } from "../../app/contracts/demo/imagined-place-search.js"
import { answerWithin, bootWithin, PlaceSearcher, PlaceSearchUnanswered } from "../../app/web/services/PlaceSearcher.js"

/**
 * How a worker of the fake manager behaves: never ready, so its spawn never
 * returns; or ready, and answering every request never, by failing as the
 * platform does, or properly, as the search worker does — or properly but
 * for one request: never answering a close, or failing every ask.
 */
type Answering = "unready" | "silent" | "failing" | "answering" | "never-closing" | "failing-asks"

/** What the fake manager saw: workers spawned, workers ended with their scope, and every request posted to one. */
class ObservedRequest extends Data.Class<{
  readonly _tag: "OpenSearch" | "AskSearch" | "TellSearch" | "CloseSearch"
  readonly search: Option.Option<PlaceSearchId>
  readonly trial: Option.Option<number>
  readonly loss: Option.Option<number>
}> {}

class Spawns extends Context.Service<Spawns, {
  readonly spawned: Ref.Ref<number>
  readonly ended: Ref.Ref<number>
  readonly requests: Ref.Ref<ReadonlyArray<ObservedRequest>>
  readonly searches: Ref.Ref<number>
  readonly spawnedOnce: Deferred.Deferred<void>
  readonly requestedOnce: Deferred.Deferred<void>
}>()("test/Spawns") {
  static readonly Default = Layer.effect(
    Spawns,
    Effect.all({
      spawned: Ref.make(0),
      ended: Ref.make(0),
      requests: Ref.make<ReadonlyArray<ObservedRequest>>(Arr.empty()),
      searches: Ref.make(0),
      spawnedOnce: Deferred.make<void>(),
      requestedOnce: Deferred.make<void>()
    })
  )
}

const meander = { edge: 0.7, swing: 0.1, phase: 0, turns: 1, top: 0.2, step: 0.1 }

/**
 * What the search worker puts on the wire for each request, encoded as the
 * worker runner encodes it: a new search's number, a meander with its trial,
 * nothing for a tell or a close. The wire itself carries whatever the
 * request's schema encodes, which the serialized worker decodes.
 */
const answeredOnTheWire = (spawns: Spawns["Service"], request: ObservedRequest): Effect.Effect<unknown> =>
  Match.value(request._tag).pipe(
    Match.when("OpenSearch", () => Ref.updateAndGet(spawns.searches, (count) => count + 1)),
    Match.when(
      "AskSearch",
      () => Effect.succeed(new AskedMeander({ trial: Number(Option.getOrThrow(request.search)), meander }))
    ),
    Match.when("TellSearch", () => Effect.succeed(null)),
    Match.when("CloseSearch", () => Effect.succeed(null)),
    Match.exhaustive
  )

const crashed = new WorkerError({
  reason: new WorkerReceiveError({ message: "the worker crashed" })
})

/** How a worker in one mode answers a request posted to it while it is alive. */
const behaving = (
  answering: Answering,
  spawns: Spawns["Service"],
  request: ObservedRequest
): Effect.Effect<unknown, WorkerError> =>
  Match.value({ answering, request: request._tag }).pipe(
    Match.when({ answering: "failing" }, () => Effect.fail(crashed)),
    Match.when({ answering: "silent" }, () => Effect.never),
    Match.when({ answering: "never-closing", request: "CloseSearch" }, () => Effect.never),
    Match.when({ answering: "failing-asks", request: "AskSearch" }, () => Effect.fail(crashed)),
    Match.orElse(() => answeredOnTheWire(spawns, request).pipe(Effect.orDie))
  )

const SearchPayload = Schema.Struct({ search: PlaceSearchId })
const TellPayload = Schema.Struct({ search: PlaceSearchId, trial: Schema.Int, loss: Schema.Finite })

const observed = (
  _tag: ObservedRequest["_tag"],
  search = Option.none<PlaceSearchId>(),
  trial = Option.none<number>(),
  loss = Option.none<number>()
) => new ObservedRequest({ _tag, search, trial, loss })

const decodeRequest = (tag: string, payload: unknown): Effect.Effect<ObservedRequest> =>
  Match.value(tag).pipe(
    Match.when("OpenSearch", () => Effect.succeed(observed("OpenSearch"))),
    Match.when("AskSearch", () =>
      Schema.decodeUnknownEffect(SearchPayload)(payload).pipe(
        Effect.map((payload) => observed("AskSearch", Option.some(payload.search)))
      )),
    Match.when("TellSearch", () =>
      Schema.decodeUnknownEffect(TellPayload)(payload).pipe(
        Effect.map((payload) =>
          observed(
            "TellSearch",
            Option.some(payload.search),
            Option.some(payload.trial),
            Option.some(payload.loss)
          )
        )
      )),
    Match.when("CloseSearch", () =>
      Schema.decodeUnknownEffect(SearchPayload)(payload).pipe(
        Effect.map((payload) => observed("CloseSearch", Option.some(payload.search)))
      )),
    Match.orElse(() => Effect.die(`unexpected RPC ${tag}`)),
    Effect.orDie
  )

const WorkerInput = Schema.Union([
  Schema.TaggedStruct("Request", {
    id: Schema.Union([Schema.String, Schema.Finite]),
    tag: Schema.String,
    payload: Schema.Unknown,
    headers: Schema.Array(Schema.Tuple([Schema.String, Schema.String]))
  }),
  Schema.TaggedStruct("Ack", {}),
  Schema.TaggedStruct("Interrupt", {}),
  Schema.TaggedStruct("Ping", {}),
  Schema.TaggedStruct("Eof", {}),
  Schema.TaggedStruct("InitialMessage", {})
])

/**
 * A v4 worker transport. It receives RPC request envelopes and sends encoded
 * exits through the callback installed by `Worker.run`, just as the public
 * worker protocol does. Crashes fail that long-lived run rather than an old
 * per-message `executeEffect` call.
 */
const workerLayer = (answering: Answering): Layer.Layer<Worker.WorkerPlatform | Worker.Spawner, never, Spawns> =>
  Layer.merge(
    Layer.effect(
      Worker.WorkerPlatform,
      Effect.map(Spawns, (spawns) =>
        Worker.WorkerPlatform.of({
          spawn: () =>
            Effect.gen(function*() {
              yield* Ref.update(spawns.spawned, (count) => count + 1)
              yield* Deferred.succeed(spawns.spawnedOnce, undefined)
              const responses = yield* Queue.unbounded<Worker.PlatformMessage>()
              if (answering !== "unready") yield* Queue.offer(responses, [0])
              const failed = yield* Deferred.make<never, WorkerError>()
              const worker = Worker.makeUnsafe({
                run: (handler) =>
                  Effect.raceFirst(
                    answering === "unready"
                      ? Effect.never
                      : Queue.take(responses).pipe(Effect.flatMap(handler), Effect.forever),
                    Deferred.await(failed)
                  ).pipe(Effect.ensuring(Ref.update(spawns.ended, (count) => count + 1))),
                send: (input) =>
                  Schema.decodeUnknownEffect(WorkerInput)(input).pipe(
                    Effect.flatMap((message) => {
                      if (message._tag !== "Request") return Effect.void
                      return decodeRequest(message.tag, message.payload).pipe(
                        Effect.tap((request) => Ref.update(spawns.requests, Arr.append(request))),
                        Effect.tap(() => Deferred.succeed(spawns.requestedOnce, undefined)),
                        Effect.flatMap((request) => behaving(answering, spawns, request)),
                        Effect.flatMap((value) =>
                          Queue.offer(responses, [1, {
                            _tag: "Exit",
                            requestId: message.id,
                            exit: { _tag: "Success", value }
                          }])
                        ),
                        Effect.catchCause(() => Deferred.fail(failed, crashed))
                      )
                    }),
                    Effect.orDie,
                    Effect.asVoid
                  )
              })
              return worker
            })
        }))
    ),
    Worker.layerSpawner(() => undefined)
  )

const searcherWith = (answering: Answering) =>
  PlaceSearcher.DefaultWithoutDependencies.pipe(
    Layer.provide(workerLayer(answering)),
    Layer.provideMerge(Spawns.Default)
  )

/** Opens a search and waits out the answer bound, so a silent worker is found out. */
const openPastTheBound = Effect.gen(function*() {
  const spawns = yield* Spawns
  const searcher = yield* PlaceSearcher
  const opened = yield* Effect.forkChild(Effect.exit(Effect.scoped(searcher.open)))
  yield* Deferred.await(spawns.requestedOnce)
  yield* TestClock.adjust(Duration.zero)
  yield* TestClock.adjust(answerWithin)
  return yield* Fiber.join(opened)
})

describe("PlaceSearcher", () => {
  it.effect("a worker that never answers is given up on at the answer bound, with the request named", () =>
    Effect.gen(function*() {
      const spawns = yield* Spawns
      const searcher = yield* PlaceSearcher
      const opened = yield* Effect.forkChild(Effect.exit(Effect.scoped(searcher.open)))
      yield* Deferred.await(spawns.requestedOnce)
      yield* TestClock.adjust(Duration.zero)
      yield* TestClock.adjust(Duration.subtract(answerWithin, Duration.millis(1)))
      expect(Option.fromUndefinedOr(opened.pollUnsafe())).toEqual(Option.none())
      yield* TestClock.adjust(Duration.millis(1))
      const exit = yield* Fiber.join(opened)
      expect(exit).toEqual(Exit.fail(new PlaceSearchUnanswered({ request: "OpenSearch", after: answerWithin })))
    }).pipe(Effect.provide(searcherWith("silent"))))

  it.effect("a timed-out request disposes the pooled worker", () =>
    Effect.gen(function*() {
      const spawns = yield* Spawns
      const searcher = yield* PlaceSearcher
      const opened = yield* Effect.forkChild(Effect.exit(Effect.scoped(searcher.open)))
      yield* Deferred.await(spawns.requestedOnce)
      yield* TestClock.adjust(Duration.zero)
      yield* TestClock.adjust(Duration.subtract(answerWithin, Duration.millis(1)))
      expect(yield* Ref.get(spawns.spawned)).toBe(1)
      expect(yield* Ref.get(spawns.ended)).toBe(0)
      yield* TestClock.adjust(Duration.millis(1))
      yield* Fiber.join(opened)
      expect(yield* Ref.get(spawns.ended)).toBe(1)
    }).pipe(Effect.provide(searcherWith("silent"))))

  it.effect("a worker that is never ready times out at the boot bound", () =>
    Effect.gen(function*() {
      const spawns = yield* Spawns
      const searcher = yield* PlaceSearcher
      const opened = yield* Effect.forkChild(Effect.exit(Effect.scoped(searcher.open)))
      yield* Deferred.await(spawns.spawnedOnce)
      yield* TestClock.adjust(Duration.zero)
      yield* TestClock.adjust(Duration.subtract(bootWithin, Duration.millis(1)))
      expect(yield* Ref.get(spawns.spawned)).toBe(1)
      expect(yield* Ref.get(spawns.requests)).toEqual([])
      yield* TestClock.adjust(Duration.millis(1))
      expect(yield* Fiber.join(opened)).toEqual(
        Exit.fail(new PlaceSearchUnanswered({ request: "spawn", after: bootWithin }))
      )
      expect(yield* Ref.get(spawns.ended)).toBe(1)
    }).pipe(Effect.provide(searcherWith("unready"))))

  it.effect("a search given up on while opening forgets the worker, so nothing it may have opened is kept", () =>
    Effect.gen(function*() {
      const spawns = yield* Spawns
      const searcher = yield* PlaceSearcher
      const opening = yield* Effect.forkChild(Effect.scoped(searcher.open))
      yield* TestClock.adjust(Duration.millis(100))
      expect(yield* Ref.get(spawns.ended)).toBe(0)
      yield* Fiber.interrupt(opening)
      yield* Effect.yieldNow
      expect(yield* Ref.get(spawns.ended)).toBe(1)
      yield* openPastTheBound
      expect(yield* Ref.get(spawns.spawned)).toBe(2)
    }).pipe(Effect.provide(searcherWith("silent"))))

  it.effect("a silent worker is replaced for the next request", () =>
    Effect.gen(function*() {
      const spawns = yield* Spawns
      yield* openPastTheBound
      expect(yield* Ref.get(spawns.spawned)).toBe(1)
      expect(yield* Ref.get(spawns.ended)).toBe(1)
      yield* openPastTheBound
      expect(yield* Ref.get(spawns.spawned)).toBe(2)
      expect(yield* Ref.get(spawns.ended)).toBe(2)
    }).pipe(Effect.provide(searcherWith("silent"))))

  it.effect("a crashed worker is replaced for the next request", () =>
    Effect.gen(function*() {
      const spawns = yield* Spawns
      const searcher = yield* PlaceSearcher
      const opening = yield* Effect.forkChild(Effect.exit(Effect.scoped(searcher.open)))
      yield* TestClock.adjust(Duration.seconds(1))
      const exit = yield* Fiber.join(opening)
      expect(Exit.isFailure(exit)).toBe(true)
      expect(yield* Ref.get(spawns.ended)).toBe(1)
      expect(yield* Ref.get(spawns.spawned)).toBe(1)
      yield* Effect.exit(Effect.scoped(searcher.open))
      expect(yield* Ref.get(spawns.spawned)).toBe(2)
      expect(yield* Ref.get(spawns.ended)).toBe(2)
    }).pipe(Effect.provide(searcherWith("failing"))))

  it.effect("a search that opens asks and tells under its own name, and is closed with the scope it was opened in", () =>
    Effect.gen(function*() {
      const spawns = yield* Spawns
      const searcher = yield* PlaceSearcher
      const scope = yield* Scope.make()
      const search = yield* searcher.open.pipe(Effect.provideService(Scope.Scope, scope))
      const asked = yield* search.ask
      expect(asked.trial).toBe(1)
      yield* search.tell(asked.trial, 0.25)
      expect(yield* Ref.get(spawns.requests)).toEqual([
        observed("OpenSearch"),
        observed("AskSearch", Option.some(PlaceSearchId.make(1))),
        observed(
          "TellSearch",
          Option.some(PlaceSearchId.make(1)),
          Option.some(1),
          Option.some(0.25)
        )
      ])
      yield* Scope.close(scope, Exit.void)
      expect(Arr.last(yield* Ref.get(spawns.requests))).toEqual(
        Option.some(observed("CloseSearch", Option.some(PlaceSearchId.make(1))))
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
      const search = yield* searcher.open.pipe(Effect.provideService(Scope.Scope, scope))
      expect((yield* search.ask).trial).toBe(1)
      const closing = yield* Effect.forkChild(Scope.close(scope, Exit.void))
      yield* TestClock.adjust(Duration.subtract(answerWithin, Duration.millis(1)))
      expect(Arr.last(yield* Ref.get(spawns.requests))).toEqual(
        Option.some(observed("CloseSearch", Option.some(PlaceSearchId.make(1))))
      )
      expect(Option.fromUndefinedOr(closing.pollUnsafe())).toEqual(Option.none())
      yield* TestClock.adjust(Duration.millis(1))
      yield* Fiber.join(closing)
      expect(yield* Ref.get(spawns.ended)).toBe(1)
      expect(yield* Ref.get(spawns.spawned)).toBe(1)
    }).pipe(Effect.provide(searcherWith("never-closing"))))

  it.effect("a scope does not contact a worker known to have crashed", () =>
    Effect.gen(function*() {
      const spawns = yield* Spawns
      const searcher = yield* PlaceSearcher
      const scope = yield* Scope.make()
      const search = yield* searcher.open.pipe(Effect.provideService(Scope.Scope, scope))
      expect(Exit.isFailure(yield* Effect.exit(search.ask))).toBe(true)
      expect(yield* Ref.get(spawns.ended)).toBe(1)
      const closing = yield* Effect.forkChild(Scope.close(scope, Exit.void))
      yield* TestClock.adjust(Duration.millis(1))
      yield* Fiber.join(closing)
      expect(yield* Ref.get(spawns.requests)).toEqual([
        observed("OpenSearch"),
        observed("AskSearch", Option.some(PlaceSearchId.make(1)))
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
