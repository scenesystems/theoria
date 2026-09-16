/**
 * Private canvas measurement state and emoji correction algorithms.
 *
 * @internal
 * @since 0.5.0
 */
import { Boolean, Cache, Data, Effect, Equal, Exit, Inspectable, Match, Number, Option, Schema, String } from "effect"

import type * as CanvasTextMeasurer from "../CanvasTextMeasurer.js"
import type * as Text from "../Text.js"
import * as TextMeasurer from "../TextMeasurer.js"
import { containsEmoji, stripEmojiClusters } from "./analysis.js"
import type { FontKey } from "./cache.js"
import { fontKey, getOrEvict } from "./cache.js"

class Snapshot extends Data.Class<{
  readonly direction: CanvasTextMeasurer.Direction
  readonly font: string
  readonly textBaseline: CanvasTextMeasurer.Baseline
}> {}

class Correction extends Data.Class<{
  readonly minimumAdvanceMultiplier: number
  readonly probe: string
}> {}

const failed = (font: Text.Font, text: string, reason: string) =>
  new TextMeasurer.Failed({
    fontFamily: font.family,
    fontSize: font.size,
    text,
    reason
  })

const hostFailed = (font: Text.Font, text: string, operation: string, cause: unknown) =>
  failed(font, text, String.concat(operation, String.concat(" failed: ", Inspectable.toStringUnknown(cause, 0))))

const canvasFont = (font: Text.Font): string => {
  const weight = Option.fromNullable(font.weight).pipe(Option.getOrElse(() => 400))
  const sizeAndFamily = String.concat(
    Inspectable.toStringUnknown(font.size, 0),
    String.concat("px ", font.family)
  )

  return Boolean.match(Equal.equals(weight, 400), {
    onFalse: () => String.concat(Inspectable.toStringUnknown(weight, 0), String.concat(" ", sizeAndFamily)),
    onTrue: () => sizeAndFamily
  })
}

const snapshot = (
  context: CanvasTextMeasurer.Context,
  font: Text.Font,
  text: string
): Effect.Effect<Snapshot, TextMeasurer.Failed> =>
  Effect.try({
    try: () => new Snapshot({ direction: context.direction, font: context.font, textBaseline: context.textBaseline }),
    catch: (cause) => hostFailed(font, text, "canvas state read", cause)
  })

const assign = (
  context: CanvasTextMeasurer.Context,
  prior: Snapshot,
  font: Text.Font,
  text: string,
  direction: Option.Option<CanvasTextMeasurer.Direction>,
  textBaseline: Option.Option<CanvasTextMeasurer.Baseline>
): Effect.Effect<void, TextMeasurer.Failed> =>
  Effect.try({
    try: () => {
      context.font = canvasFont(font)
      context.direction = Option.getOrElse(direction, () => prior.direction)
      context.textBaseline = Option.getOrElse(textBaseline, () => prior.textBaseline)
    },
    catch: (cause) => hostFailed(font, text, "canvas state assignment", cause)
  })

const restore = (
  context: CanvasTextMeasurer.Context,
  prior: Snapshot,
  font: Text.Font,
  text: string
): Effect.Effect<void, TextMeasurer.Failed> =>
  Effect.try({
    try: () => {
      context.font = prior.font
      context.direction = prior.direction
      context.textBaseline = prior.textBaseline
    },
    catch: (cause) => hostFailed(font, text, "canvas state restoration", cause)
  })

const readWidth = (
  context: CanvasTextMeasurer.Context,
  font: Text.Font,
  text: string
): Effect.Effect<number, TextMeasurer.Failed> =>
  Boolean.match(String.isEmpty(text), {
    onFalse: () =>
      Effect.try({
        try: () => context.measureText(text).width,
        catch: (cause) => hostFailed(font, text, "measureText", cause)
      }).pipe(
        Effect.filterOrFail(
          Schema.is(Schema.NonNegative.pipe(Schema.finite())),
          (width) => failed(font, text, String.concat("measureText returned ", Inspectable.toStringUnknown(width, 0)))
        )
      ),
    onTrue: () => Effect.succeed(0)
  })

