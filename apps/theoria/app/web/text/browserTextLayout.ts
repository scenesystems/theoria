import { Text } from "@scenesystems/effect-text"
import * as Browser from "@scenesystems/effect-text/browser"
import * as Contracts from "@scenesystems/effect-text/contracts"
import { Effect, Layer } from "effect"

import * as BrowserDocument from "../platform/BrowserDocument.js"

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
 * Text layout measured on the document's 2D canvas, in the document's own
 * fonts. A document that cannot supply one fails the layer with
 * `CanvasUnavailable`; nothing is estimated in its place. Build it once per
 * runtime so the measurement cache is shared across every layout.
 */
export const browserTextLayoutLayer: Layer.Layer<
  BrowserTextLayout,
  BrowserDocument.CanvasUnavailable,
  BrowserDocument.BrowserDocument
> = Layer.unwrapEffect(Effect.map(BrowserDocument.canvasContext2d, canvasTextLayoutLayer))

/** The canvas layout layer over the ambient document. */
export const browserTextLayoutLive: Layer.Layer<BrowserTextLayout, BrowserDocument.CanvasUnavailable> =
  browserTextLayoutLayer.pipe(Layer.provide(BrowserDocument.layer))
