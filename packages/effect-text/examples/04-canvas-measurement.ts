/**
 * Builds an Effect that measures and lays out text with a real browser 2D
 * canvas context. The caller obtains the context from an `HTMLCanvasElement` or
 * `OffscreenCanvas` and owns its lifetime.
 */
import { Effect, Layer, Option, Schema } from "effect"

import { Browser, Contracts, Text } from "@scenesystems/effect-text"

export class CanvasLayoutOptions extends Schema.Class<CanvasLayoutOptions>("effect-text/CanvasLayoutOptions")({
  prepare: Text.PrepareInput,
  request: Text.LayoutRequest,
  profileId: Schema.OptionFromSelf(Browser.BrowserSupportProfileIdSchema),
  fontReadinessRevision: Schema.OptionFromSelf(Browser.FontReadinessRevision),
  emojiCorrection: Schema.OptionFromSelf(Browser.EmojiCorrection)
}) {}

export const layoutCanvasText = (context: Browser.CanvasMeasurementContext, options: CanvasLayoutOptions) => {
  const profile = Option.match(options.profileId, {
    onNone: () => Browser.browserSupportProfile(),
    onSome: Browser.browserSupportProfile
  })
  const emojiCorrectionOptions = Option.match(options.emojiCorrection, {
    onNone: () => ({}),
    onSome: (emojiCorrection) => ({ emojiCorrection })
  })
  const services = Layer.mergeAll(
    Text.WordSegmenterLive,
    Text.HyphenationDictionaryLive(),
    Layer.succeed(Contracts.EngineProfile, profile.engineProfile),
    Browser.BrowserMeasurementCacheLive({
      fontReadinessRevision: Option.getOrElse(options.fontReadinessRevision, Browser.initialFontReadinessRevision),
      profileId: profile.id
    }).pipe(
      Layer.provide(
        Browser.CanvasTextMeasurerLive({
          context,
          ...emojiCorrectionOptions,
          textBaseline: "alphabetic"
        })
      )
    )
  )

  return Text.prepareWithSegments(options.prepare).pipe(
    Effect.provide(services),
    Effect.map((prepared) => Text.layoutLinesWithSummary(prepared, options.request))
  )
}
