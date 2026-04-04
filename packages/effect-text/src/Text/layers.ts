/**
 * Live layers for deterministic and browser-backed text preparation.
 *
 * @since 0.1.0
 */
import { Cache, Effect, Layer } from "effect"
import * as Arr from "effect/Array"
import * as Rec from "effect/Record"
import * as Tuple from "effect/Tuple"

import {
  EngineProfile,
  HyphenationDictionary,
  MeasurementCache,
  TextMeasurer,
  WordSegmenter
} from "../contracts/index.js"
import { MeasurementFailed } from "../Errors/index.js"
import { segmentText } from "./internal/analysis.js"
import {
  type CompiledHyphenationDictionary,
  compileHyphenationDictionary,
  type HyphenationDictionarySource,
  normalizeHyphenationLocale,
  normalizeHyphenationWord,
  shippedHyphenationDictionarySources
} from "./internal/hyphenation.js"
import type { FontDescriptorType } from "./schema.js"

type LoadedHyphenationDictionary = CompiledHyphenationDictionary | HyphenationDictionarySource
type HyphenationDictionaries = Readonly<Record<string, LoadedHyphenationDictionary>>

const emptyHyphenationBreaks = Arr.empty<number>()
const emptyLoadedHyphenationDictionary: LoadedHyphenationDictionary = {}

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

const encodeHyphenationLocaleKey = (revision: number, locale: string): string =>
  `${revision}|${encodeURIComponent(normalizeHyphenationLocale(locale))}`

const decodeHyphenationLocaleKey = (key: string): string => {
  const [_revision, locale = ""] = key.split("|")

  return decodeURIComponent(locale)
}

const encodeHyphenationWordKey = (revision: number, locale: string, word: string): string =>
  [
    revision,
    encodeURIComponent(normalizeHyphenationLocale(locale)),
    encodeURIComponent(normalizeHyphenationWord(word))
  ].join("|")

const decodeHyphenationWordKey = (key: string): readonly [string, string] => {
  const [_revision, locale = "", word = ""] = key.split("|")

  return [decodeURIComponent(locale), decodeURIComponent(word)]
}

const noHyphenationDictionary = {
  hyphenateWord: () => Effect.succeed(emptyHyphenationBreaks)
}

const makeHyphenationDictionary = (options?: {
  readonly dictionaries?: HyphenationDictionaries
  readonly loadDictionary?: (locale: string) => Effect.Effect<LoadedHyphenationDictionary>
  readonly revision?: number
}) =>
  Effect.gen(function*() {
    const revision = options?.revision ?? 0
    const dictionaries = compiledHyphenationDictionaries(options?.dictionaries ?? shippedHyphenationDictionarySources)
    const loadDictionary = options?.loadDictionary ??
      ((locale: string) =>
        Effect.succeed(
          dictionaries[normalizeHyphenationLocale(locale)] ??
            compileHyphenationDictionary(emptyLoadedHyphenationDictionary)
        ))
    const localeCache = yield* Cache.make({
      capacity: 32,
      timeToLive: "24 hours",
      lookup: (key: string) =>
        loadDictionary(decodeHyphenationLocaleKey(key)).pipe(
          Effect.map(compiledHyphenationDictionary)
        )
    })
    const hyphenationCache = yield* Cache.make({
      capacity: 2048,
      timeToLive: "24 hours",
      lookup: (key: string) => {
        const [locale, word] = decodeHyphenationWordKey(key)

        return localeCache.get(encodeHyphenationLocaleKey(revision, locale)).pipe(
          Effect.map((dictionary) => dictionary.hyphenateWord(word))
        )
      }
    })

    return {
      hyphenateWord: (locale: string, word: string) =>
        word.length === 0
          ? Effect.succeed(emptyHyphenationBreaks)
          : hyphenationCache.get(encodeHyphenationWordKey(revision, locale, word))
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
 * Deterministic no-op hyphenation layer.
 *
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
 * Rebuilding the layer with a new `revision` invalidates the loaded locale
 * dictionaries and cached word break opportunities without relying on global
 * singletons. When called without overrides, the layer ships checked-in
 * dictionaries for `en-us`, `en-gb`, `de`, `fr`, and `es`; every other locale
 * deterministically falls back to the non-dictionary break path.
 *
 * @since 0.2.0
 * @category layers
 */
export const HyphenationDictionaryLive = (options?: {
  readonly dictionaries?: HyphenationDictionaries
  readonly loadDictionary?: (locale: string) => Effect.Effect<LoadedHyphenationDictionary>
  readonly revision?: number
}) => Layer.effect(HyphenationDictionary, makeHyphenationDictionary(options))

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
  HyphenationDictionaryLive(),
  EngineProfileLive,
  TextMeasurerLive,
  MeasurementCacheLive.pipe(Layer.provide(TextMeasurerLive))
)
