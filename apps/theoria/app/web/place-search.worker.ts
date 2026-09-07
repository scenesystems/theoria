import { WorkerRunner } from "@effect/platform"
import { BrowserRuntime, BrowserWorkerRunner } from "@effect/platform-browser"
import { Study } from "@scenesystems/effect-search"
import { Data, Effect, Exit, HashMap, Layer, Option, Ref, Scope } from "effect"

import {
  AskedMeander,
  meanderSpace,
  PlaceSearchFailed,
  PlaceSearchId,
  PlaceSearchRequest,
  renderSampler,
  renderTrials
} from "../contracts/demo/imagined-place-search.js"

/**
 * The arrangement search's Web Worker: the program root of the thread that
 * hosts the TPE studies, the way `main.tsx` is the page's. It holds one
 * `Study` per open search and answers the page's `PlaceSearchRequest`s ask by
 * ask; the objective is the page's to compute, so the one given here is
 * never invoked (`Study.open` retains it without calling it).
 */

type MeanderSpace = Effect.Effect.Success<typeof meanderSpace>

/** An open study and the scope it lives in, closed with `CloseSearch`. */
class Opened extends Data.Class<{
  readonly handle: Study.StudyHandle<MeanderSpace>
  readonly scope: Scope.CloseableScope
}> {}

const failed = (cause: unknown) => new PlaceSearchFailed({ message: String(cause) })

const unknownSearch = (search: PlaceSearchId) => new PlaceSearchFailed({ message: `no open search ${String(search)}` })

const studies = Effect.gen(function*() {
  const opened = yield* Ref.make(HashMap.empty<PlaceSearchId, Opened>())
  const named = yield* Ref.make(0)
  const space = yield* meanderSpace

  // Every study still open when the worker is let go is closed with it.
  yield* Effect.addFinalizer(() =>
    Effect.flatMap(
      Ref.get(opened),
      (all) => Effect.forEach(HashMap.values(all), (study) => Scope.close(study.scope, Exit.void), { discard: true })
    )
  )

  const found = (search: PlaceSearchId): Effect.Effect<Opened, PlaceSearchFailed> =>
    Effect.flatMap(Ref.get(opened), (all) =>
      Option.match(HashMap.get(all, search), {
        onNone: () => Effect.fail(unknownSearch(search)),
        onSome: Effect.succeed
      }))

  // A study is opened in its own scope and kept in one step: one that
  // fails to open, or whose opening the page gives up on, is closed with its
  // scope and never kept; one kept is kept before anything can interrupt.
  const open: Effect.Effect<PlaceSearchId, PlaceSearchFailed> = Effect.uninterruptibleMask((restore) =>
    Effect.gen(function*() {
      const scope = yield* Scope.make()
      const handle = yield* restore(
        Study.open({
          space,
          sampler: renderSampler(),
          objective: () => Effect.dieMessage("the page scores every trial; the search only proposes them"),
          trials: renderTrials,
          direction: "minimize"
        }).pipe(Scope.extend(scope))
      ).pipe(
        Effect.mapError(failed),
        Effect.onError((cause) => Scope.close(scope, Exit.failCause(cause)))
      )
      const search = yield* Ref.updateAndGet(named, (count) => count + 1)
      yield* Ref.update(opened, HashMap.set(PlaceSearchId.make(search), new Opened({ handle, scope })))
      return PlaceSearchId.make(search)
    })
  )

  const ask = (search: PlaceSearchId): Effect.Effect<AskedMeander, PlaceSearchFailed> =>
    Effect.gen(function*() {
      const study = yield* found(search)
      const asked = yield* Study.ask(study.handle).pipe(Effect.mapError(failed))
      return new AskedMeander({ trial: asked.trialNumber, meander: asked.config })
    })

  const tell = (search: PlaceSearchId, trial: number, loss: number): Effect.Effect<void, PlaceSearchFailed> =>
    Effect.flatMap(found(search), (study) => Study.tell(study.handle, trial, loss).pipe(Effect.mapError(failed)))

  const close = (search: PlaceSearchId): Effect.Effect<void, PlaceSearchFailed> =>
    Effect.gen(function*() {
      const study = yield* found(search)
      yield* Ref.update(opened, HashMap.remove(search))
      yield* Scope.close(study.scope, Exit.void)
    })

  return WorkerRunner.layerSerialized(PlaceSearchRequest, {
    OpenSearch: () => open,
    AskSearch: (request) => ask(request.search),
    TellSearch: (request) => tell(request.search, request.trial, request.loss),
    CloseSearch: (request) => close(request.search)
  })
})

const main = WorkerRunner.launch(Layer.unwrapScoped(studies)).pipe(Effect.provide(BrowserWorkerRunner.layer))

BrowserRuntime.runMain(main)
