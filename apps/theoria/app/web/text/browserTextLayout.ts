import { Text } from "@scenesystems/effect-text"
import * as Browser from "@scenesystems/effect-text/browser"
import * as Contracts from "@scenesystems/effect-text/contracts"
import { Effect, Layer, Option } from "effect"

import * as BrowserDocument from "../platform/BrowserDocument.js"

export const browserSupportProfile = Browser.DefaultBrowserSupportProfile
export const browserSupportProfileId = browserSupportProfile.id
export const browserFontReadinessRevision = Browser.initialFontReadinessRevision()
export const browserEngineProfile = browserSupportProfile.engineProfile

/** The text services every measurement and layout in the app runs against. */
export type BrowserTextLayout = Contracts.WordSegmenter | Contracts.MeasurementCache | Contracts.EngineProfile

const deterministicBrowserTextLayoutLayer: Layer.Layer<BrowserTextLayout> = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.HyphenationDictionaryLive(),
  Layer.succeed(Contracts.EngineProfile, browserEngineProfile),
  Text.TextMeasurerLive,
  Text.MeasurementCacheLive.pipe(Layer.provide(Text.TextMeasurerLive))
)

const canvasBrowserTextLayoutLayer = (context: CanvasRenderingContext2D): Layer.Layer<BrowserTextLayout> => {
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
 * Text layout measured on a 2D canvas when the document provides one, and by
 * the deterministic measurer otherwise (headless hosts, tests). Build it once
 * per runtime so the measurement cache is shared across every layout.
 */
export const browserTextLayoutLayer: Layer.Layer<BrowserTextLayout, never, BrowserDocument.BrowserDocument> = Layer
  .unwrapEffect(
    Effect.map(
      BrowserDocument.canvasContext2d,
      Option.match({
        onNone: () => deterministicBrowserTextLayoutLayer,
        onSome: canvasBrowserTextLayoutLayer
      })
    )
  )

/** The layout layer over the ambient document, for runtimes and tests. */
export const browserTextLayoutLive: Layer.Layer<BrowserTextLayout> = browserTextLayoutLayer.pipe(
  Layer.provide(BrowserDocument.layer)
)
