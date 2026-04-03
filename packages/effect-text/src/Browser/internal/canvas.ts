/**
 * Internal canvas measurement helpers.
 *
 * @since 0.1.0
 */
import { Effect, Match, Option } from "effect"
import * as Arr from "effect/Array"
import * as Data from "effect/Data"

import { MeasurementFailed } from "../../Errors/index.js"
import type { FontDescriptorType } from "../../Text/schema.js"

type CanvasTextDirection = "ltr" | "rtl" | "inherit"
type CanvasTextBaseline = "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom"
type ContextSnapshot = readonly [font: string, direction: CanvasTextDirection, textBaseline: CanvasTextBaseline]
type NormalizedEmojiCorrection = readonly [probe: string, minimumAdvanceMultiplier: number]

const EMOJI_PATTERN = /\p{Extended_Pictographic}/u
const Segmenter = typeof Intl === "undefined" ? undefined : Reflect.get(Intl, "Segmenter")

const makeNormalizedEmojiCorrection = (probe: string, minimumAdvanceMultiplier: number): NormalizedEmojiCorrection =>
  Data.tuple(probe, minimumAdvanceMultiplier)

const resolveEmojiCorrectionProbe = (value: object): string => {
  const probe = Reflect.get(value, "probe")
  return typeof probe === "string" ? probe : "🙂"
}

const resolveEmojiAdvanceMultiplier = (value: object): number => {
  const minimumAdvanceMultiplier = Reflect.get(value, "minimumAdvanceMultiplier")
  return typeof minimumAdvanceMultiplier === "number" ? minimumAdvanceMultiplier : 1
}

const emojiCorrectionObject = (value: unknown): Option.Option<object> =>
  typeof value === "object" && value !== null ? Option.some(value) : Option.none()

const graphemeClusters = (text: string): ReadonlyArray<string> =>
  typeof Segmenter === "function"
    ? Arr.map(Arr.fromIterable(new Segmenter(undefined, { granularity: "grapheme" }).segment(text)), (part) =>
      part.segment)
    : Arr.fromIterable(text)

const containsEmoji = (text: string): boolean => EMOJI_PATTERN.test(text)

export const stripEmojiClusters = (text: string): readonly [string, number] => {
  const result = Arr.reduce(
    graphemeClusters(text),
    { text: "", count: 0 },
    (state, cluster) =>
      EMOJI_PATTERN.test(cluster)
        ? { text: state.text, count: state.count + 1 }
        : { text: state.text + cluster, count: state.count }
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
  return Match.value(w).pipe(
    Match.when(400, () => `${font.size}px ${font.family}`),
    Match.orElse((weight) => `${weight} ${font.size}px ${font.family}`)
  )
}

export const normalizeEmojiCorrection = (emojiCorrection: unknown): Option.Option<NormalizedEmojiCorrection> =>
  Option.fromNullable(emojiCorrection).pipe(
    Option.flatMap((value) =>
      Match.value(value).pipe(
        Match.when(false, () => Option.none()),
        Match.when(true, () => Option.some(makeNormalizedEmojiCorrection("🙂", 1))),
        Match.orElse((resolvedValue) =>
          emojiCorrectionObject(resolvedValue).pipe(
            Option.map((objectValue) =>
              makeNormalizedEmojiCorrection(
                resolveEmojiCorrectionProbe(objectValue),
                resolveEmojiAdvanceMultiplier(objectValue)
              )
            )
          )
        )
      )
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
  return Match.value(containsEmoji(text)).pipe(
    Match.when(false, () => Effect.succeed(rawWidth)),
    Match.orElse(() => {
      const [strippedText, emojiCount] = stripEmojiClusters(text)

      return Match.value(emojiCount === 0 || strippedText === text).pipe(
        Match.when(true, () => Effect.succeed(rawWidth)),
        Match.orElse(() =>
          measureWithoutEmoji.pipe(
            Effect.map((strippedWidth) => Math.max(rawWidth, strippedWidth + emojiCount * emojiAdvance))
          )
        )
      )
    })
  )
}
