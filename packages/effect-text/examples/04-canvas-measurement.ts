/**
 * Builds an Effect that measures and lays out text with a real browser 2D
 * canvas context. The caller obtains the context from an `HTMLCanvasElement` or
 * `OffscreenCanvas` and owns its lifetime.
 */
import { Effect, Layer, Option } from "effect"

import { Browser, Contracts, Text } from "@scenesystems/effect-text"

export const layoutCanvasText = (options: {
  readonly context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  readonly prepare: Text.PrepareInputType
  readonly request: Text.LayoutRequestType
  readonly profileId?: Browser.BrowserSupportProfileIdType
  readonly fontReadinessRevision?: Browser.FontReadinessRevisionType
  readonly emojiCorrection?: boolean | { readonly minimumAdvanceMultiplier?: number; readonly probe?: string }
}) => {
  const profile = Browser.browserSupportProfile(options.profileId)
  const emojiCorrectionOptions = Option.fromNullable(options.emojiCorrection).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (emojiCorrection) => ({ emojiCorrection })
    })
  )
  const services = Layer.mergeAll(
    Text.WordSegmenterLive,
    Layer.succeed(Contracts.EngineProfile, profile.engineProfile),
    Browser.BrowserMeasurementCacheLive({
      fontReadinessRevision: options.fontReadinessRevision ?? Browser.initialFontReadinessRevision(),
      profileId: profile.id
    }).pipe(
      Layer.provide(
        Browser.CanvasTextMeasurerLive({
          context: options.context,
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
