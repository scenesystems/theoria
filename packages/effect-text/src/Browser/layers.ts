/**
 * Browser-backed measurement layers.
 *
 * @since 0.2.0
 */
import { Cache, Data, Effect, Layer, Number, Option, Schema } from "effect"

import { MeasurementCache, TextMeasurer } from "../contracts/index.js"
import { fontDescriptor, type FontKey, fontKey, getOrEvict, MeasurementKey } from "../Text/internal/cache.js"
import type { FontDescriptorType } from "../Text/schema.js"
import { FontReadinessRevision, initialFontReadinessRevision } from "./fontReadiness.js"
import {
  type CanvasMeasurementContext,
  type CanvasTextBaselineType,
  type CanvasTextDirectionType,
  correctEmojiWidth,
  type EmojiCorrectionType,
  measureCanvasText,
  normalizeEmojiCorrection
} from "./internal/canvas.js"
import { BrowserSupportManifest, BrowserSupportProfileIdSchema } from "./supportManifest.js"

export {
  type CanvasMeasurementContext,
  CanvasTextBaseline,
  type CanvasTextBaselineType,
  CanvasTextDirection,
  type CanvasTextDirectionType,
  CanvasTextMetrics,
  type CanvasTextMetricsType,
  EmojiCorrection,
  EmojiCorrectionConfiguration,
  type EmojiCorrectionType
} from "./internal/canvas.js"

/** One measured string in one font, under one support profile and font-readiness generation. */
class BrowserMeasurementKey extends MeasurementKey.extend<BrowserMeasurementKey>(
  "effect-text/BrowserMeasurementKey"
)({
  profileId: BrowserSupportProfileIdSchema,
  fontReadinessRevision: FontReadinessRevision
}) {}

class NormalizedBrowserMeasurementCacheOptions extends Schema.Class<NormalizedBrowserMeasurementCacheOptions>(
  "effect-text/NormalizedBrowserMeasurementCacheOptions"
)({
  fontReadinessRevision: FontReadinessRevision,
  profileId: BrowserSupportProfileIdSchema
}) {}

const makeBrowserMeasurementCache = (options: NormalizedBrowserMeasurementCacheOptions) =>
  Effect.gen(function*() {
    const measurer = yield* TextMeasurer
    const owner = yield* Effect.scope
    const cache = yield* Cache.make({
      capacity: 1024,
      timeToLive: "24 hours",
      lookup: (key: BrowserMeasurementKey) => measurer.measure(fontDescriptor(key.font), key.text)
    })

    return MeasurementCache.of({
      measure: (font: FontDescriptorType, text: string) =>
        getOrEvict(
          cache,
          owner,
          new BrowserMeasurementKey({
            profileId: options.profileId,
            fontReadinessRevision: options.fontReadinessRevision,
            font: fontKey(font),
            text
          })
        )
    })
  })

class CanvasTextMeasurerOptions extends Data.Class<{
  /** Mutable canvas-like context retained for the layer lifetime. */
  readonly context: CanvasMeasurementContext
  /** Direction assigned before each measurement. */
  readonly direction?: CanvasTextDirectionType
  /** Optional correction for canvas implementations that under-report emoji. */
  readonly emojiCorrection?: EmojiCorrectionType
  /** Baseline assigned before each measurement. */
  readonly textBaseline?: CanvasTextBaselineType
}> {}

