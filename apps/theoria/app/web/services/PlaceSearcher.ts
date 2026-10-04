import {
  Boolean as Bool,
  Context,
  Data,
  Deferred,
  Duration,
  Effect,
  Equal,
  Exit,
  Fiber,
  Layer,
  Option,
  Predicate,
  Schema,
  Scope,
  SynchronizedRef
} from "effect"
import { RpcClient } from "effect/rpc"
import type { RpcClientError } from "effect/rpc/RpcClientError"
import * as Worker from "effect/workers/Worker"
import type { WorkerError } from "effect/workers/WorkerError"

import type { AskedMeander, PlaceSearchFailed } from "../../contracts/demo/imagined-place-search.js"
import { PlaceSearchRequest } from "../../contracts/demo/imagined-place-search.js"
import * as PlaceSearchWorker from "../platform/PlaceSearchWorker.js"

export class PlaceSearchUnanswered
  extends Schema.TaggedError<PlaceSearchUnanswered>("@theoria/app/web/services/PlaceSearcher/Unanswered")(
    "PlaceSearchUnanswered",
    { request: Schema.String, after: Schema.Duration }
  )
{}

export type PlaceSearchError = PlaceSearchFailed | PlaceSearchUnanswered | RpcClientError | WorkerError

export const answerWithin: Duration.Duration = Duration.seconds(3)
export const bootWithin: Duration.Duration = Duration.seconds(10)

export const workerGone: Predicate.Predicate<PlaceSearchError> = Predicate.not(Predicate.isTagged("PlaceSearchFailed"))

export class OpenedPlaceSearch extends Data.Class<{
  readonly ask: Effect.Effect<AskedMeander, PlaceSearchError>
  readonly tell: (trial: number, loss: number) => Effect.Effect<void, PlaceSearchError>
}> {}

const clientEffect = RpcClient.make(PlaceSearchRequest)
type SearchClient = Effect.Success<typeof clientEffect>

class Kept extends Data.Class<{
  readonly client: Fiber.Fiber<SearchClient, SpawnError>
  readonly generation: number
  readonly scope: Scope.Closeable
}> {}

type Spawned = readonly [use: Kept, remember: Option.Option<Kept>]
type SpawnError = WorkerError | PlaceSearchUnanswered

const make = Effect.gen(function*() {
  const scope = yield* Effect.scope
  const platform = yield* Effect.map(
    Effect.context<Worker.WorkerPlatform | Worker.Spawner>(),
    Context.pick(Worker.WorkerPlatform, Worker.Spawner)
  )
  const originalPlatform = yield* Worker.WorkerPlatform
  const kept = yield* SynchronizedRef.make(Option.none<Kept>())
  const generation = yield* SynchronizedRef.make(0)

  const spawn = Effect.gen(function*() {
    const forked = yield* Scope.fork(scope, "sequential")
    const ready = yield* Deferred.make<void>()
    const wrapWorker = <O, I>(backing: Worker.Worker<O, I>): Worker.Worker<O, I> => ({
      send: backing.send,
      run: (handler, options) =>
        backing.run(handler, {
          onSpawn: Effect.andThen(options?.onSpawn ?? Effect.void, Deferred.succeed(ready, undefined))
        })
    })
    const readyPlatform = Worker.WorkerPlatform.of({
      spawn: <O, I>(id: number) => originalPlatform.spawn<O, I>(id).pipe(Effect.map(wrapWorker))
    })
    const nextGeneration = yield* SynchronizedRef.updateAndGet(generation, (value) => value + 1)
    const acquire = Effect.gen(function*() {
      const protocol = yield* Layer.build(RpcClient.layerProtocolWorker({ size: 1 }))
      const rpc = yield* clientEffect.pipe(Effect.provide(protocol))
      // The protocol receiver is forked lazily; register it before the first request can fail.
      yield* Effect.yieldNow
      return rpc
    }).pipe(
      Effect.provideService(Worker.WorkerPlatform, readyPlatform),
      Effect.provide(platform),
      Scope.provide(forked),
      Effect.tap(() => Deferred.await(ready)),
      Effect.timeoutOrElse({
        duration: bootWithin,
        orElse: () => Effect.fail(new PlaceSearchUnanswered({ request: "spawn", after: bootWithin }))
      }),
      Effect.onError((cause) => Scope.close(forked, Exit.failCause(cause)))
    )
    const client = yield* Effect.forkIn(acquire, forked, { startImmediately: true })
    return new Kept({ client, generation: nextGeneration, scope: forked })
  })

  const client: Effect.Effect<Kept> = SynchronizedRef.modifyEffect(
    kept,
    (current) =>
      Option.match(current, {
        onSome: (found): Effect.Effect<Spawned> => Effect.succeed([found, current]),
        onNone: (): Effect.Effect<Spawned> => Effect.map(spawn, (found) => [found, Option.some(found)])
      })
  ).pipe(Effect.uninterruptible)

  yield* client

  const forget = (gone: Kept): Effect.Effect<void> =>
    SynchronizedRef.updateEffect(
      kept,
      (current) =>
        Bool.match(Option.exists(current, (found) => Equal.equals(found.generation, gone.generation)), {
          onTrue: () => Effect.as(Scope.close(gone.scope, Exit.void), Option.none()),
          onFalse: () => Effect.succeed(current)
        })
    )

  const stillKept = (on: Kept): Effect.Effect<boolean> =>
    Effect.map(
      SynchronizedRef.get(kept),
      Option.exists((found) => Equal.equals(found.generation, on.generation))
    )

  const answered = <A>(
    on: Kept,
    request: string,
    answer: Effect.Effect<A, PlaceSearchError>
  ): Effect.Effect<A, PlaceSearchError> =>
    Effect.interruptible(answer).pipe(
      Effect.timeoutOrElse({
        duration: answerWithin,
        orElse: () => Effect.fail(new PlaceSearchUnanswered({ request, after: answerWithin }))
      }),
      Effect.tapError((error) => Effect.when(forget(on), Effect.succeed(workerGone(error))))
    )

  const open: Effect.Effect<OpenedPlaceSearch, PlaceSearchError, Scope.Scope> = Effect.uninterruptibleMask(
    (restore) =>
      Effect.gen(function*() {
        const found = yield* restore(client)
        const rpc = yield* restore(Fiber.join(found.client)).pipe(Effect.onError(() => forget(found)))
        const search = yield* restore(answered(found, "OpenSearch", rpc.OpenSearch({}))).pipe(
          Effect.onInterrupt(() => forget(found))
        )
        yield* Effect.addFinalizer(() =>
          Effect.when(
            Effect.ignore(answered(found, "CloseSearch", rpc.CloseSearch({ search }))),
            stillKept(found)
          )
        )
        return new OpenedPlaceSearch({
          ask: answered(found, "AskSearch", rpc.AskSearch({ search })),
          tell: (trial, loss) => answered(found, "TellSearch", rpc.TellSearch({ search, trial, loss }))
        })
      })
  )

  return { open }
})

export class PlaceSearcher extends Context.Service<PlaceSearcher, Effect.Success<typeof make>>()(
  "@theoria/app/web/services/PlaceSearcher"
) {
  static readonly DefaultWithoutDependencies = Layer.effect(PlaceSearcher, make)
  static readonly Default = PlaceSearcher.DefaultWithoutDependencies.pipe(Layer.provide(PlaceSearchWorker.layer))
}
