import { describe, expect, it } from "@effect/vitest"
import { Deferred, Effect, Fiber, Layer, Option, Ref } from "effect"
import * as Arr from "effect/Array"

import { measuredFont } from "../../app/contracts/text.js"
import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"
import * as BrowserFonts from "../../app/web/platform/BrowserFonts.js"
import { browserTextLayoutLayer } from "../../app/web/text/browserTextLayout.js"

/** Fonts that load at once, as a document with every face already in hand. */
const fontsAtHand = Layer.succeed(BrowserFonts.BrowserFonts, { load: () => Effect.void })

describe("browser text layout", () => {
  it.effect("a document without a 2D canvas fails the layout layer with CanvasUnavailable, not an estimate", () =>
    Effect.gen(function*() {
      const failure = yield* Effect.flip(Layer.build(browserTextLayoutLayer))

      expect(failure).toBeInstanceOf(BrowserDocument.CanvasUnavailable)
    }).pipe(Effect.scoped, Effect.provide(Layer.merge(BrowserDocument.layer, fontsAtHand))))

  it.effect("measures nothing until the served faces have loaded, and asks for exactly those", () =>
    Effect.gen(function*() {
      const landed = yield* Deferred.make<void>()
      const asked = yield* Ref.make<ReadonlyArray<string>>([])
      const fontsInFlight = Layer.succeed(BrowserFonts.BrowserFonts, {
        load: (font) => Ref.update(asked, Arr.append(font)).pipe(Effect.andThen(Deferred.await(landed)))
      })
      const building = yield* Effect.fork(
        Effect.flip(Layer.build(browserTextLayoutLayer)).pipe(Effect.scoped, Effect.provide(fontsInFlight))
      )

      // The faces are asked for, and while they are in flight nothing is measured: the layer is not built.
      yield* Effect.repeat(Ref.get(asked), { until: (fonts) => fonts.length > 0 })
      yield* Effect.yieldNow()
      expect(Option.isNone(yield* Fiber.poll(building))).toBe(true)
      expect(yield* Ref.get(asked)).toEqual([measuredFont("body"), measuredFont("mono")])

      yield* Deferred.succeed(landed, undefined)
      // Once they land the layer goes on to its canvas — which this headless document has none of.
      expect(yield* Fiber.join(building)).toBeInstanceOf(BrowserDocument.CanvasUnavailable)
    }).pipe(Effect.provide(BrowserDocument.layer)))

  it.effect("a face that fails to load is not fatal: text is measured in what the document shows instead", () =>
    Effect.gen(function*() {
      const fontsFailing = Layer.succeed(BrowserFonts.BrowserFonts, {
        load: (font) => new BrowserFonts.FontLoadFailed({ font, message: "network" })
      })
      const failure = yield* Effect.flip(Layer.build(browserTextLayoutLayer)).pipe(
        Effect.scoped,
        Effect.provide(fontsFailing)
      )

      expect(failure).toBeInstanceOf(BrowserDocument.CanvasUnavailable)
    }).pipe(Effect.provide(BrowserDocument.layer)))
})