const measure = (
  context: CanvasTextMeasurer.Context,
  font: Text.Font,
  text: string,
  direction: Option.Option<CanvasTextMeasurer.Direction>,
  textBaseline: Option.Option<CanvasTextMeasurer.Baseline>
): Effect.Effect<number, TextMeasurer.Failed> =>
  snapshot(context, font, text).pipe(
    Effect.flatMap((prior) =>
      Effect.uninterruptibleMask((interruptible) =>
        interruptible(
          assign(context, prior, font, text, direction, textBaseline).pipe(
            Effect.zipRight(readWidth(context, font, text))
          )
        ).pipe(
          Effect.exit,
          Effect.flatMap((useExit) =>
            restore(context, prior, font, text).pipe(
              Effect.exit,
              Effect.flatMap((restorationExit) => Exit.zipLeft(useExit, restorationExit))
            )
          )
        )
      )
    )
  )

const normalizeCorrection = (
  correction: Option.Option<CanvasTextMeasurer.EmojiCorrection>
): Option.Option<Correction> =>
  correction.pipe(
    Option.flatMap((selection) =>
      Match.value(selection).pipe(
        Match.when(false, () => Option.none()),
        Match.when(true, () => Option.some(new Correction({ probe: "🙂", minimumAdvanceMultiplier: 1 }))),
        Match.orElse((custom) =>
          Option.some(
            new Correction({
              probe: Option.fromNullable(custom.probe).pipe(Option.getOrElse(() => "🙂")),
              minimumAdvanceMultiplier: Option.fromNullable(custom.minimumAdvanceMultiplier).pipe(
                Option.getOrElse(() => 1)
              )
            })
          )
        )
      )
    )
  )

const corrected = (
  text: string,
  rawWidth: number,
  emojiAdvance: number,
  measureWithoutEmoji: (text: string) => Effect.Effect<number, TextMeasurer.Failed>
): Effect.Effect<number, TextMeasurer.Failed> =>
  Boolean.match(containsEmoji(text), {
    onFalse: () => Effect.succeed(rawWidth),
    onTrue: () => {
      const stripped = stripEmojiClusters(text)
      return Boolean.match(Boolean.or(Equal.equals(stripped.count, 0), Equal.equals(stripped.text, text)), {
        onFalse: () =>
          measureWithoutEmoji(stripped.text).pipe(
            Effect.map((strippedWidth) =>
              Number.max(rawWidth, Number.sum(strippedWidth, Number.multiply(stripped.count, emojiAdvance)))
            )
          ),
        onTrue: () => Effect.succeed(rawWidth)
      })
    }
  })

/** @internal */
export const make = (options: CanvasTextMeasurer.Options) =>
  Effect.gen(function*() {
    const semaphore = yield* Effect.makeSemaphore(1)
    const owner = yield* Effect.scope
    const direction = Option.fromNullable(options.direction)
    const textBaseline = Option.fromNullable(options.textBaseline)
    const correction = normalizeCorrection(Option.fromNullable(options.emojiCorrection))
    const probeCache = yield* Option.match(correction, {
      onNone: () => Effect.succeedNone,
      onSome: (settings) =>
        Cache.make({
          capacity: 128,
          timeToLive: "24 hours",
          lookup: (key: FontKey) =>
            measure(options.context, key, settings.probe, direction, textBaseline).pipe(
              Effect.map((width) => Number.max(width, Number.multiply(key.size, settings.minimumAdvanceMultiplier)))
            )
        }).pipe(Effect.asSome)
    })

    return TextMeasurer.TextMeasurer.of({
      measure: (font: Text.Font, text: string) =>
        semaphore.withPermits(1)(
          measure(options.context, font, text, direction, textBaseline).pipe(
            Effect.flatMap((rawWidth) =>
              Option.match(probeCache, {
                onNone: () => Effect.succeed(rawWidth),
                onSome: (cache) =>
                  getOrEvict(cache, owner, fontKey(font)).pipe(
                    Effect.flatMap((emojiAdvance) =>
                      corrected(
                        text,
                        rawWidth,
                        emojiAdvance,
                        (withoutEmoji) => measure(options.context, font, withoutEmoji, direction, textBaseline)
                      )
                    )
                  )
              })
            )
          )
        )
    })
  })
