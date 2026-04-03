/**
 * Live layers for deterministic and browser-backed text preparation.
 *
 * @since 0.1.0
 */
import { Cache, Effect, Layer } from "effect"
import * as Arr from "effect/Array"

import { EngineProfile, MeasurementCache, TextMeasurer, WordSegmenter } from "../contracts/index.js"
import { MeasurementFailed } from "../Errors/index.js"
import { segmentText } from "./internal/analysis.js"
import type { FontDescriptorType } from "./schema.js"

const encodeMeasurementKey = (font: FontDescriptorType, text: string): string =>
  `${encodeURIComponent(font.family)}|${font.size}|${font.weight ?? 400}|${encodeURIComponent(text)}`

const decodeMeasurementKey = (key: string): readonly [FontDescriptorType, string] => {
  const [family = "", size = "0", weight = "400", text = ""] = key.split("|")
  return [{ family: decodeURIComponent(family), size: Number(size), weight: Number(weight) }, decodeURIComponent(text)]
}

const weightScale = (weight: number): number => weight <= 400 ? 1 : 1 + (weight - 400) * 0.0003

const approximateCharacterWidth = (font: FontDescriptorType, char: string): number => {
  const base = /^\s$/.test(char)
    ? font.size * 0.33
    : /[A-Z0-9]/.test(char)
    ? font.size * 0.64
    : font.size * 0.58

  return base * weightScale(font.weight ?? 400)
}

const makeMeasurementCache = Effect.gen(function*() {
  const measurer = yield* TextMeasurer
  const cache = yield* Cache.make({
    capacity: 1024,
    timeToLive: "24 hours",
    lookup: (key: string) => {
      const [font, text] = decodeMeasurementKey(key)
      return measurer.measure(font, text)
    }
  })

  return {
    measure: (font: FontDescriptorType, text: string) => cache.get(encodeMeasurementKey(font, text))
  }
})

/**
 * `Intl.Segmenter`-backed segmenter with deterministic fallback semantics.
 *
 * @since 0.1.0
 * @category layers
 */
export const WordSegmenterLive = Layer.succeed(WordSegmenter, {
  segment: (text, whiteSpace) => Effect.succeed(segmentText(text, whiteSpace))
})

/**
 * Deterministic width estimator for environments without canvas measurement.
 *
 * @since 0.1.0
 * @category layers
 */
export const TextMeasurerLive = Layer.succeed(TextMeasurer, {
  measure: (font, text) =>
    text.length === 0
      ? Effect.succeed(0)
      : Effect.sync(() =>
        Arr.fromIterable(text).reduce((width, char) => width + approximateCharacterWidth(font, char), 0)
      ).pipe(
        Effect.mapError(
          (cause) =>
            new MeasurementFailed({
              fontFamily: font.family,
              fontSize: font.size,
              text,
              reason: String(cause)
            })
        )
      )
})

/**
 * Default runtime profile approximating browser fit tolerance.
 *
 * @since 0.1.0
 * @category layers
 */
export const EngineProfileLive = Layer.succeed(EngineProfile, {
  lineFitEpsilon: 0.005,
  tabWidth: 4,
  defaultDirection: "ltr",
  preferEarlySoftHyphenBreak: false,
  preferPrefixWidthsForBreakableRuns: true
})

/**
 * Shared measurement cache built on Effect `Cache`.
 *
 * @since 0.1.0
 * @category layers
 */
export const MeasurementCacheLive = Layer.effect(MeasurementCache, makeMeasurementCache)

/**
 * Composed live layer for deterministic text preparation.
 *
 * @since 0.1.0
 * @category layers
 */
export const TextLayoutLive = Layer.mergeAll(
  WordSegmenterLive,
  EngineProfileLive,
  TextMeasurerLive,
  MeasurementCacheLive.pipe(Layer.provide(TextMeasurerLive))
)
