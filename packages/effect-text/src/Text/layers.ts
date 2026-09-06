/**
 * Live layers for deterministic and browser-backed text preparation.
 *
 * @since 0.1.0
 */
import { Cache, Data, Effect, Layer } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"
import * as Rec from "effect/Record"
import * as Tuple from "effect/Tuple"

import {
  EngineProfile,
  HyphenationDictionary,
  MeasurementCache,
  TextMeasurer,
  WordSegmenter
} from "../contracts/index.js"
import { EffectTextSupportManifest } from "../contracts/supportManifest.js"
import { MeasurementFailed } from "../Errors/index.js"
import { segmentText } from "./internal/analysis.js"
import { fontDescriptor, fontKey, getOrEvict, MeasurementKey } from "./internal/cache.js"
import {
  type CompiledHyphenationDictionary,
  compileHyphenationDictionary,
  type HyphenationDictionarySource,
  hyphenationLocaleFallbackCandidates,
  normalizeHyphenationLocale,
  shippedHyphenationDictionarySourceForLocale,
  shippedHyphenationDictionarySources
} from "./internal/hyphenation.js"
import type { FontDescriptorType } from "./schema.js"

type LoadedHyphenationDictionary = CompiledHyphenationDictionary | HyphenationDictionarySource
type HyphenationDictionaries = Readonly<Record<string, LoadedHyphenationDictionary>>

const emptyHyphenationBreaks = Arr.empty<number>()
const emptyLoadedHyphenationDictionary: LoadedHyphenationDictionary = {}
const emptyCompiledHyphenationDictionary = compileHyphenationDictionary(emptyLoadedHyphenationDictionary)

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
    lookup: (key: MeasurementKey) => measurer.measure(fontDescriptor(key.font), key.text)
  })

  return {
    measure: (font: FontDescriptorType, text: string) =>
      getOrEvict(cache, new MeasurementKey({ font: fontKey(font), text }))
  }
})

const compiledHyphenationDictionaries = (
  dictionaries: HyphenationDictionaries
): Readonly<Record<string, CompiledHyphenationDictionary>> =>
  Rec.fromEntries(
    Arr.map(Rec.toEntries(dictionaries), ([locale, dictionary]) =>
      Tuple.make(normalizeHyphenationLocale(locale), compiledHyphenationDictionary(dictionary)))
  )

const isCompiledHyphenationDictionary = (
  dictionary: LoadedHyphenationDictionary
): dictionary is CompiledHyphenationDictionary =>
  "hyphenateWord" in dictionary && typeof dictionary.hyphenateWord === "function"

const compiledHyphenationDictionary = (
  dictionary: LoadedHyphenationDictionary
): CompiledHyphenationDictionary =>
  isCompiledHyphenationDictionary(dictionary)
    ? dictionary
    : compileHyphenationDictionary(dictionary)

const compiledHyphenationDictionaryForLocale = (
  dictionaries: Readonly<Record<string, CompiledHyphenationDictionary>>,
  locale: string
): Option.Option<CompiledHyphenationDictionary> =>
  Arr.reduce(
    hyphenationLocaleFallbackCandidates(locale),
    Option.none<CompiledHyphenationDictionary>(),
    (resolved, candidate) =>
      Option.isSome(resolved)
        ? resolved
        : Option.fromNullable(dictionaries[candidate])
  )

/** A loaded dictionary: the layer's generation and the normalized locale. */
class HyphenationLocaleKey extends Data.Class<{
  readonly revision: number
  readonly locale: string
}> {}

/** One word's break opportunities in one locale and generation. */
class HyphenationWordKey extends Data.Class<{
  readonly revision: number
  readonly locale: string
  readonly word: string
}> {}

const noHyphenationDictionary = {
  hyphenateWord: () => Effect.succeed(emptyHyphenationBreaks),
  supportsLocale: () => Effect.succeed(false)
}

