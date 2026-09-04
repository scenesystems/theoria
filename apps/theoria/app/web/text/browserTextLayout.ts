import { Text } from "@scenesystems/effect-text"
import * as Browser from "@scenesystems/effect-text/browser"
import * as Contracts from "@scenesystems/effect-text/contracts"
import { Layer, Option } from "effect"

/** A 2D canvas when the host provides one; headless hosts fall back to the deterministic measurer. */
const makeCanvasContext = (): Option.Option<CanvasRenderingContext2D> =>
  Option.fromNullable(globalThis.document).pipe(
    Option.flatMap((document) => Option.fromNullable(document.createElement("canvas").getContext("2d")))
  )

export const browserSupportProfile = Browser.DefaultBrowserSupportProfile
export const browserSupportProfileId = browserSupportProfile.id
export const browserFontReadinessRevision = Browser.initialFontReadinessRevision()
export const browserEngineProfile = browserSupportProfile.engineProfile

const deterministicBrowserTextLayoutLayer = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.HyphenationDictionaryLive(),
  Layer.succeed(Contracts.EngineProfile, browserEngineProfile),
  Text.TextMeasurerLive,
  Text.MeasurementCacheLive.pipe(Layer.provide(Text.TextMeasurerLive))
)

const makeBrowserTextLayoutLayer = (): Layer.Layer<
  Contracts.WordSegmenter | Contracts.MeasurementCache | Contracts.EngineProfile
> =>
  Option.match(makeCanvasContext(), {
    onNone: () => deterministicBrowserTextLayoutLayer,
    onSome: (context) => {
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
  })

export const browserTextLayoutLayer = makeBrowserTextLayoutLayer()
