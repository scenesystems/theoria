import { describe, expect, it } from "@effect/vitest"
import { Deferred, Effect, Exit, Layer, Ref, Scope } from "effect"
import * as Arr from "effect/Array"

import { measuredFont } from "../../app/contracts/text.js"
import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"
import * as BrowserFonts from "../../app/web/platform/BrowserFonts.js"
import { browserTextLayoutLayer, FontReadiness, servedFacesWatched } from "../../app/web/text/browserTextLayout.js"

/**
 * The layout measures in the face the document shows now — the served face
 * when it is in hand, the metric-matched stand-in while it is in flight — and
 * is never held for a face. A face that arrives after the layout was built is
 * told to whoever provided the readiness, whose part it is to build the
 * layout again at the next revision; the layout itself only watches, for as
 * long as it lives.
 */

/** Fonts every one of which is in hand: nothing is in flight, so nothing is ever asked to load. */
const fontsAtHand = (asked: Ref.Ref<ReadonlyArray<string>>) =>
  Layer.succeed(BrowserFonts.BrowserFonts, {
    inHand: () => Effect.succeed(true),
    load: (font) => Ref.update(asked, Arr.append(font))
  })

/** Fonts still in flight: none in hand, each landing when `landed` for it is, or failing when it is told to. */
const fontsInFlight = (
  asked: Ref.Ref<ReadonlyArray<string>>,
  landing: (font: string) => Effect.Effect<void, BrowserFonts.FontLoadFailed>
) =>
  Layer.succeed(BrowserFonts.BrowserFonts, {
    inHand: () => Effect.succeed(false),
    load: (font) => Ref.update(asked, Arr.append(font)).pipe(Effect.andThen(landing(font)))
  })

/** A readiness at revision 0 that counts how often it is told of an arrival. */
const readinessTold = (told: Ref.Ref<number>) =>
  Layer.succeed(FontReadiness, { revision: 0, facesArrived: Ref.update(told, (count) => count + 1) })

const failing = (font: string) => new BrowserFonts.FontLoadFailed({ font, message: "network" })

