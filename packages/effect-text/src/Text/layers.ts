/**
 * Live layers for deterministic and browser-backed text preparation.
 *
 * @since 0.1.0
 */
import { Boolean, Cache, Data, Effect, Layer, Match, Number, Option, Schema, String } from "effect"
import * as Arr from "effect/Array"
import * as Rec from "effect/Record"
import * as Tuple from "effect/Tuple"

import {
  EngineProfile,
  HyphenationDictionary,
  type HyphenationDictionaryApi,
  MeasurementCache,
  TextMeasurer,
  WordSegmenter
} from "../contracts/index.js"
import { EffectTextSupportManifest } from "../contracts/supportManifest.js"
import { segmentText } from "./internal/analysis.js"
import { fontDescriptor, fontKey, getOrEvict, MeasurementKey } from "./internal/cache.js"
import {
  CompiledHyphenationDictionary,
  compileHyphenationDictionary,
  type HyphenationBreakPointsType,
  type HyphenationDictionarySourceType,
  hyphenationLocaleFallbackCandidates,
  LoadedHyphenationDictionary,
  normalizeHyphenationLocale,
  shippedHyphenationDictionarySourceForLocale,
  shippedHyphenationDictionarySources
} from "./internal/hyphenation.js"
import type { FontDescriptorType } from "./schema.js"

type HyphenationDictionaryLoader = (locale: string) => Effect.Effect<LoadedHyphenationDictionary>
type CompiledHyphenationDictionaryLoader = (locale: string) => Effect.Effect<CompiledHyphenationDictionary>
const HyphenationDictionaries = Schema.Record({ key: Schema.String, value: LoadedHyphenationDictionary })
type HyphenationDictionaries = typeof HyphenationDictionaries.Type
const CompiledHyphenationDictionaries = Schema.Record({ key: Schema.String, value: CompiledHyphenationDictionary })
type CompiledHyphenationDictionaries = typeof CompiledHyphenationDictionaries.Type

/**
 * Options for the layer-owned dictionary and word caches.
 *
 * @since 0.2.0
 * @category models
 */
export class HyphenationDictionaryOptions extends Data.Class<{
  /** Locale-keyed sources replacing the bundled dictionary map. */
  readonly dictionaries?: HyphenationDictionaries
  /** Effectful source loader called through a 32-locale, 24-hour cache. */
  readonly loadDictionary?: HyphenationDictionaryLoader
  /** Generation included in locale and word cache keys; defaults to zero. */
  readonly revision?: number
}> {}

const emptyHyphenationBreaks: HyphenationBreakPointsType = Arr.empty<number>()
const emptyLoadedHyphenationDictionary: HyphenationDictionarySourceType = Rec.empty()
const emptyCompiledHyphenationDictionary = compileHyphenationDictionary(emptyLoadedHyphenationDictionary)
const isWhitespaceCharacter = Schema.is(Schema.String.pipe(Schema.pattern(/^\s$/u)))
const isWideCharacter = Schema.is(Schema.String.pipe(Schema.pattern(/[A-Z0-9]/u)))

const weightScale = (weight: number): number =>
  Boolean.match(Number.lessThanOrEqualTo(weight, 400), {
    onTrue: () => 1,
    onFalse: () => Number.sum(1, Number.multiply(Number.subtract(weight, 400), 0.0003))
  })

const approximateCharacterWidth = (font: FontDescriptorType, char: string): number => {
  const base = Match.value(char).pipe(
    Match.when(isWhitespaceCharacter, () => Number.multiply(font.size, 0.33)),
    Match.when(isWideCharacter, () => Number.multiply(font.size, 0.64)),
    Match.orElse(() => Number.multiply(font.size, 0.58))
  )
  const weight = Option.fromNullable(font.weight).pipe(Option.getOrElse(() => 400))
  return Number.multiply(base, weightScale(weight))
}

const makeMeasurementCache = Effect.gen(function*() {
  const measurer = yield* TextMeasurer
  const owner = yield* Effect.scope
  const cache = yield* Cache.make({
    capacity: 1024,
    timeToLive: "24 hours",
    lookup: (key: MeasurementKey) => measurer.measure(fontDescriptor(key.font), key.text)
  })

  return {
    measure: (font: FontDescriptorType, text: string) =>
      getOrEvict(cache, owner, new MeasurementKey({ font: fontKey(font), text }))
  }
})

const compiledHyphenationDictionaries = (
  dictionaries: HyphenationDictionaries
): CompiledHyphenationDictionaries =>
  Rec.fromEntries(
    Arr.map(Rec.toEntries(dictionaries), ([locale, dictionary]) =>
      Tuple.make(normalizeHyphenationLocale(locale), compileHyphenationDictionary(dictionary)))
  )

const compiledHyphenationDictionaryForLocale = (
  dictionaries: CompiledHyphenationDictionaries,
  locale: string
): Option.Option<CompiledHyphenationDictionary> =>
  Arr.findFirst(hyphenationLocaleFallbackCandidates(locale), (candidate) => Rec.has(dictionaries, candidate)).pipe(
    Option.flatMap((candidate) => Rec.get(dictionaries, candidate))
  )

