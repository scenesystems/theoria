import { Worker, type WorkerError } from "@effect/platform"
import {
  Data,
  Duration,
  Effect,
  ExecutionStrategy,
  Exit,
  Option,
  type ParseResult,
  Predicate,
  Schema,
  Scope,
  SynchronizedRef
} from "effect"

import type { AskedMeander, PlaceSearchFailed } from "../../contracts/demo/imagined-place-search.js"
import {
  AskSearch,
  CloseSearch,
  OpenSearch,
  type PlaceSearchRequest,
  TellSearch
} from "../../contracts/demo/imagined-place-search.js"
import * as PlaceSearchWorker from "../platform/PlaceSearchWorker.js"

/**
 * A request the worker never answered. A worker that has closed itself or
 * been reclaimed by the browser says nothing to the page — only a script
 * error is reported — so silence past `after` is how its death is known.
 */
export class PlaceSearchUnanswered extends Schema.TaggedError<PlaceSearchUnanswered>()("PlaceSearchUnanswered", {
  request: Schema.String,
  after: Schema.DurationFromSelf
}) {}

/**
 * Why a search could not go on: the search itself refused, the worker
 * failed, a message did not decode, or the worker never answered.
 */
export type PlaceSearchError =
  | PlaceSearchFailed
  | PlaceSearchUnanswered
  | WorkerError.WorkerError
  | ParseResult.ParseError

/**
 * How long a request may go unanswered before the worker is given up on.
 * A trial is proposed within milliseconds even late in a search, so this is
 * far past any honest answer and well short of a reader giving up.
 */
export const answerWithin: Duration.Duration = Duration.seconds(3)

/**
 * How long a worker may take to boot — its script fetched, its sampler
 * loaded, its readiness posted — before it is given up on. A script that
 * never loads reports only to the console; the platform waits on its
 * readiness without bound, so this bound is the only way its absence is
 * known, and the search is refused instead of the page waiting forever.
 */
export const bootWithin: Duration.Duration = Duration.seconds(10)

/**
 * Whether the error means the worker itself is gone — everything but the
 * search refusing what it was asked, which is the worker answering properly.
 */
export const workerGone: Predicate.Predicate<PlaceSearchError> = Predicate.not(Predicate.isTagged("PlaceSearchFailed"))

/** One search, open on the worker: ask for the next meander, tell what it scored. */
export class OpenedPlaceSearch extends Data.Class<{
  readonly ask: Effect.Effect<AskedMeander, PlaceSearchError>
  readonly tell: (trial: number, loss: number) => Effect.Effect<void, PlaceSearchError>
}> {}

type SearchWorker = Worker.SerializedWorker<PlaceSearchRequest>

/** A worker in use, and the scope that ends it. */
class Kept extends Data.Class<{
  readonly worker: SearchWorker
  readonly scope: Scope.CloseableScope
}> {}

/** The worker to use, and the worker to remember. */
type Spawned = readonly [use: Kept, remember: Option.Option<Kept>]

/** Why no worker could be had: it failed to spawn, or was not ready within the bound. */
type SpawnError = WorkerError.WorkerError | PlaceSearchUnanswered