const makeHyphenationDictionary = (options?: {
  readonly dictionaries?: HyphenationDictionaries
  readonly loadDictionary?: (locale: string) => Effect.Effect<LoadedHyphenationDictionary>
  readonly revision?: number
}) =>
  Effect.gen(function*() {
    const revision = options?.revision ?? 0
    const dictionaries = compiledHyphenationDictionaries(options?.dictionaries ?? shippedHyphenationDictionarySources)
    const supportsStaticLocale = (locale: string): boolean =>
      Option.isSome(compiledHyphenationDictionaryForLocale(dictionaries, locale))
    const loadDictionary = options?.loadDictionary ??
      ((locale: string) =>
        Effect.succeed(
          Option.match(compiledHyphenationDictionaryForLocale(dictionaries, locale), {
            onNone: () =>
              shippedHyphenationDictionarySourceForLocale(locale).pipe(
                Option.match({
                  onNone: () => emptyCompiledHyphenationDictionary,
                  onSome: compileHyphenationDictionary
                })
              ),
            onSome: (dictionary) => dictionary
          })
        ))
    const localeCache = yield* Cache.make({
      capacity: 32,
      timeToLive: "24 hours",
      lookup: (key: HyphenationLocaleKey) => loadDictionary(key.locale).pipe(Effect.map(compiledHyphenationDictionary))
    })
    const hyphenationCache = yield* Cache.make({
      capacity: 2048,
      timeToLive: "24 hours",
      lookup: (key: HyphenationWordKey) =>
        localeCache.get(new HyphenationLocaleKey({ revision: key.revision, locale: key.locale })).pipe(
          Effect.map((dictionary) => dictionary.hyphenateWord(key.word))
        )
    })

    return {
      hyphenateWord: (locale: string, word: string) =>
        word.length === 0
          ? Effect.succeed(emptyHyphenationBreaks)
          : hyphenationCache.get(
            new HyphenationWordKey({ revision, locale: normalizeHyphenationLocale(locale), word })
          ),
      supportsLocale: (locale: string) =>
        Option.fromNullable(options?.loadDictionary).pipe(
          Option.match({
            onNone: () => Effect.succeed(supportsStaticLocale(locale)),
            onSome: () => Effect.succeed(true)
          })
        )
    }
  })

/**
 * Segments text with `Intl.Segmenter` and applies the whitespace policy.
 *
 * @since 0.1.0
 * @category layers
 */
export const WordSegmenterLive = Layer.succeed(WordSegmenter, {
  segment: (text, whiteSpace) => Effect.succeed(segmentText(text, whiteSpace))
})

/**
 * Declines every locale and returns no dictionary break opportunities.
 *
 * @remarks
 * This is the default fallback when callers do not provide dictionaries for a
 * requested locale.
 *
 * @since 0.2.0
 * @category layers
 */
export const NoHyphenationDictionaryLive = Layer.succeed(HyphenationDictionary, noHyphenationDictionary)

/**
 * Layer-owned dictionary hyphenation with per-locale and per-word caches.
 *
 * @remarks
 * Rebuilding the layer with a new `revision` invalidates the loaded locale
 * dictionaries and cached word break opportunities without relying on global
 * singletons. When called without overrides, the layer ships checked-in
 * dictionaries for `en-us`, `en-gb`, `de`, `fr`, and `es`, normalizes locale
 * case plus `_`/`-` spellings, and falls back from tagged variants to a shipped
 * base language when one exists. Every other locale deterministically falls
 * back to the non-dictionary break path.
 *
 * @since 0.2.0
 * @category layers
 */
export const HyphenationDictionaryLive = (options?: {
  /** Locale-keyed sources replacing the bundled dictionary map. */
  readonly dictionaries?: HyphenationDictionaries
  /** Effectful source loader called through a 32-locale, 24-hour cache. */
  readonly loadDictionary?: (locale: string) => Effect.Effect<LoadedHyphenationDictionary>
  /** Generation included in locale and word cache keys; defaults to zero. */
  readonly revision?: number
}) => Layer.effect(HyphenationDictionary, makeHyphenationDictionary(options))

/**
 * Estimates widths from font size, character class, and weight without browser
 * APIs. It is deterministic and does not perform font shaping.
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
 * Installs the package defaults: 0.005 fit tolerance, four-column tabs, LTR
 * fallback, later soft-hyphen preference, and prefix-width fitting.
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
 * Acquires a 1,024-entry, 24-hour cache backed by the ambient `TextMeasurer`.
 * Cache identity includes font family, size, weight normalized to `400`, and
 * text. A failed measurement fails that read but is evicted, so the next
 * request measures again instead of replaying the failure.
 *
 * @since 0.1.0
 * @category layers
 */
export const MeasurementCacheLive = Layer.effect(MeasurementCache, makeMeasurementCache)

/**
 * Installs the deterministic segmenter, shipped hyphenation dictionaries,
 * default engine profile, width estimator, and measurement cache.
 *
 * @since 0.1.0
 * @category layers
 */
export const TextLayoutLive = Layer.mergeAll(
  WordSegmenterLive,
  HyphenationDictionaryLive(),
  EngineProfileLive,
  TextMeasurerLive,
  MeasurementCacheLive.pipe(Layer.provide(TextMeasurerLive))
)

/**
 * Bundled locale keys and exact-tag-to-base-language fallback used by the
 * default dictionary layer.
 *
 * @since 0.2.0
 * @category layers
 */
export const HyphenationSupport = EffectTextSupportManifest.hyphenation
