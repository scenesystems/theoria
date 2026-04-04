import { Layer, Option } from "effect"
import { Text } from "effect-text"
import * as Browser from "effect-text/browser"
import * as Contracts from "effect-text/contracts"

const makeCanvasContext = (): Option.Option<CanvasRenderingContext2D> => {
  if (typeof document === "undefined") {
    return Option.none()
  }

  return Option.fromNullable(document.createElement("canvas").getContext("2d"))
}

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