const make = Effect.gen(function*() {
  const scope = yield* Effect.scope
  const platform = yield* Effect.context<Worker.WorkerManager | Worker.Spawner>()
  const kept = yield* SynchronizedRef.make(Option.none<Kept>())

  // Each worker lives in its own fork of the service's scope, so one can be
  // let go — ended with its thread — while the service goes on. A worker
  // that fails to boot, is not ready within the bound, or is given up on
  // while booting is ended with its fork, so nothing of it is kept.
  const spawn: Effect.Effect<Kept, SpawnError> = Effect.gen(function*() {
    const forked = yield* Scope.fork(scope, ExecutionStrategy.sequential)
    const worker = yield* Worker.makeSerialized<PlaceSearchRequest>({}).pipe(
      Scope.extend(forked),
      Effect.provide(platform),
      Effect.timeoutFail({
        duration: bootWithin,
        onTimeout: () => new PlaceSearchUnanswered({ request: "spawn", after: bootWithin })
      }),
      Effect.onError((cause) => Scope.close(forked, Exit.failCause(cause)))
    )
    return new Kept({ worker, scope: forked })
  })

  // One worker for the page, kept for every search until it fails or falls
  // silent; then the next search spawns another. A spawn that fails is tried
  // again next time.
  const worker: Effect.Effect<Kept, SpawnError> = SynchronizedRef.modifyEffect(
    kept,
    (current) =>
      Option.match(current, {
        onSome: (found): Effect.Effect<Spawned, SpawnError> => Effect.succeed([found, current]),
        onNone: (): Effect.Effect<Spawned, SpawnError> => Effect.map(spawn, (found) => [found, Option.some(found)])
      })
  )

  // The first worker is spawned as the service is, so it is booted — its
  // chunk and its sampler loaded — while the artifact is still on its way,
  // and the first search finds it ready instead of waiting for it. A search
  // that opens meanwhile waits on the same spawn, not a second one.
  yield* Effect.forkIn(Effect.ignore(worker), scope)

  // Forgets a worker that is gone and ends its scope, unless another has
  // already taken its place.
  const forget = (gone: Kept): Effect.Effect<void> =>
    SynchronizedRef.updateEffect(
      kept,
      (current) =>
        Option.exists(current, (found) => found.worker.id === gone.worker.id)
          ? Effect.as(Scope.close(gone.scope, Exit.void), Option.none())
          : Effect.succeed(current)
    )

  // Every request is bounded: a worker that never answers is forgotten, as
  // is one that fails or answers in a shape the page does not know.
  const answered = <A>(
    on: Kept,
    request: PlaceSearchRequest["_tag"],
    answer: Effect.Effect<A, PlaceSearchError>
  ): Effect.Effect<A, PlaceSearchError> =>
    answer.pipe(
      Effect.timeoutFail({
        duration: answerWithin,
        onTimeout: () => new PlaceSearchUnanswered({ request, after: answerWithin })
      }),
      Effect.tapError((error) => (workerGone(error) ? forget(on) : Effect.void))
    )

  // Opening a search and promising to close it are one step: nothing can
  // come between the worker answering with the search and the finalizer
  // that closes it. Waiting on the worker and on its answer stay
  // interruptible — a search given up on while opening must not hold the
  // page — and an open interrupted while the worker may already have the
  // study is resolved by forgetting the worker: its thread ends and takes
  // whatever it had opened, and the next search spawns another.
  const open: Effect.Effect<OpenedPlaceSearch, PlaceSearchError, Scope.Scope> = Effect.uninterruptibleMask(
    (restore) =>
      Effect.gen(function*() {
        const found = yield* restore(worker)
        const search = yield* restore(
          answered(found, "OpenSearch", found.worker.executeEffect(new OpenSearch()))
        ).pipe(Effect.onInterrupt(() => forget(found)))
        yield* Effect.addFinalizer(() =>
          Effect.ignore(answered(found, "CloseSearch", found.worker.executeEffect(new CloseSearch({ search }))))
        )
        return new OpenedPlaceSearch({
          ask: answered(found, "AskSearch", found.worker.executeEffect(new AskSearch({ search }))),
          tell: (trial, loss) =>
            answered(found, "TellSearch", found.worker.executeEffect(new TellSearch({ search, trial, loss })))
        })
      })
  )

  return { open }
})

/**
 * The page's side of the arrangement search (`contracts/demo/imagined-place-search.ts`):
 * opens a search on the search worker and drives it ask by ask, so the
 * sampler's work leaves the thread that draws. The search is open for as
 * long as the scope it was opened in — the render stream's — and closed
 * with it. A worker is ready within `bootWithin` and every request is
 * answered within `answerWithin`, or the worker is taken for gone and the
 * next search spawns a fresh one; the caller decides whether to search
 * again. The production layer spawns the worker through
 * the platform module; another layer can answer the same requests in the
 * thread.
 */
export class PlaceSearcher extends Effect.Service<PlaceSearcher>()("theoria/PlaceSearcher", {
  scoped: make,
  dependencies: [PlaceSearchWorker.layer]
}) {}
