/**
 * Locale-aware dictionary break opportunities and scoped dictionary loading.
 *
 * @since 0.5.0
 * @module
 */
import { Array, Boolean, Cache, Context, Data, Effect, Layer, Option, Record, Schema, String } from "effect"

import { compileDictionary, localeCandidates, normalizeLocale, shippedDictionaries } from "./internal/hyphenation.js"

/**
 * A non-empty locale key, normalized to lowercase hyphen-separated spelling by the provider.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Locale = Schema.NonEmptyString
/**
 * A locale key requested during preparation.
 * @since 0.5.0
 * @category models
 */
export type Locale = typeof Locale.Type

/**
 * Candidate UTF-16 break offsets.
 * @since 0.5.0
 * @category schemas
 */
export const BreakPoints = Schema.Array(Schema.Int)
/**
 * Candidate UTF-16 break offsets.
 * @since 0.5.0
 * @category models
 */
export type BreakPoints = typeof BreakPoints.Type

/**
 * Explicit words and their break offsets.
 * @since 0.5.0
 * @category schemas
 */
export const Words = Schema.Record({ key: Schema.String, value: BreakPoints })
/**
 * Explicit words and their break offsets.
 * @since 0.5.0
 * @category models
 */
export type Words = typeof Words.Type

const patternGroups = Schema.Record({ key: Schema.String, value: Schema.String })

/**
 * Encoded Liang patterns, optional substitutions, and explicit exceptions.
 * Numeric group keys give the length of each concatenated pattern.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Patterns = Schema.Struct({
  id: Schema.Union(Schema.String, Schema.Array(Schema.String)),
  leftmin: Schema.Int.pipe(Schema.nonNegative()),
  rightmin: Schema.Int.pipe(Schema.nonNegative()),
  patterns: patternGroups,
  charSubstitution: Schema.optional(patternGroups),
  exceptions: Schema.optional(Schema.String)
})
/**
 * Liang dictionary source data.
 * @since 0.5.0
 * @category models
 */
export type Patterns = typeof Patterns.Type

/**
 * Pure compiled word lookup.
 * @since 0.5.0
 * @category models
 */
export type Matcher = (word: string) => BreakPoints

/**
 * Dictionary input alternatives. Compiled matchers are capabilities, not serialized data.
 *
 * @since 0.5.0
 * @category models
 */
export type Dictionary = Data.TaggedEnum<{
  Words: { readonly words: Words }
  Patterns: { readonly patterns: Patterns }
  Compiled: { readonly hyphenateWord: Matcher }
}>

/**
 * Constructs explicit word dictionaries, Liang sources, or compiled matchers.
 *
 * @example
 * ```ts
 * import { Array } from "effect"
 * import { Hyphenation } from "@scenesystems/effect-text"
 * const dictionary = Hyphenation.Dictionary.Words({ words: { colouration: Array.make(3, 6) } })
 * ```
 * @since 0.5.0
 * @category constructors
 */
export const Dictionary = Data.taggedEnum<Dictionary>()

/**
 * Optional preparation capability supplying locale-aware break opportunities.
 *
 * @since 0.5.0
 * @category services
 */
export class Hyphenation extends Context.Tag("@scenesystems/effect-text/Hyphenation")<
  Hyphenation,
  {
    readonly hyphenateWord: (locale: string, word: string) => Effect.Effect<BreakPoints>
    readonly supportsLocale?: (locale: string) => Effect.Effect<boolean>
  }
>() {}

/**
 * Sources and loader for one scoped generation of dictionary and word caches.
 * An explicit locale map replaces the bundled map. An explicit loader takes precedence.
 *
 * @since 0.5.0
 * @category models
 */
export class Options extends Data.Class<{
  readonly dictionaries?: Record.ReadonlyRecord<string, Dictionary>
  readonly loadDictionary?: (locale: string) => Effect.Effect<Dictionary>
  readonly revision?: number
}> {}

class LocaleKey extends Data.Class<{ readonly revision: number; readonly locale: string }> {}
class WordKey extends Data.Class<{ readonly revision: number; readonly locale: string; readonly word: string }> {}

const make = (options: Options) =>
  Effect.gen(function*() {
    const revision = Option.fromNullable(options.revision).pipe(Option.getOrElse(() => 0))
    const dictionaries = Record.mapKeys(
      Option.fromNullable(options.dictionaries).pipe(Option.getOrElse(shippedDictionaries)),
      normalizeLocale
    )
    const find = (locale: string) =>
      Array.findFirst(localeCandidates(locale), (candidate) => Record.has(dictionaries, candidate)).pipe(
        Option.flatMap((candidate) => Record.get(dictionaries, candidate))
      )
    const loader = Option.fromNullable(options.loadDictionary)
    const load = Option.getOrElse(loader, () => (locale: string) =>
      Effect.sync(() =>
        find(locale).pipe(
          Option.getOrElse(() => Dictionary.Words({ words: Record.empty() }))
        )
      ))
    const locales = yield* Cache.make({
      capacity: 32,
      timeToLive: "24 hours",
      lookup: (key: LocaleKey) => load(key.locale).pipe(Effect.map(compileDictionary))
    })
    const words = yield* Cache.make({
      capacity: 2048,
      timeToLive: "24 hours",
      lookup: (key: WordKey) =>
        locales.get(new LocaleKey({ revision: key.revision, locale: key.locale })).pipe(
          Effect.map((match) => match(key.word))
        )
    })
    return Hyphenation.of({
      hyphenateWord: (locale, word) =>
        Boolean.match(String.isEmpty(word), {
          onTrue: () => Effect.succeed(Array.empty<number>()),
          onFalse: () => words.get(new WordKey({ revision, locale: normalizeLocale(locale), word }))
        }),
      supportsLocale: (locale) => Effect.sync(() => Boolean.or(Option.isSome(loader), Option.isSome(find(locale))))
    })
  })

/**
 * Loads and compiles dictionaries only on locale cache misses. The bundled map
 * includes English, German, French, and Spanish with exact-to-base locale fallback.
 *
 * @since 0.5.0
 * @category layers
 */
export const layer = (options: Options = new Options({})) => Layer.effect(Hyphenation, make(options))

/**
 * Disables dictionary breaks without disabling explicit soft hyphens.
 * @since 0.5.0
 * @category layers
 */
export const layerNone = Layer.succeed(Hyphenation, {
  hyphenateWord: () => Effect.succeed(Array.empty<number>()),
  supportsLocale: () => Effect.succeed(false)
})
