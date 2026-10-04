/**
 * Builds an Effect that measures and lays out text with a real browser 2D
 * canvas context. The caller obtains the context from an `HTMLCanvasElement` or
 * `OffscreenCanvas` and owns its lifetime.
 */
import { Data, Effect, Layer, Option } from "effect"

import { CanvasProfile, CanvasTextMeasurer, Hyphenation, MeasurementCache, Text } from "@scenesystems/effect-text"

export class CanvasLayoutOptions extends Data.Class<{
  readonly prepare: Text.Input
  readonly request: Text.Request
  readonly profileId: Option.Option<CanvasProfile.Id>
  readonly emojiCorrection: Option.Option<CanvasTextMeasurer.EmojiCorrection>
}> {}

export const layoutCanvasText = (context: CanvasTextMeasurer.Context, options: CanvasLayoutOptions) => {
  const profile = Option.match(options.profileId, {
    onNone: () => CanvasProfile.get(),
    onSome: CanvasProfile.get
  })
  const correction = Option.match(options.emojiCorrection, {
    onNone: () => ({}),
    onSome: (emojiCorrection) => ({ emojiCorrection })
  })
  const services = Layer.mergeAll(
    Text.layerSegmenter,
    Layer.succeed(Text.CurrentProfile, profile.engineProfile),
    Hyphenation.layer(),
    MeasurementCache.layer.pipe(
      Layer.provide(
        CanvasTextMeasurer.layer(
          new CanvasTextMeasurer.Options({
            context,
            ...correction,
            textBaseline: "alphabetic"
          })
        )
      )
    )
  )

  return Text.prepareWithSegments(options.prepare).pipe(
    Effect.provide(services),
    Effect.map((prepared) => Text.layout(prepared, options.request))
  )
}
