import { describe, expect, it } from "@effect/vitest"
import { Deferred, Effect, Exit, Fiber, Number as Num, Ref, Schema, Scope } from "effect"
import * as Arr from "effect/Array"

import * as SearchError from "@scenesystems/effect-search/SearchError"

import { AskedMeander, PlaceSearchFailed, type PlaceSearchId } from "../../app/contracts/demo/imagined-place-search.js"
import { OpenedStudy, PlaceSearchStudies } from "../../app/web/services/PlaceSearchStudies.js"

/**
 * The worker's table of open studies, checked against a study opener that
 * only records what happened to it: a study that fails to open, or whose
 * opening the page gives up on, is let go with its scope and never kept; one
 * kept answers asks under its own name until it is closed; every study still
 * open when the worker is let go is closed with it.
 */

/** A loss told to one study. */
const Told = Schema.Struct({ study: Schema.Number, trial: Schema.Number, loss: Schema.Number })
type Told = typeof Told.Type

/** What the fake opener saw: studies opened, study scopes closed, and every loss told. */
class Openings extends Effect.Service<Openings>()("test/Openings", {
  effect: Effect.all({ opened: Ref.make(0), closed: Ref.make(0), told: Ref.make(Arr.empty<Told>()) })
}) {}

const meander = { edge: 0.7, swing: 0.1, phase: 0, turns: 1, top: 0.2, step: 0.1 }

/** An opener whose study answers every ask with its own number, so asks are seen to reach the study asked. */
const openingStudies: Effect.Effect<OpenedStudy, SearchError.SearchError, Scope.Scope | Openings> = Effect.gen(
  function*() {
    const openings = yield* Openings
    const number = yield* Ref.updateAndGet(openings.opened, Num.increment)
    yield* Effect.addFinalizer(() => Ref.update(openings.closed, Num.increment))
    return new OpenedStudy({
      ask: Effect.succeed(new AskedMeander({ trial: number, meander })),
      tell: (trial, loss) => Ref.update(openings.told, Arr.append({ study: number, trial, loss }))
    })
  }
)

const refusing = Effect.fail(new SearchError.InvalidSearchSpace({ reason: "no room for a study" }))

/** An opener that registers its finalizer, then waits on the gate before returning the study. */
const gatedBy = (gate: Deferred.Deferred<void>) =>
  Effect.gen(function*() {
    const openings = yield* Openings
    yield* Effect.addFinalizer(() => Ref.update(openings.closed, Num.increment))
    yield* Deferred.await(gate)
    return yield* openingStudies
  })

/** An opener whose study takes its time letting go: its finalizer waits on the gate before counting itself closed. */
const slowToLetGo = (gate: Deferred.Deferred<void>) =>
  Effect.gen(function*() {
    const openings = yield* Openings
    yield* Effect.addFinalizer(() => Effect.zipRight(Deferred.await(gate), Ref.update(openings.closed, Num.increment)))
    return yield* openingStudies
  })

const failure = (search: PlaceSearchId) => new PlaceSearchFailed({ message: `no open search ${String(search)}` })

describe("PlaceSearchStudies", () => {
  it.scoped("a study that opens is asked under its own name, and let go when closed", () =>
    Effect.gen(function*() {
      const openings = yield* Openings
      const studies = yield* PlaceSearchStudies.make(openingStudies)
      const first = yield* studies.open
      const second = yield* studies.open
      expect(first).not.toEqual(second)
      expect((yield* studies.ask(second)).trial).toBe(2)
      expect((yield* studies.ask(first)).trial).toBe(1)
      yield* studies.tell(first, 1, 0.5)
      expect(yield* Ref.get(openings.told)).toEqual([{ study: 1, trial: 1, loss: 0.5 }])
      expect(yield* Ref.get(openings.closed)).toBe(0)
      yield* studies.close(first)
      expect(yield* Ref.get(openings.closed)).toBe(1)
      expect(yield* Effect.flip(studies.ask(first))).toEqual(failure(first))
      expect((yield* studies.ask(second)).trial).toBe(2)
    }).pipe(Effect.provide(Openings.Default)))

  it.scoped("a study that fails to open is let go with its scope, and nothing is kept", () =>
    Effect.gen(function*() {
      const openings = yield* Openings
      const studies = yield* PlaceSearchStudies.make(
        Effect.zipRight(Effect.addFinalizer(() => Ref.update(openings.closed, Num.increment)), refusing)
      )
      const failed = yield* Effect.flip(studies.open)
      expect(failed._tag).toBe("PlaceSearchFailed")
      expect(yield* Ref.get(openings.closed)).toBe(1)
      expect(yield* studies.openCount).toBe(0)
    }).pipe(Effect.provide(Openings.Default)))

  it.scoped("an opening given up on is let go with its scope, and nothing is kept", () =>
    Effect.gen(function*() {
      const openings = yield* Openings
      const gate = yield* Deferred.make<void>()
      const studies = yield* PlaceSearchStudies.make(gatedBy(gate))
      const opening = yield* Effect.fork(studies.open)
      yield* Effect.yieldNow()
      expect(yield* Ref.get(openings.closed)).toBe(0)
      yield* Fiber.interrupt(opening)
      expect(yield* Ref.get(openings.closed)).toBe(1)
      expect(yield* studies.openCount).toBe(0)
    }).pipe(Effect.provide(Openings.Default)))

  it.scoped("a close given up on still lets the study go whole: nothing is forgotten half let go", () =>
    Effect.gen(function*() {
      const openings = yield* Openings
      const gate = yield* Deferred.make<void>()
      const studies = yield* PlaceSearchStudies.make(slowToLetGo(gate))
      const search = yield* studies.open
      const closing = yield* Effect.fork(studies.close(search))
      yield* Effect.yieldNow()
      // The table has let go of the study; its scope is closing, held at the gate.
      expect(yield* studies.openCount).toBe(0)
      expect(yield* Ref.get(openings.closed)).toBe(1)
      const interrupting = yield* Effect.fork(Fiber.interrupt(closing))
      yield* Effect.yieldNow()
      expect(yield* Ref.get(openings.closed)).toBe(1)
      yield* Deferred.succeed(gate, undefined)
      yield* Fiber.join(interrupting)
      expect(yield* Ref.get(openings.closed)).toBe(2)
      expect(yield* studies.openCount).toBe(0)
    }).pipe(Effect.provide(Openings.Default)))

  it.effect("every study still open when the worker is let go is closed with it", () =>
    Effect.gen(function*() {
      const openings = yield* Openings
      const scope = yield* Scope.make()
      const studies = yield* PlaceSearchStudies.make(openingStudies).pipe(Scope.extend(scope))
      yield* studies.open
      yield* studies.open
      const closed = yield* studies.open
      yield* studies.close(closed)
      expect(yield* Ref.get(openings.closed)).toBe(1)
      yield* Scope.close(scope, Exit.void)
      expect(yield* Ref.get(openings.closed)).toBe(3)
    }).pipe(Effect.provide(Openings.Default)))
})
