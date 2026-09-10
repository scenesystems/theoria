import { type WorkerError, WorkerRunner } from "@effect/platform"
import { Data, Effect, Exit, HashMap, Layer, Option, Ref, Scope } from "effect"

import type { Errors } from "@scenesystems/effect-search"

import {
  type AskedMeander,
  PlaceSearchFailed,
  PlaceSearchId,
  PlaceSearchRequest
} from "../../contracts/demo/imagined-place-search.js"

/**
 * The worker's table of open studies: one per open search, each in its own
 * scope, answering the page's `PlaceSearchRequest`s ask by ask. The study
 * opener is given, so the table's keeping and letting go can be checked
 * without a sampler: a study that fails to open, or whose opening the page
 * gives up on, is closed with its scope and never kept; every study still
 * open when the worker is let go is closed with it.
 */

/** A study as the table needs it: asked for its next meander, told what a trial scored. */
export class OpenedStudy extends Data.Class<{
  readonly ask: Effect.Effect<AskedMeander, Errors.SearchError>
  readonly tell: (trial: number, loss: number) => Effect.Effect<void, Errors.SearchError>
}> {}

/** The table's face to the worker runner. */
export class Studies extends Data.Class<{
  readonly open: Effect.Effect<PlaceSearchId, PlaceSearchFailed>
  readonly ask: (search: PlaceSearchId) => Effect.Effect<AskedMeander, PlaceSearchFailed>
  readonly tell: (search: PlaceSearchId, trial: number, loss: number) => Effect.Effect<void, PlaceSearchFailed>
  readonly close: (search: PlaceSearchId) => Effect.Effect<void, PlaceSearchFailed>
  /** How many studies the table holds open. */
  readonly openCount: Effect.Effect<number>
}> {}

/** A study kept open, and the scope it lives in, closed with `CloseSearch`. */
class Kept extends Data.Class<{
  readonly study: OpenedStudy
  readonly scope: Scope.CloseableScope
}> {}

const failed = (cause: unknown) => new PlaceSearchFailed({ message: String(cause) })

const unknownSearch = (search: PlaceSearchId) => new PlaceSearchFailed({ message: `no open search ${String(search)}` })

/** The table, closing every study it still holds when the given scope closes. */
export const make = <R>(
  openStudy: Effect.Effect<OpenedStudy, Errors.SearchError, Scope.Scope | R>
): Effect.Effect<Studies, never, Scope.Scope | R> =>
  Effect.gen(function*() {
    const kept = yield* Ref.make(HashMap.empty<PlaceSearchId, Kept>())
    const named = yield* Ref.make(0)
    const context = yield* Effect.context<R>()

    yield* Effect.addFinalizer(() =>
      Effect.flatMap(
        Ref.get(kept),
        (all) => Effect.forEach(HashMap.values(all), (study) => Scope.close(study.scope, Exit.void), { discard: true })
      )
    )

    const found = (search: PlaceSearchId): Effect.Effect<Kept, PlaceSearchFailed> =>
      Effect.flatMap(Ref.get(kept), (all) =>
        Option.match(HashMap.get(all, search), {
          onNone: () => Effect.fail(unknownSearch(search)),
          onSome: Effect.succeed
        }))

    // A study is opened in its own scope and kept in one step: one that
    // fails to open, or whose opening is given up on, is closed with its
    // scope and never kept; one kept is kept before anything can interrupt.
    const open: Effect.Effect<PlaceSearchId, PlaceSearchFailed> = Effect.uninterruptibleMask((restore) =>
      Effect.gen(function*() {
        const scope = yield* Scope.make()
        const study = yield* restore(openStudy.pipe(Scope.extend(scope), Effect.provide(context))).pipe(
          Effect.mapError(failed),
          Effect.onExit((exit) => Exit.isSuccess(exit) ? Effect.void : Scope.close(scope, exit))
        )
        const search = PlaceSearchId.make(yield* Ref.updateAndGet(named, (count) => count + 1))
        yield* Ref.update(kept, HashMap.set(search, new Kept({ study, scope })))
        return search
      })
    )

    const ask = (search: PlaceSearchId) =>
      Effect.flatMap(found(search), (held) => held.study.ask.pipe(Effect.mapError(failed)))

    const tell = (search: PlaceSearchId, trial: number, loss: number) =>
      Effect.flatMap(found(search), (held) => held.study.tell(trial, loss).pipe(Effect.mapError(failed)))

    const close = (search: PlaceSearchId) =>
      Effect.gen(function*() {
        const held = yield* found(search)
        yield* Ref.update(kept, HashMap.remove(search))
        yield* Scope.close(held.scope, Exit.void)
      })

    return new Studies({ open, ask, tell, close, openCount: Effect.map(Ref.get(kept), HashMap.size) })
  })

/** The worker runner answering the page's requests from the table. */
export const layer = (
  openStudy: Effect.Effect<OpenedStudy, Errors.SearchError, Scope.Scope>
): Layer.Layer<never, WorkerError.WorkerError, WorkerRunner.PlatformRunner> =>
  Layer.unwrapScoped(
    Effect.map(make(openStudy), (studies) =>
      WorkerRunner.layerSerialized(PlaceSearchRequest, {
        OpenSearch: () => studies.open,
        AskSearch: (request) => studies.ask(request.search),
        TellSearch: (request) => studies.tell(request.search, request.trial, request.loss),
        CloseSearch: (request) => studies.close(request.search)
      }))
  )

export const PlaceSearchStudies = { make, layer }
