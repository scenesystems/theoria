/**
 * Internal hyphenation helpers.
 *
 * @since 0.2.0
 */
import { Order } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"
import * as Rec from "effect/Record"
import * as Tuple from "effect/Tuple"

import { HyphenationSupportManifest } from "../../contracts/hyphenationSupport.js"

import { graphemeClusters } from "./analysis.js"
import { deHyphenationPatternSource } from "./hyphenationPatterns/de.js"
import { enGbHyphenationPatternSource } from "./hyphenationPatterns/enGb.js"
import { enUsHyphenationPatternSource } from "./hyphenationPatterns/enUs.js"
import { esHyphenationPatternSource } from "./hyphenationPatterns/es.js"
import { frHyphenationPatternSource } from "./hyphenationPatterns/fr.js"

/**
 * Internal break-opportunity tags compiled into prepared dictionary pieces.
 *
 * @since 0.2.0
 * @category internals
 */
export type HyphenationBreakOpportunity = "dictionary-hyphen" | "none" | "soft-hyphen"

/**
 * Internal preparation-time piece emitted after dictionary or soft-hyphen splitting.
 *
 * @since 0.2.0
 * @category internals
 */
export type HyphenatedPiece = Readonly<{
  breakOpportunity: HyphenationBreakOpportunity
  text: string
}>

/**
 * Internal explicit word-to-break-point dictionary source.
 *
 * @since 0.2.0
 * @category internals
 */
export type HyphenationWordBreakDictionary = Readonly<Record<string, ReadonlyArray<number>>>

/**
 * Internal Liang-pattern source definition for shipped or custom dictionaries.
 *
 * @since 0.2.0
 * @category internals
 */
export type HyphenationPatternSource = Readonly<{
  id: string | ReadonlyArray<string>
  leftmin: number
  rightmin: number
  patterns: Readonly<Record<string, string>>
  charSubstitution?: Readonly<Record<string, string>>
  exceptions?: string
}>

/**
 * Internal union of the supported hyphenation source formats.
 *
 * @since 0.2.0
 * @category internals
 */
export type HyphenationDictionarySource = HyphenationPatternSource | HyphenationWordBreakDictionary

/**
 * Internal compiled matcher reused by the hyphenation layer caches.
 *
 * @since 0.2.0
 * @category internals
 */
export type CompiledHyphenationDictionary = Readonly<{
  hyphenateWord: (word: string) => ReadonlyArray<number>
}>

type ParsedHyphenationPattern = Readonly<{
  letters: string
  points: ReadonlyArray<number>
}>

type IndexedHyphenationPatterns = Readonly<Record<string, ReadonlyArray<ParsedHyphenationPattern>>>

type CompiledHyphenationPatternSource = Readonly<{
  charSubstitution: Readonly<Record<string, string>>
  exceptions: Readonly<Record<string, ReadonlyArray<number>>>
  leftMin: number
  patternIndex: IndexedHyphenationPatterns
  rightMin: number
}>

type NormalizedHyphenationWord = Readonly<{
  boundaryMap: ReadonlyArray<number>
  original: string
  value: string
}>

type ShippedHyphenationSupport = Readonly<{
  localeFallback: "exact-or-base-language"
  locales: ReadonlyArray<string>
}>

const hyphenationBoundaryMarker = "_"
const hyphenationDigitPattern = /^[0-9]$/u
const hyphenationPatternOrder = Order.reverse(
  Order.mapInput(Order.number, (pattern: ParsedHyphenationPattern) => pattern.letters.length)
)

const sanitizeHyphenationBreakPoints = (
  word: string,
  breakPoints: ReadonlyArray<number>
): ReadonlyArray<number> =>
  Arr.reduce(
    Arr.sort(breakPoints, Order.number),
    Arr.empty<number>(),
    (sanitized, breakPoint) => {
      const previous = Arr.last(sanitized).pipe(Option.getOrElse(() => -1))

      return breakPoint <= 0 || breakPoint >= word.length || breakPoint === previous
        ? sanitized
        : Arr.append(sanitized, breakPoint)
    }
  )

/**
 * Canonicalizes locale identifiers into the shipped lowercase hyphenated form.
 *
 * @since 0.2.0
 * @category internals
 */
export const normalizeHyphenationLocale = (locale: string): string =>
  locale.trim().normalize("NFC").replace(/_/gu, "-").toLowerCase()