describe("browser text layout", () => {
  it.effect("a document without a 2D canvas fails the layout layer with CanvasUnavailable, not an estimate", () =>
    Effect.gen(function*() {
      const asked = yield* Ref.make<ReadonlyArray<string>>([])
      const told = yield* Ref.make(0)
      const failure = yield* Effect.flip(Layer.build(browserTextLayoutLayer)).pipe(
        Effect.scoped,
        Effect.provide(Layer.mergeAll(BrowserDocument.layer, fontsAtHand(asked), readinessTold(told)))
      )

      expect(failure).toBeInstanceOf(BrowserDocument.CanvasUnavailable)
    }))

  it.effect("faces in flight do not hold the layout: it goes on at once to the document's canvas", () =>
    Effect.gen(function*() {
      const asked = yield* Ref.make<ReadonlyArray<string>>([])
      const told = yield* Ref.make(0)
      // A face that never lands would have held the layout for the page's life; the layer reaches its canvas regardless.
      const failure = yield* Effect.flip(Layer.build(browserTextLayoutLayer)).pipe(
        Effect.scoped,
        Effect.provide(
          Layer.mergeAll(BrowserDocument.layer, fontsInFlight(asked, () => Effect.never), readinessTold(told))
        )
      )

      expect(failure).toBeInstanceOf(BrowserDocument.CanvasUnavailable)
    }))

  it.effect("with every served face in hand, nothing is asked to load and no arrival is told", () =>
    Effect.gen(function*() {
      const asked = yield* Ref.make<ReadonlyArray<string>>([])
      const told = yield* Ref.make(0)
      yield* servedFacesWatched.pipe(
        Effect.scoped,
        Effect.provide(Layer.merge(fontsAtHand(asked), readinessTold(told)))
      )
      yield* Effect.yieldNow()

      expect(yield* Ref.get(asked)).toEqual([])
      expect(yield* Ref.get(told)).toBe(0)
    }))

  it.effect("faces in flight are asked for at once, and their arrival is told once, when the last of them lands", () =>
    Effect.gen(function*() {
      const asked = yield* Ref.make<ReadonlyArray<string>>([])
      const told = yield* Ref.make(0)
      const body = yield* Deferred.make<void>()
      const mono = yield* Deferred.make<void>()
      const landing = (font: string) => Deferred.await(font === measuredFont("body") ? body : mono)
      const scope = yield* Scope.make()
      yield* servedFacesWatched.pipe(
        Scope.extend(scope),
        Effect.provide(Layer.merge(fontsInFlight(asked, landing), readinessTold(told)))
      )
      yield* Effect.repeat(Ref.get(asked), { until: (fonts) => fonts.length === 2 })
      expect(yield* Ref.get(asked)).toEqual([measuredFont("body"), measuredFont("mono")])

      // The watch does not hold the layout: it returned with the faces still in flight, and nothing is told yet.
      yield* Deferred.succeed(body, undefined)
      yield* Effect.yieldNow()
      expect(yield* Ref.get(told)).toBe(0)

      yield* Deferred.succeed(mono, undefined)
      yield* Effect.repeat(Ref.get(told), { until: (count) => count > 0 })
      yield* Effect.yieldNow()
      expect(yield* Ref.get(told)).toBe(1)
      yield* Scope.close(scope, Exit.void)
    }))

  it.effect("a face that fails while another lands is noted, and the arrival still told: the document swapped a face", () =>
    Effect.gen(function*() {
      const asked = yield* Ref.make<ReadonlyArray<string>>([])
      const told = yield* Ref.make(0)
      const landing = (font: string) => (font === measuredFont("body") ? Effect.void : failing(font))
      const scope = yield* Scope.make()
      yield* servedFacesWatched.pipe(
        Scope.extend(scope),
        Effect.provide(Layer.merge(fontsInFlight(asked, landing), readinessTold(told)))
      )
      yield* Effect.repeat(Ref.get(told), { until: (count) => count > 0 })

      expect(yield* Ref.get(told)).toBe(1)
      yield* Scope.close(scope, Exit.void)
    }))

  it.effect("faces that all fail to load are not an arrival: the document keeps its stand-ins, and so does the layout", () =>
    Effect.gen(function*() {
      const asked = yield* Ref.make<ReadonlyArray<string>>([])
      const told = yield* Ref.make(0)
      const scope = yield* Scope.make()
      yield* servedFacesWatched.pipe(
        Scope.extend(scope),
        Effect.provide(Layer.merge(fontsInFlight(asked, failing), readinessTold(told)))
      )
      yield* Effect.repeat(Ref.get(asked), { until: (fonts) => fonts.length === 2 })
      yield* Effect.yieldNow()
      yield* Effect.yieldNow()

      expect(yield* Ref.get(told)).toBe(0)
      yield* Scope.close(scope, Exit.void)
    }))

  it.effect("the watch lives as long as the layout: faces landing after it is gone are told to nobody", () =>
    Effect.gen(function*() {
      const asked = yield* Ref.make<ReadonlyArray<string>>([])
      const told = yield* Ref.make(0)
      const landed = yield* Deferred.make<void>()
      const scope = yield* Scope.make()
      yield* servedFacesWatched.pipe(
        Scope.extend(scope),
        Effect.provide(Layer.merge(fontsInFlight(asked, () => Deferred.await(landed)), readinessTold(told)))
      )
      yield* Effect.repeat(Ref.get(asked), { until: (fonts) => fonts.length === 2 })
      yield* Scope.close(scope, Exit.void)

      yield* Deferred.succeed(landed, undefined)
      yield* Effect.yieldNow()
      yield* Effect.yieldNow()
      expect(yield* Ref.get(told)).toBe(0)
    }))
})
