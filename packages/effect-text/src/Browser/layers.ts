/**
 * Browser-backed measurement layers.
 *
 * @since 0.2.0
 */
import { Cache, Effect, Layer, Option } from "effect"

import { MeasurementCache, TextMeasurer } from "../contracts/index.js"
import type { FontDescriptorType } from "../Text/schema.js"
import { type FontReadinessRevisionType, initialFontReadinessRevision } from "./fontReadiness.js"
import {
  type CanvasMeasurementContext,
  correctEmojiWidth,
  decodeFontKey,
  encodeFontKey,
  measureCanvasText,
  normalizeEmojiCorrection,
  stripEmojiClusters
} from "./internal/canvas.js"
import { BrowserSupportManifest, type BrowserSupportProfileIdType } from "./supportManifest.js"

const encodeBrowserMeasurementKey = (
  options: {
    readonly fontReadinessRevision: FontReadinessRevisionType
    readonly profileId: BrowserSupportProfileIdType
  },
  font: FontDescriptorType,
  text: string
): string =>
  [
    encodeURIComponent(options.profileId),
    options.fontReadinessRevision,
    encodeURIComponent(font.family),
    font.size,
    font.weight ?? 400,
    encodeURIComponent(text)
  ].join("|")

const decodeBrowserMeasurementKey = (key: string): readonly [FontDescriptorType, string] => {
  const [_profileId, _revision, family = "", size = "0", weight = "400", text = ""] = key.split("|")

  return [{ family: decodeURIComponent(family), size: Number(size), weight: Number(weight) }, decodeURIComponent(text)]
}

const makeBrowserMeasurementCache = (options: {
  readonly fontReadinessRevision: FontReadinessRevisionType
  readonly profileId: BrowserSupportProfileIdType
}) =>
  Effect.gen(function*() {
    const measurer = yield* TextMeasurer
    const cache = yield* Cache.make({
      capacity: 1024,
      timeToLive: "24 hours",
      lookup: (key: string) => {
        const [font, text] = decodeBrowserMeasurementKey(key)
        return measurer.measure(font, text)
      }
    })

    return {
      measure: (font: FontDescriptorType, text: string) =>
        cache.get(
          encodeBrowserMeasurementKey(
            {
              fontReadinessRevision: options.fontReadinessRevision,
              profileId: options.profileId
            },
            font,
            text
          )
        )
    }
  })

type CanvasTextMeasurerOptions = Readonly<{
  context: CanvasMeasurementContext
  direction?: "ltr" | "rtl" | "inherit"
  emojiCorrection?: boolean | { readonly minimumAdvanceMultiplier?: number; readonly probe?: string }
  textBaseline?: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom"
}>

const makeCanvasTextMeasurer = (options: CanvasTextMeasurerOptions) =>
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
 * Browser canvas-backed measurer using `CanvasRenderingContext2D.measureText`.
 *
 * @since 0.2.0
 * @category layers
 */
export const CanvasTextMeasurerLive = (options: CanvasTextMeasurerOptions) =>
  Layer.effect(TextMeasurer, makeCanvasTextMeasurer(options))

/**
 * Browser measurement cache keyed by support profile, font signature, text, and font-readiness revision.
 *
 * Use this instead of `Text.MeasurementCacheLive` when named-font readiness can
 * change measured widths or when browser support configuration differs by
 * profile. Rebuilding the layer with a new
 * `fontReadinessRevision` invalidates cached widths for the same font/text pair.
 *
 * @since 0.2.0
 * @category layers
 */
export const BrowserMeasurementCacheLive = (options?: {
  readonly fontReadinessRevision?: FontReadinessRevisionType
  readonly profileId?: BrowserSupportProfileIdType
}) =>
  Layer.effect(
    MeasurementCache,
    makeBrowserMeasurementCache({
      fontReadinessRevision: options?.fontReadinessRevision ?? initialFontReadinessRevision(),
      profileId: options?.profileId ?? BrowserSupportManifest.defaultProfileId
    })
  )