/**
 * Produces exact-to-base-language lookup candidates for a requested locale.
 *
 * @since 0.2.0
 * @category internals
 */
export const hyphenationLocaleFallbackCandidates = (locale: string): ReadonlyArray<string> => {
  const normalizedLocale = normalizeHyphenationLocale(locale)
  const parts = Arr.filter(normalizedLocale.split("-"), (part) => part.length > 0)

  return normalizedLocale.length === 0
    ? Arr.empty<string>()
    : Arr.makeBy(parts.length, (index) => parts.slice(0, parts.length - index).join("-"))
}

const normalizedHyphenationWord = (word: string): NormalizedHyphenationWord =>
  Arr.reduce(
    graphemeClusters(word),
    {
      boundaryMap: Arr.of(0),
      original: word,
      originalIndex: 0,
      value: ""
    },
    (state, cluster) => {
      const normalizedCluster = cluster.normalize("NFC").toLowerCase()
      const nextOriginalIndex = state.originalIndex + cluster.length

      return {
        boundaryMap: Arr.appendAll(state.boundaryMap, Arr.makeBy(normalizedCluster.length, () => nextOriginalIndex)),
        original: state.original,
        originalIndex: nextOriginalIndex,
        value: `${state.value}${normalizedCluster}`
      }
    }
  )

/**
 * Normalizes a word for dictionary lookup using NFC and lowercase grapheme mapping.
 *
 * @since 0.2.0
 * @category internals
 */
export const normalizeHyphenationWord = (word: string): string => normalizedHyphenationWord(word).value

const mapNormalizedBreakPointsToOriginalWord = (
  normalizedWord: NormalizedHyphenationWord,
  breakPoints: ReadonlyArray<number>
): ReadonlyArray<number> =>
  sanitizeHyphenationBreakPoints(
    normalizedWord.original,
    Arr.map(
      sanitizeHyphenationBreakPoints(normalizedWord.value, breakPoints),
      (breakPoint) => normalizedWord.boundaryMap[breakPoint] ?? normalizedWord.original.length
    )
  )

/**
 * Sanitizes candidate break points against the provided word bounds.
 *
 * @since 0.2.0
 * @category internals
 */
export const normalizedHyphenationBreakPoints = (
  word: string,
  breakPoints: ReadonlyArray<number>
): ReadonlyArray<number> => sanitizeHyphenationBreakPoints(word, breakPoints)

const hyphenationPatternIds = (id: HyphenationPatternSource["id"]): ReadonlyArray<string> =>
  typeof id === "string" ? [id] : id

const indexedHyphenationPatterns = (
  patterns: ReadonlyArray<ParsedHyphenationPattern>
): IndexedHyphenationPatterns =>
  Rec.fromEntries(
    Arr.map(
      Rec.toEntries(
        Arr.groupBy(
          Arr.filter(patterns, (pattern) => pattern.letters.length > 0),
          (pattern) => pattern.letters[0] ?? hyphenationBoundaryMarker
        )
      ),
      ([firstCharacter, groupedPatterns]) =>
        Tuple.make(firstCharacter, Arr.sort(groupedPatterns, hyphenationPatternOrder))
    )
  )

const parseHyphenationPattern = (pattern: string): ParsedHyphenationPattern => {
  const parsed = Arr.reduce(
    Arr.fromIterable(pattern),
    {
      letters: Arr.empty<string>(),
      points: Arr.of(0)
    },
    (state, char) =>
      hyphenationDigitPattern.test(char)
        ? {
          letters: state.letters,
          points: Arr.append(Arr.take(state.points, state.points.length - 1), Number(char))
        }
        : {
          letters: Arr.append(state.letters, char),
          points: Arr.append(state.points, 0)
        }
  )

  return {
    letters: parsed.letters.join(""),
    points: parsed.points
  }
}

const parsedHyphenationPatterns = (
  patternGroups: HyphenationPatternSource["patterns"]
): ReadonlyArray<ParsedHyphenationPattern> =>
  Arr.flatMap(Rec.toEntries(patternGroups), ([sizeKey, body]) => {
    const size = Number(sizeKey)

    return Arr.makeBy(Math.ceil(body.length / size), (index) =>
      parseHyphenationPattern(body.slice(index * size, (index + 1) * size)))
  })

