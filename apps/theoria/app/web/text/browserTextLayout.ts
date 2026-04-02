import { Layer, Option } from "effect"
import type { Contracts } from "effect-text"
import { Text } from "effect-text"

const makeCanvasContext = (): Option.Option<CanvasRenderingContext2D> => {
  if (typeof document === "undefined") {
    return Option.none()
  }

  return Option.fromNullable(document.createElement("canvas").getContext("2d"))
}

const makeBrowserTextLayoutLayer = (): Layer.Layer<
  Contracts.WordSegmenter | Contracts.MeasurementCache | Contracts.EngineProfile
> =>
  Option.match(makeCanvasContext(), {
    onNone: () => Text.TextLayoutLive,
    onSome: (context) => {
      const canvasMeasurer = Text.CanvasTextMeasurerLive({ context })

      return Layer.mergeAll(
        Text.WordSegmenterLive,
        Text.EngineProfileLive,
        canvasMeasurer,
        Text.MeasurementCacheLive.pipe(Layer.provide(canvasMeasurer))
      )
    }
  })

export const browserTextLayoutLayer = makeBrowserTextLayoutLayer()
