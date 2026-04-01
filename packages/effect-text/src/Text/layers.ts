/**
 * Live layers for deterministic and browser-backed text preparation.
 *
 * @since 0.1.0
 */
import { Cache, Effect, Layer, Option } from "effect"
import * as Arr from "effect/Array"

import { EngineProfile, MeasurementCache, TextMeasurer, WordSegmenter } from "../Contracts/index.js"
import { MeasurementFailed } from "../Errors/index.js"
import { segmentText, stripEmojiClusters } from "../internal/analysis.js"
import {
  correctEmojiWidth,
  decodeFontKey,
  encodeFontKey,
  measureCanvasText,
  normalizeEmojiCorrection
} from "../internal/canvas.js"
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

const makeCanvasTextMeasurer = (options: {
  readonly context: {
    direction: "ltr" | "rtl" | "inherit"
    font: string
    textBaseline: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom"
    measureText: (text: string) => { readonly width: number }
  }
  readonly direction?: "ltr" | "rtl" | "inherit"
  readonly emojiCorrection?: boolean | { readonly minimumAdvanceMultiplier?: number; readonly probe?: string }
  readonly textBaseline?: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom"
}) =>
  Effect.gen(function*() {
    const contextSemaphore = yield* Effect.makeSemaphore(1)
    const emojiCorrection = normalizeEmojiCorrection(options.emojiCorrection)
    const emojiAdvanceCache = yield* (
      Option.match(emojiCorrection, {
        onNone: () => Effect.succeed(Option.none()),
        onSome: (correction) =>
          Cache.make({
            capacity: 128,
            timeToLive: "24 hours",
            lookup: (key: string) => {
              const font = decodeFontKey(key)

              return measureCanvasText(
                options.context,
                font,
                correction[0],
                options.direction,
                options.textBaseline
              ).pipe(
                Effect.map((width) => Math.max(width, font.size * correction[1]))
              )
            }
          }).pipe(Effect.map(Option.some))
      })
    )

    return {
      measure: (font: FontDescriptorType, text: string) =>
        contextSemaphore.withPermits(1)(
          measureCanvasText(options.context, font, text, options.direction, options.textBaseline).pipe(
            Effect.flatMap((rawWidth) =>
              Option.match(emojiAdvanceCache, {
                onNone: () => Effect.succeed(rawWidth),
                onSome: (cache) =>
                  cache.get(encodeFontKey(font)).pipe(
                    Effect.flatMap((emojiAdvance) => {
                      const [strippedText] = stripEmojiClusters(text)

                      return correctEmojiWidth(
                        text,
                        rawWidth,
                        emojiAdvance,
                        measureCanvasText(options.context, font, strippedText, options.direction, options.textBaseline)
                      )
                    })
                  )
              })
            )
          )
        )
    }
  })

/**
 * Regex-based segmenter suitable for tests and deterministic environments.
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
 * Browser canvas-backed measurer using `CanvasRenderingContext2D.measureText`.
 *
 * @since 0.1.0
 * @category layers
 */
export const CanvasTextMeasurerLive = (options: {
  readonly context: {
    direction: "ltr" | "rtl" | "inherit"
    font: string
    textBaseline: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom"
    measureText: (text: string) => { readonly width: number }
  }
  readonly direction?: "ltr" | "rtl" | "inherit"
  readonly emojiCorrection?: boolean | { readonly minimumAdvanceMultiplier?: number; readonly probe?: string }
  readonly textBaseline?: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom"
}) => Layer.effect(TextMeasurer, makeCanvasTextMeasurer(options))

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
