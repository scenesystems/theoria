import { Text } from "@scenesystems/effect-text"
import * as Browser from "@scenesystems/effect-text/browser"
import * as Contracts from "@scenesystems/effect-text/contracts"
import { Effect, Layer } from "effect"

import { measuredFont } from "../../contracts/text.js"
import * as BrowserDocument from "../platform/BrowserDocument.js"
import * as BrowserFonts from "../platform/BrowserFonts.js"

export const browserSupportProfile = Browser.DefaultBrowserSupportProfile
export const browserSupportProfileId = browserSupportProfile.id
export const browserFontReadinessRevision = Browser.initialFontReadinessRevision()
export const browserEngineProfile = browserSupportProfile.engineProfile

/** The text services every measurement and layout in the app runs against. */
export type BrowserTextLayout = Contracts.WordSegmenter | Contracts.MeasurementCache | Contracts.EngineProfile

/**
 * Text layout measured by the deterministic estimator instead of a canvas.
 * For hosts without a document, headless test documents among them; the
 * app's runtime never falls back to it.
 */
export const deterministicTextLayoutLive: Layer.Layer<BrowserTextLayout> = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.HyphenationDictionaryLive(),
  Layer.succeed(Contracts.EngineProfile, browserEngineProfile),
  Text.TextMeasurerLive,
  Text.MeasurementCacheLive.pipe(Layer.provide(Text.TextMeasurerLive))
)

const canvasTextLayoutLayer = (context: CanvasRenderingContext2D): Layer.Layer<BrowserTextLayout> => {
  const canvasMeasurer = Browser.CanvasTextMeasurerLive({ context })

  return Layer.mergeAll(
    Text.WordSegmenterLive,
    Text.HyphenationDictionaryLive(),
    Layer.succeed(Contracts.EngineProfile, browserEngineProfile),
    canvasMeasurer,
    Browser.BrowserMeasurementCacheLive({
      fontReadinessRevision: browserFontReadinessRevision,
      profileId: browserSupportProfileId
    }).pipe(Layer.provide(canvasMeasurer))
  )
}

/**
 * Waits for the served faces the layout measures in. Widths measured before
 * they arrive are the stand-in's, and the cache would keep them for the
 * page's life. A face that fails to load is noted and the page is measured
 * in the stand-in it shows, whose metrics are matched to the served face.
 */
const servedFacesLoaded: Effect.Effect<void, never, BrowserFonts.BrowserFonts> = Effect.flatMap(
  BrowserFonts.BrowserFonts,
  (fonts) =>
    Effect.forEach([measuredFont("body"), measuredFont("mono")], (font) =>
      fonts.load(font).pipe(
        Effect.catchTag("FontLoadFailed", (failed) =>
          Effect.logWarning("A served face did not load; text is measured in its stand-in").pipe(
            Effect.annotateLogs({ font: failed.font, reason: failed.message })
          ))
      ), { concurrency: "unbounded", discard: true })
)

/**
 * Text layout measured on the document's 2D canvas, in the document's own
 * fonts once they are loaded. A document that cannot supply a canvas fails
 * the layer with `CanvasUnavailable`; nothing is estimated in its place.
 * Build it once per runtime so the measurement cache is shared across every
 * layout.
 */
export const browserTextLayoutLayer: Layer.Layer<
  BrowserTextLayout,
  BrowserDocument.CanvasUnavailable,
  BrowserDocument.BrowserDocument | BrowserFonts.BrowserFonts
> = Layer.unwrapEffect(
  servedFacesLoaded.pipe(Effect.andThen(BrowserDocument.canvasContext2d), Effect.map(canvasTextLayoutLayer))
)

/** The canvas layout layer over the ambient document and its fonts. */
export const browserTextLayoutLive: Layer.Layer<BrowserTextLayout, BrowserDocument.CanvasUnavailable> =
  browserTextLayoutLayer.pipe(
    Layer.provide(BrowserFonts.layer),
    Layer.provide(BrowserDocument.layer)
  )