const hyphenationExceptionEntry = (
  exception: string
): readonly [string, ReadonlyArray<number>] => {
  const reduced = Arr.reduce(
    Arr.fromIterable(exception.trim()),
    {
      breakPoints: Arr.empty<number>(),
      word: ""
    },
    (state, char) =>
      char === "-"
        ? {
          breakPoints: Arr.append(state.breakPoints, state.word.length),
          word: state.word
        }
        : {
          breakPoints: state.breakPoints,
          word: `${state.word}${char}`
        }
  )
  const normalizedWord = normalizeHyphenationWord(reduced.word)

  return Tuple.make(normalizedWord, normalizedHyphenationBreakPoints(normalizedWord, reduced.breakPoints))
}

const hyphenationExceptions = (
  exceptions: HyphenationPatternSource["exceptions"]
): Readonly<Record<string, ReadonlyArray<number>>> =>
  Option.fromNullable(exceptions).pipe(
    Option.filter((value) => value.trim().length > 0),
    Option.match({
      onNone: () => ({}),
      onSome: (value) =>
        Rec.fromEntries(
          Arr.map(
            Arr.filter(Arr.fromIterable(value.split(/,\s*/u)), (exception) => exception.length > 0),
            hyphenationExceptionEntry
          )
        )
    })
  )

const isHyphenationPatternSource = (
  dictionary: HyphenationDictionarySource
): dictionary is HyphenationPatternSource =>
  "id" in dictionary &&
  "leftmin" in dictionary &&
  "rightmin" in dictionary &&
  "patterns" in dictionary

const normalizedHyphenationCharacters = (
  normalizedWord: string,
  substitutions: Readonly<Record<string, string>>
): ReadonlyArray<string> =>
  Arr.map(
    Arr.fromIterable(normalizedWord),
    (char) => substitutions[char] ?? char
  )

const overlayPatternPoints = (
  points: ReadonlyArray<number>,
  pattern: ParsedHyphenationPattern,
  matchIndex: number
): ReadonlyArray<number> =>
  Arr.map(
    points,
    (point, pointIndex) => Math.max(point, pattern.points[pointIndex - matchIndex] ?? 0)
  )

const compiledHyphenationPatternSource = (
  source: HyphenationPatternSource
): CompiledHyphenationPatternSource => ({
  charSubstitution: source.charSubstitution ?? {},
  exceptions: hyphenationExceptions(source.exceptions),
  leftMin: source.leftmin,
  patternIndex: indexedHyphenationPatterns(parsedHyphenationPatterns(source.patterns)),
  rightMin: source.rightmin
})

const hyphenationBreakPointsFromPatterns = (
  word: string,
  source: CompiledHyphenationPatternSource
): ReadonlyArray<number> => {
  const normalizedWord = normalizedHyphenationWord(word)
  const working = `${hyphenationBoundaryMarker}${
    normalizedHyphenationCharacters(normalizedWord.value, source.charSubstitution).join("")
  }${hyphenationBoundaryMarker}`

  const exceptionBreakPoints = Option.fromNullable(source.exceptions[normalizedWord.value])

  if (Option.isSome(exceptionBreakPoints)) {
    return mapNormalizedBreakPointsToOriginalWord(normalizedWord, exceptionBreakPoints.value)
  }

  if (working.length <= source.leftMin + source.rightMin + 1) {
    return Arr.empty<number>()
  }

  const initialPoints: ReadonlyArray<number> = Arr.makeBy(working.length + 1, () => 0)
  const startIndices = Arr.makeBy(working.length, (index) => index)
  const points = Arr.reduce(
    startIndices,
    initialPoints,
    (currentPoints, startIndex) =>
      Arr.reduce(
        source.patternIndex[working[startIndex] ?? hyphenationBoundaryMarker] ?? Arr.empty<ParsedHyphenationPattern>(),
        currentPoints,
        (nextPoints, pattern) => {
          if (!working.startsWith(pattern.letters, startIndex)) {
            return nextPoints
          }

          return overlayPatternPoints(nextPoints, pattern, startIndex)
        }
      )
  )

  return mapNormalizedBreakPointsToOriginalWord(
    normalizedWord,
    Arr.map(
      Arr.filter(
        Arr.makeBy(Math.max(working.length - 2, 0), (offset) => offset + 1),
        (index) => index > source.leftMin && index < working.length - source.rightMin && (points[index] ?? 0) % 2 === 1
      ),
      (index) => index - 1
    )
  )
}