const makeCanvasTextMeasurer = (options: CanvasTextMeasurerOptions) =>
  Effect.gen(function*() {
    const contextSemaphore = yield* Effect.makeSemaphore(1)
    const owner = yield* Effect.scope
    const direction = Option.fromNullable(options.direction)
    const textBaseline = Option.fromNullable(options.textBaseline)
    const emojiCorrection = normalizeEmojiCorrection(Option.fromNullable(options.emojiCorrection))
    const emojiAdvanceCache = yield* (
      Option.match(emojiCorrection, {
        onNone: () => Effect.succeedNone,
        onSome: (correction) =>
          Cache.make({
            capacity: 128,
            timeToLive: "24 hours",
            lookup: (key: FontKey) => {
              const font = fontDescriptor(key)

              return measureCanvasText(
                options.context,
                font,
                correction.probe,
                direction,
                textBaseline
              ).pipe(
                Effect.map((width) =>
                  Number.max(width, Number.multiply(font.size, correction.minimumAdvanceMultiplier))
                )
              )
            }
          }).pipe(Effect.asSome)
      })
    )

    return TextMeasurer.of({
      measure: (font: FontDescriptorType, text: string) =>
        contextSemaphore.withPermits(1)(
          measureCanvasText(options.context, font, text, direction, textBaseline).pipe(
            Effect.flatMap((rawWidth) =>
              Option.match(emojiAdvanceCache, {
                onNone: () => Effect.succeed(rawWidth),
                onSome: (cache) =>
                  getOrEvict(cache, owner, fontKey(font)).pipe(
                    Effect.flatMap((emojiAdvance) =>
                      correctEmojiWidth(
                        text,
                        rawWidth,
                        emojiAdvance,
                        (strippedText) =>
                          measureCanvasText(options.context, font, strippedText, direction, textBaseline)
                      )
                    )
                  )
              })
            )
          )
        )
    })
  })

/**
 * Serializes access to a canvas-like context and measures text after applying
 * the requested font, direction, and baseline.
 *
 * @remarks
 * Optional emoji correction replaces under-reported emoji-cluster advances
 * using a per-font probe cache; non-emoji text keeps its raw canvas width. The
 * context is mutated during measurement, restored afterward whether or not the
 * measurement succeeded, and must outlive the layer. Concurrent calls are
 * serialized. A `measureText` that throws and a non-finite or negative width
 * fail as `MeasurementFailed`; a failed probe is not kept in the probe cache,
 * and a probe is the layer's work, finished for every reader awaiting it.
 *
 * @since 0.2.0
 * @category layers
 */
export const CanvasTextMeasurerLive = (options: CanvasTextMeasurerOptions) =>
  Layer.scoped(TextMeasurer, makeCanvasTextMeasurer(options))

/**
 * Browser measurement cache keyed by support profile, font signature, text, and font-readiness revision.
 *
 * @remarks
 * Use this instead of `Text.MeasurementCacheLive` when named-font readiness can
 * change measured widths or when browser support configuration differs by
 * profile. Rebuilding the layer with a new
 * `fontReadinessRevision` invalidates cached widths for the same font/text pair.
 * Only successful measurements are kept: a failed one is evicted so the next
 * request for the same text measures again. Measurements are the layer's
 * work: a reader interrupted while one is pending stops waiting and nothing
 * else, and the layer's scope closing stops every measurement still pending.
 *
 * @since 0.2.0
 * @category layers
 */
export const BrowserMeasurementCacheOptions = Schema.Struct({
  /** Generation included in every cache key; defaults to zero. */
  fontReadinessRevision: Schema.optional(FontReadinessRevision),
  /** Support profile included in every cache key; defaults to the manifest default. */
  profileId: Schema.optional(BrowserSupportProfileIdSchema)
})

/**
 * Decoded options for the browser measurement cache layer.
 *
 * @since 0.4.0
 * @category models
 */
export type BrowserMeasurementCacheOptionsType = typeof BrowserMeasurementCacheOptions.Type

/**
 * Acquires a browser measurement cache whose identity includes browser profile
 * and font-readiness revision.
 *
 * @since 0.2.0
 * @category layers
 */
export const BrowserMeasurementCacheLive = (options?: BrowserMeasurementCacheOptionsType) =>
  Layer.scoped(
    MeasurementCache,
    makeBrowserMeasurementCache(
      new NormalizedBrowserMeasurementCacheOptions({
        fontReadinessRevision: Option.fromNullable(options).pipe(
          Option.flatMap((value) => Option.fromNullable(value.fontReadinessRevision)),
          Option.getOrElse(initialFontReadinessRevision)
        ),
        profileId: Option.fromNullable(options).pipe(
          Option.flatMap((value) => Option.fromNullable(value.profileId)),
          Option.getOrElse(() => BrowserSupportManifest.defaultProfileId)
        )
      })
    )
  )