/** A loaded dictionary: the layer's generation and the normalized locale. */
class HyphenationLocaleKey extends Schema.Class<HyphenationLocaleKey>("effect-text/HyphenationLocaleKey")({
  revision: Schema.Number,
  locale: Schema.String
}) {}

/** One word's break opportunities in one locale and generation. */
class HyphenationWordKey extends HyphenationLocaleKey.extend<HyphenationWordKey>("effect-text/HyphenationWordKey")({
  word: Schema.String
}) {}

const noHyphenationDictionary: HyphenationDictionaryApi = {
  hyphenateWord: () => Effect.succeed(emptyHyphenationBreaks),
  supportsLocale: () => Effect.succeed(false)
}

const optionDictionaries = (
  options: Option.Option<HyphenationDictionaryOptions>
): Option.Option<HyphenationDictionaries> =>
  options.pipe(Option.flatMap((value) => Option.fromNullable(value.dictionaries)))

const optionDictionaryLoader = (
  options: Option.Option<HyphenationDictionaryOptions>
): Option.Option<HyphenationDictionaryLoader> =>
  options.pipe(Option.flatMap((value) => Option.fromNullable(value.loadDictionary)))

const optionRevision = (options: Option.Option<HyphenationDictionaryOptions>): number =>
  options.pipe(
    Option.flatMap((value) => Option.fromNullable(value.revision)),
    Option.getOrElse(() => 0)
  )

const makeHyphenationDictionary = (providedOptions?: HyphenationDictionaryOptions) =>
  Effect.gen(function*() {
    const options = Option.fromNullable(providedOptions)
    const revision = optionRevision(options)
    const dictionaries = compiledHyphenationDictionaries(
      optionDictionaries(options).pipe(Option.getOrElse(() => shippedHyphenationDictionarySources))
    )
    const loaderOption = optionDictionaryLoader(options)
    const supportsStaticLocale = (locale: string): boolean =>
      Option.isSome(compiledHyphenationDictionaryForLocale(dictionaries, locale))
    const defaultLoader: CompiledHyphenationDictionaryLoader = (locale) =>
      Effect.succeed(
        compiledHyphenationDictionaryForLocale(dictionaries, locale).pipe(
          Option.orElse(() =>
            shippedHyphenationDictionarySourceForLocale(locale).pipe(Option.map(compileHyphenationDictionary))
          ),
          Option.getOrElse(() => emptyCompiledHyphenationDictionary)
        )
      )
    const loadDictionary: CompiledHyphenationDictionaryLoader = loaderOption.pipe(
      Option.match({
        onNone: () => defaultLoader,
        onSome: (sourceLoader) => (locale) => sourceLoader(locale).pipe(Effect.map(compileHyphenationDictionary))
      })
    )
    const localeCache = yield* Cache.make({
      capacity: 32,
      timeToLive: "24 hours",
      lookup: (key: HyphenationLocaleKey) => loadDictionary(key.locale)
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
        Boolean.match(String.isEmpty(word), {
          onTrue: () => Effect.succeed(emptyHyphenationBreaks),
          onFalse: () =>
            hyphenationCache.get(
              new HyphenationWordKey({ revision, locale: normalizeHyphenationLocale(locale), word })
            )
        }),
      supportsLocale: (locale: string) =>
        Boolean.match(Option.isSome(loaderOption), {
          onFalse: () => Effect.succeed(supportsStaticLocale(locale)),
          onTrue: () => Effect.succeed(true)
        })
    }
  })

/**
 * Segments text using Unicode 17 grapheme boundaries and the whitespace policy.
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
 * singletons. The default ships `en-us`, `en-gb`, `de`, `fr`, and `es` and
 * resolves exact locale tags before base-language fallbacks.
 *
 * @since 0.2.0
 * @category layers
 */
export const HyphenationDictionaryLive = (options?: HyphenationDictionaryOptions) =>
  Layer.effect(HyphenationDictionary, makeHyphenationDictionary(options))

/**
 * Estimates deterministic widths from font size, character class, and weight.
 *
 * @since 0.1.0
 * @category layers
 */
export const TextMeasurerLive = Layer.succeed(TextMeasurer, {
  measure: (font, text) =>
    Effect.succeed(
      Arr.reduce(Arr.fromIterable(text), 0, (width, char) => Number.sum(width, approximateCharacterWidth(font, char)))
    )
})

/**
 * Installs the package's deterministic preparation preferences.
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
 *
 * A failed measurement is evicted for a later retry. The layer's scope owns
 * in-flight measurements, while interrupting one reader only stops that reader.
 *
 * @since 0.1.0
 * @category layers
 */
export const MeasurementCacheLive = Layer.scoped(MeasurementCache, makeMeasurementCache)

/**
 * Installs deterministic preparation, hyphenation, measurement, and caching.
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
 * Bundled locale keys and exact-tag-to-base-language fallback.
 *
 * @since 0.2.0
 * @category layers
 */
export const HyphenationSupport = EffectTextSupportManifest.hyphenation