const compiledWordBreakDictionary = (
  dictionary: HyphenationWordBreakDictionary
): CompiledHyphenationDictionary => {
  const normalizedDictionary = Rec.fromEntries(
    Arr.map(Rec.toEntries(dictionary), ([word, breakPoints]) => {
      const normalizedWord = normalizeHyphenationWord(word)

      return Tuple.make(normalizedWord, normalizedHyphenationBreakPoints(normalizedWord, breakPoints))
    })
  )

  return {
    hyphenateWord: (word: string) => {
      const normalizedWord = normalizedHyphenationWord(word)

      return mapNormalizedBreakPointsToOriginalWord(
        normalizedWord,
        normalizedDictionary[normalizedWord.value] ?? Arr.empty<number>()
      )
    }
  }
}

const compiledPatternDictionary = (
  source: HyphenationPatternSource
): CompiledHyphenationDictionary => {
  const compiledSource = compiledHyphenationPatternSource(source)

  return {
    hyphenateWord: (word: string) => hyphenationBreakPointsFromPatterns(word, compiledSource)
  }
}

/**
 * Compiles either shipped Liang patterns or explicit word-break dictionaries into a reusable matcher.
 *
 * @since 0.2.0
 * @category internals
 */
export const compileHyphenationDictionary = (
  dictionary: HyphenationDictionarySource
): CompiledHyphenationDictionary =>
  isHyphenationPatternSource(dictionary)
    ? compiledPatternDictionary(dictionary)
    : compiledWordBreakDictionary(dictionary)

const shippedHyphenationPatternSources = [
  enUsHyphenationPatternSource,
  enGbHyphenationPatternSource,
  deHyphenationPatternSource,
  frHyphenationPatternSource,
  esHyphenationPatternSource
]

const shippedHyphenationLocaleEntries = Arr.map(shippedHyphenationPatternSources, (source) => {
  const normalizedIds = Arr.map(hyphenationPatternIds(source.id), normalizeHyphenationLocale)

  return {
    ids: normalizedIds,
    primaryLocale: normalizedIds[0] ?? "",
    source
  }
})

/**
 * Internal support-data authority for the shipped hyphenation locale set and fallback policy.
 *
 * @since 0.2.0
 * @category internals
 */
export const shippedHyphenationSupport: ShippedHyphenationSupport = {
  localeFallback: HyphenationSupportManifest.localeFallback,
  locales: HyphenationSupportManifest.locales
}

/**
 * Internal map from normalized locale ids to the checked-in shipped pattern sources.
 *
 * @since 0.2.0
 * @category internals
 */
export const shippedHyphenationDictionarySources: Readonly<Record<string, HyphenationPatternSource>> = Rec.fromEntries(
  Arr.flatMap(
    shippedHyphenationLocaleEntries,
    (entry) => Arr.map(entry.ids, (id) => Tuple.make(id, entry.source))
  )
)

/**
 * Resolves one shipped pattern source using the released exact-or-base-language fallback policy.
 *
 * @since 0.2.0
 * @category internals
 */
export const shippedHyphenationDictionarySourceForLocale = (
  locale: string
): Option.Option<HyphenationPatternSource> =>
  Arr.reduce(
    hyphenationLocaleFallbackCandidates(locale),
    Option.none<HyphenationPatternSource>(),
    (resolved, candidate) =>
      Option.isSome(resolved)
        ? resolved
        : Option.fromNullable(shippedHyphenationDictionarySources[candidate])
  )

/**
 * Splits a word into preparation-time pieces annotated with dictionary break opportunities.
 *
 * @since 0.2.0
 * @category internals
 */
export const splitDictionaryHyphenationPieces = (
  word: string,
  breakPoints: ReadonlyArray<number>,
  finalBreakOpportunity: HyphenationBreakOpportunity
): ReadonlyArray<HyphenatedPiece> => {
  if (word.length === 0) {
    return Arr.empty()
  }

  const boundaries = Arr.append(sanitizeHyphenationBreakPoints(word, breakPoints), word.length)

  return Arr.reduce(
    boundaries,
    {
      pieces: Arr.empty<HyphenatedPiece>(),
      startIndex: 0
    },
    (state, boundary) => ({
      pieces: Arr.append(state.pieces, {
        breakOpportunity: boundary === word.length ? finalBreakOpportunity : "dictionary-hyphen",
        text: word.slice(state.startIndex, boundary)
      }),
      startIndex: boundary
    })
  ).pieces
}
