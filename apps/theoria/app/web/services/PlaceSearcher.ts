import { Worker, type WorkerError } from "@effect/platform"
import { Data, Effect, Option, type ParseResult, Scope, SynchronizedRef } from "effect"

import type { AskedMeander, PlaceSearchFailed } from "../../contracts/demo/imagined-place-search.js"
import {
  AskSearch,
  CloseSearch,
  OpenSearch,
  type PlaceSearchRequest,
  TellSearch
} from "../../contracts/demo/imagined-place-search.js"
import * as PlaceSearchWorker from "../platform/PlaceSearchWorker.js"

/** Why a search could not go on: the search itself refused, the worker failed, or a message did not decode. */
export type PlaceSearchError = PlaceSearchFailed | WorkerError.WorkerError | ParseResult.ParseError

/** One search, open on the worker: ask for the next meander, tell what it scored. */
export class OpenedPlaceSearch extends Data.Class<{
  readonly ask: Effect.Effect<AskedMeander, PlaceSearchError>
  readonly tell: (trial: number, loss: number) => Effect.Effect<void, PlaceSearchError>
}> {}

type SearchWorker = Worker.SerializedWorker<PlaceSearchRequest>

/** The worker to use, and the worker to remember. */
type Spawned = readonly [use: SearchWorker, remember: Option.Option<SearchWorker>]

const make = Effect.gen(function*() {
  const scope = yield* Effect.scope
  const platform = yield* Effect.context<Worker.WorkerManager | Worker.Spawner>()
  const spawned = yield* SynchronizedRef.make(Option.none<SearchWorker>())

  // One worker for the page, spawned the first time a search opens and kept
  // for every search after; a spawn that fails is tried again next time.
  const worker: Effect.Effect<SearchWorker, WorkerError.WorkerError> = SynchronizedRef.modifyEffect(
    spawned,
    (current) =>
      Option.match(current, {
        onSome: (found): Effect.Effect<Spawned, WorkerError.WorkerError> => Effect.succeed([found, current]),
        onNone: (): Effect.Effect<Spawned, WorkerError.WorkerError> =>
          Worker.makeSerialized<PlaceSearchRequest>({}).pipe(
            Scope.extend(scope),
            Effect.provide(platform),
            Effect.map((found) => [found, Option.some(found)])
          )
      })
  )

  const open: Effect.Effect<OpenedPlaceSearch, PlaceSearchError, Scope.Scope> = Effect.gen(function*() {
    const found = yield* worker
    const search = yield* found.executeEffect(new OpenSearch())
    yield* Effect.addFinalizer(() => Effect.ignore(found.executeEffect(new CloseSearch({ search }))))
    return new OpenedPlaceSearch({
      ask: found.executeEffect(new AskSearch({ search })),
      tell: (trial, loss) => found.executeEffect(new TellSearch({ search, trial, loss }))
    })
  })

  return { open }
})

/**
 * The page's side of the arrangement search (`contracts/demo/imagined-place-search.ts`):
 * opens a search on the search worker and drives it ask by ask, so the
 * sampler's work leaves the thread that draws. The search is open for as
 * long as the scope it was opened in — the render stream's — and closed
 * with it. The production layer spawns the worker through the platform
 * module; another layer can answer the same requests in the thread.
 */
export class PlaceSearcher extends Effect.Service<PlaceSearcher>()("theoria/PlaceSearcher", {
  scoped: make,
  dependencies: [PlaceSearchWorker.layer]
}) {}
