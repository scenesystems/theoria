/**
 * Internal canvas measurement helpers.
 *
 * @since 0.1.0
 */
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import { MeasurementFailed } from "../../Errors/index.js"
import type { FontDescriptorType } from "../../Text/schema.js"

type CanvasTextDirection = "ltr" | "rtl" | "inherit"
type CanvasTextBaseline = "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom"
type ContextSnapshot = readonly [font: string, direction: CanvasTextDirection, textBaseline: CanvasTextBaseline]
type NormalizedEmojiCorrection = readonly [probe: string, minimumAdvanceMultiplier: number]

const EMOJI_PATTERN = /\p{Extended_Pictographic}/u
const Segmenter = typeof Intl === "undefined" ? undefined : Reflect.get(Intl, "Segmenter")

const graphemeClusters = (text: string): ReadonlyArray<string> =>
  typeof Segmenter === "function"
    ? Arr.fromIterable(new Segmenter(undefined, { granularity: "grapheme" }).segment(text)).map((part) => part.segment)
    : Arr.fromIterable(text)

const containsEmoji = (text: string): boolean => EMOJI_PATTERN.test(text)

export const stripEmojiClusters = (text: string): readonly [string, number] => {
  const result = graphemeClusters(text).reduce(
    (state, cluster) =>
      EMOJI_PATTERN.test(cluster)
        ? { text: state.text, count: state.count + 1 }
        : { text: state.text + cluster, count: state.count },
    { text: "", count: 0 }
  )

  return [result.text, result.count]
}

const restoreContext = (
  context: {
    direction: CanvasTextDirection
    font: string
    textBaseline: CanvasTextBaseline
    measureText: (text: string) => { readonly width: number }
  },
  snapshot: ContextSnapshot
) =>
  Effect.sync(() => {
    context.font = snapshot[0]
    context.direction = snapshot[1]
    context.textBaseline = snapshot[2]
  })

const measurementFailure = (font: FontDescriptorType, text: string, reason: string) =>
  new MeasurementFailed({
    fontFamily: font.family,
    fontSize: font.size,
    text,
    reason
  })

export const encodeFontKey = (font: FontDescriptorType): string =>
  `${encodeURIComponent(font.family)}|${font.size}|${font.weight ?? 400}`

export const decodeFontKey = (key: string): FontDescriptorType => {
  const [family = "", size = "0", weight = "400"] = key.split("|")
  return { family: decodeURIComponent(family), size: Number(size), weight: Number(weight) }
}

export const toCanvasFont = (font: FontDescriptorType): string => {
  const w = font.weight ?? 400
  return w !== 400 ? `${w} ${font.size}px ${font.family}` : `${font.size}px ${font.family}`
}

export const normalizeEmojiCorrection = (emojiCorrection: unknown): Option.Option<NormalizedEmojiCorrection> =>
  Option.fromNullable(emojiCorrection).pipe(
    Option.flatMap((value) =>
      value === false
        ? Option.none()
        : value === true
        ? Option.some(["🙂", 1])
        : typeof value === "object"
        ? Option.some([
          typeof Reflect.get(value, "probe") === "string" ? Reflect.get(value, "probe") : "🙂",
          typeof Reflect.get(value, "minimumAdvanceMultiplier") === "number"
            ? Reflect.get(value, "minimumAdvanceMultiplier")
            : 1
        ])
        : Option.none()
    )
  )

export const measureCanvasText = (
  context: {
    direction: CanvasTextDirection
    font: string
    textBaseline: CanvasTextBaseline
    measureText: (text: string) => { readonly width: number }
  },
  font: FontDescriptorType,
  text: string,
  direction?: CanvasTextDirection,
  textBaseline?: CanvasTextBaseline
): Effect.Effect<number, MeasurementFailed> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const snapshot: ContextSnapshot = [context.font, context.direction, context.textBaseline]

      context.font = toCanvasFont(font)
      context.direction = direction ?? snapshot[1]
      context.textBaseline = textBaseline ?? snapshot[2]

      return snapshot
    }),
    () =>
      text.length === 0
        ? Effect.succeed(0)
        : Effect.sync(() => context.measureText(text).width).pipe(
          Effect.flatMap((width) =>
            Number.isFinite(width) && width >= 0
              ? Effect.succeed(width)
              : Effect.fail(measurementFailure(font, text, `measureText returned ${String(width)}`))
          ),
          Effect.mapError((cause) =>
            cause instanceof MeasurementFailed ? cause : measurementFailure(font, text, String(cause))
          )
        ),
    (snapshot) => restoreContext(context, snapshot)
  )

export const correctEmojiWidth = (
  text: string,
  rawWidth: number,
  emojiAdvance: number,
  measureWithoutEmoji: Effect.Effect<number, MeasurementFailed>
): Effect.Effect<number, MeasurementFailed> => {
  if (!containsEmoji(text)) {
    return Effect.succeed(rawWidth)
  }

  const [strippedText, emojiCount] = stripEmojiClusters(text)
  if (emojiCount === 0 || strippedText === text) {
    return Effect.succeed(rawWidth)
  }

  return measureWithoutEmoji.pipe(
    Effect.map((strippedWidth) => Math.max(rawWidth, strippedWidth + emojiCount * emojiAdvance))
  )
}
