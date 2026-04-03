/**
 * Browser-backed measurement layers.
 *
 * @since 0.2.0
 */
import { Cache, Effect, Layer, Option } from "effect"

import { TextMeasurer } from "../contracts/index.js"
import type { FontDescriptorType } from "../Text/schema.js"
import {
  correctEmojiWidth,
  decodeFontKey,
  encodeFontKey,
  measureCanvasText,
  normalizeEmojiCorrection,
  stripEmojiClusters
} from "./internal/canvas.js"

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
 * Browser canvas-backed measurer using `CanvasRenderingContext2D.measureText`.
 *
 * @since 0.2.0
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
