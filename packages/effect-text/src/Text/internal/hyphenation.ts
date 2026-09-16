/**
 * Locale fallback, Liang-pattern compilation, and dictionary break-point lookup.
 *
 * @since 0.2.0
 */
import { Boolean, Match, Number, Order, Predicate, Schema, String } from "effect"
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
import {
  HyphenationBreakPoints,
  type HyphenationBreakPointsType,
  HyphenationDictionarySource,
  type HyphenationDictionarySourceType,
  HyphenationPatternSource,
  type HyphenationPatternSourceType,
  HyphenationWordBreakDictionary,
  type HyphenationWordBreakDictionaryType
} from "./hyphenationPatterns/schema.js"

export {
  HyphenationBreakPoints,
  type HyphenationBreakPointsType,
  HyphenationDictionarySource,
  type HyphenationDictionarySourceType,
  HyphenationPatternSource,
  type HyphenationPatternSourceType,
  HyphenationWordBreakDictionary,
  type HyphenationWordBreakDictionaryType
}

/** Internal break-opportunity tags compiled into prepared dictionary pieces. */
export const HyphenationBreakOpportunity = Schema.Literal("dictionary-hyphen", "none", "soft-hyphen")

/** Internal break-opportunity tags compiled into prepared dictionary pieces. */
export type HyphenationBreakOpportunity = typeof HyphenationBreakOpportunity.Type

/** Internal break-opportunity tags compiled into prepared dictionary pieces. */
export type HyphenationBreakOpportunityType = HyphenationBreakOpportunity

/** Internal preparation-time piece emitted after dictionary or soft-hyphen splitting. */
export class HyphenatedPiece extends Schema.Class<HyphenatedPiece>("effect-text/HyphenatedPiece")({
  breakOpportunity: HyphenationBreakOpportunity,
  text: Schema.String
}) {}

const HyphenatedPieces = Schema.Array(HyphenatedPiece)
type HyphenatedPiecesType = typeof HyphenatedPieces.Type

type HyphenateWord = (word: string) => HyphenationBreakPointsType
// A typed provider supplies this function. Runtime inspection establishes
// callability only; its return value remains the provider's TypeScript contract.
const HyphenateWord = Schema.declare((input): input is HyphenateWord => Predicate.isFunction(input))

/** Internal compiled matcher reused by the hyphenation layer caches. */
export const CompiledHyphenationDictionary = Schema.Struct({ hyphenateWord: HyphenateWord })
/** Internal compiled matcher reused by the hyphenation layer caches. */
export type CompiledHyphenationDictionary = typeof CompiledHyphenationDictionary.Type

/** A source requiring compilation or an already compiled provider. */
export const LoadedHyphenationDictionary = Schema.Union(CompiledHyphenationDictionary, HyphenationDictionarySource)
/** A source requiring compilation or an already compiled provider. */
export type LoadedHyphenationDictionary = typeof LoadedHyphenationDictionary.Type

class ParsedHyphenationPattern extends Schema.Class<ParsedHyphenationPattern>(
  "effect-text/ParsedHyphenationPattern"
)({
  letters: Schema.String,
  points: HyphenationBreakPoints
}) {}

const ParsedHyphenationPatterns = Schema.Array(ParsedHyphenationPattern)
type ParsedHyphenationPatternsType = typeof ParsedHyphenationPatterns.Type
const IndexedHyphenationPatterns = Schema.Record({ key: Schema.String, value: ParsedHyphenationPatterns })
type IndexedHyphenationPatternsType = typeof IndexedHyphenationPatterns.Type
const HyphenationSubstitutions = Schema.Record({ key: Schema.String, value: Schema.String })
type HyphenationSubstitutionsType = typeof HyphenationSubstitutions.Type
const HyphenationExceptions = Schema.Record({ key: Schema.String, value: HyphenationBreakPoints })
type HyphenationExceptionsType = typeof HyphenationExceptions.Type

class CompiledHyphenationPatternSource extends Schema.Class<CompiledHyphenationPatternSource>(
  "effect-text/CompiledHyphenationPatternSource"
)({
  charSubstitution: HyphenationSubstitutions,
  exceptions: HyphenationExceptions,
  leftMin: Schema.Number,
  patternIndex: IndexedHyphenationPatterns,
  rightMin: Schema.Number
}) {}

class NormalizedHyphenationWord extends Schema.Class<NormalizedHyphenationWord>(
  "effect-text/NormalizedHyphenationWord"
)({
  boundaryMap: HyphenationBreakPoints,
  original: Schema.String,
  value: Schema.String
}) {}

class NormalizedHyphenationWordState extends NormalizedHyphenationWord.extend<NormalizedHyphenationWordState>(
  "effect-text/NormalizedHyphenationWordState"
)({ originalIndex: Schema.Number }) {}

const StringValues = Schema.Array(Schema.String)
type StringValuesType = typeof StringValues.Type

class ParsedPatternState extends Schema.Class<ParsedPatternState>("effect-text/ParsedPatternState")({
  letters: StringValues,
  points: HyphenationBreakPoints
}) {}

class HyphenationExceptionState extends Schema.Class<HyphenationExceptionState>(
  "effect-text/HyphenationExceptionState"
)({
  breakPoints: HyphenationBreakPoints,
  word: Schema.String
}) {}

class ShippedHyphenationLocaleEntry extends Schema.Class<ShippedHyphenationLocaleEntry>(
  "effect-text/ShippedHyphenationLocaleEntry"
)({
  ids: StringValues,
  primaryLocale: Schema.String,
  source: HyphenationPatternSource
}) {}

const hyphenationBoundaryMarker = "_"
const isHyphenationDigit = Schema.is(Schema.String.pipe(Schema.pattern(/^[0-9]$/u)))
const hyphenationPatternOrder = Order.reverse(
  Order.mapInput(Order.number, (pattern: ParsedHyphenationPattern) => String.length(pattern.letters))
)

const sanitizeHyphenationBreakPoints = (
  word: string,
  breakPoints: HyphenationBreakPointsType
): HyphenationBreakPointsType =>
  Arr.dedupe(Arr.sort(
    Arr.filter(breakPoints, (breakPoint) =>
      Boolean.and(
        Number.greaterThan(breakPoint, 0),
        Number.lessThan(breakPoint, String.length(word))
      )),
    Order.number
  ))

/** Canonicalizes locale identifiers into the shipped lowercase hyphenated form. */
export const normalizeHyphenationLocale = (locale: string): string =>
  String.toLowerCase(String.replace(/_/gu, "-")(String.normalize("NFC")(String.trim(locale))))

/** Produces exact-to-base-language lookup candidates for a requested locale. */
export const hyphenationLocaleFallbackCandidates = (locale: string): StringValuesType => {
  const normalizedLocale = normalizeHyphenationLocale(locale)
  const parts = Arr.filter(String.split("-")(normalizedLocale), String.isNonEmpty)

  return Arr.map(parts, (_part, index) => Arr.join(Arr.take(parts, Number.subtract(Arr.length(parts), index)), "-"))
}

const normalizedHyphenationWord = (word: string): NormalizedHyphenationWord => {
  const state = Arr.reduce(
    graphemeClusters(word),
    new NormalizedHyphenationWordState({
      boundaryMap: Arr.of(0),
      original: word,
      originalIndex: 0,
      value: String.empty
    }),
    (current, cluster) => {
      const normalizedCluster = String.toLowerCase(String.normalize("NFC")(cluster))
      const nextOriginalIndex = Number.sum(current.originalIndex, String.length(cluster))

      return new NormalizedHyphenationWordState({
        boundaryMap: Arr.appendAll(
          current.boundaryMap,
          Arr.makeBy(String.length(normalizedCluster), () => nextOriginalIndex)
        ),
        original: current.original,
        originalIndex: nextOriginalIndex,
        value: String.concat(current.value, normalizedCluster)
      })
    }
  )

  return new NormalizedHyphenationWord({
    boundaryMap: state.boundaryMap,
    original: state.original,
    value: state.value
  })
}

/** Normalizes a word for dictionary lookup using NFC and lowercase grapheme mapping. */
export const normalizeHyphenationWord = (word: string): string => normalizedHyphenationWord(word).value

const mapNormalizedBreakPointsToOriginalWord = (
  normalizedWord: NormalizedHyphenationWord,
  breakPoints: HyphenationBreakPointsType
): HyphenationBreakPointsType =>
  sanitizeHyphenationBreakPoints(
    normalizedWord.original,
    Arr.map(sanitizeHyphenationBreakPoints(normalizedWord.value, breakPoints), (breakPoint) =>
      Arr.get(normalizedWord.boundaryMap, breakPoint).pipe(
        Option.getOrElse(() =>
          String.length(normalizedWord.original)
        )
      ))
  )

/** Sanitizes candidate break points against the provided word bounds. */
export const normalizedHyphenationBreakPoints = (
  word: string,
  breakPoints: HyphenationBreakPointsType
): HyphenationBreakPointsType => sanitizeHyphenationBreakPoints(word, breakPoints)

const hyphenationPatternIds = (id: HyphenationPatternSourceType["id"]): StringValuesType =>
  Match.value(id).pipe(
    Match.when(String.isString, (identifier) => Arr.of(identifier)),
    Match.when(Schema.is(StringValues), (ids) => ids),
    Match.exhaustive
  )

const indexedHyphenationPatterns = (
  patterns: ParsedHyphenationPatternsType
): IndexedHyphenationPatternsType =>
  Rec.fromEntries(
    Arr.map(
      Rec.toEntries(
        Arr.groupBy(
          Arr.filter(patterns, (pattern) => String.isNonEmpty(pattern.letters)),
          (pattern) => String.at(0)(pattern.letters).pipe(Option.getOrElse(() => hyphenationBoundaryMarker))
        )
      ),
      ([firstCharacter, groupedPatterns]) =>
        Tuple.make(firstCharacter, Arr.sort(groupedPatterns, hyphenationPatternOrder))
    )
  )

const parseHyphenationPattern = (pattern: string): ParsedHyphenationPattern => {
  const parsed = Arr.reduce(
    Arr.fromIterable(pattern),
    new ParsedPatternState({ letters: Arr.empty<string>(), points: Arr.of(0) }),
    (state, char) =>
      Boolean.match(isHyphenationDigit(char), {
        onFalse: () =>
          new ParsedPatternState({
            letters: Arr.append(state.letters, char),
            points: Arr.append(state.points, 0)
          }),
        onTrue: () =>
          new ParsedPatternState({
            letters: state.letters,
            points: Arr.append(
              Arr.take(state.points, Number.decrement(Arr.length(state.points))),
              Number.parse(char).pipe(Option.getOrElse(() => 0))
            )
          })
      })
  )

  return new ParsedHyphenationPattern({
    letters: Arr.join(parsed.letters, String.empty),
    points: parsed.points
  })
}

const parsedHyphenationPatterns = (
  patternGroups: HyphenationPatternSourceType["patterns"]
): ParsedHyphenationPatternsType =>
  Arr.flatMap(Rec.toEntries(patternGroups), ([sizeKey, body]) =>
    Number.parse(sizeKey).pipe(
      Option.filter(Number.greaterThan(0)),
      Option.match({
        onNone: Arr.empty<ParsedHyphenationPattern>,
        onSome: (size) =>
          Arr.map(
            Arr.chunksOf(Arr.filter(String.split("")(body), String.isNonEmpty), size),
            (units) => parseHyphenationPattern(Arr.join(units, ""))
          )
      })
    ))

const hyphenationExceptionEntry = (exception: string) => {
  const reduced = Arr.reduce(
    Arr.fromIterable(String.trim(exception)),
    new HyphenationExceptionState({ breakPoints: Arr.empty<number>(), word: String.empty }),
    (state, char) =>
      Match.value(char).pipe(
        Match.when("-", () =>
          new HyphenationExceptionState({
            breakPoints: Arr.append(state.breakPoints, String.length(state.word)),
            word: state.word
          })),
        Match.orElse((letter) =>
          new HyphenationExceptionState({
            breakPoints: state.breakPoints,
            word: String.concat(state.word, letter)
          })
        )
      )
  )
  const normalizedWord = normalizeHyphenationWord(reduced.word)
  return Tuple.make(normalizedWord, normalizedHyphenationBreakPoints(normalizedWord, reduced.breakPoints))
}

const hyphenationExceptions = (
  exceptions: HyphenationPatternSourceType["exceptions"]
): HyphenationExceptionsType =>
  Option.fromNullable(exceptions).pipe(
    Option.map(String.trim),
    Option.filter(String.isNonEmpty),
    Option.match({
      onNone: Rec.empty<string, HyphenationBreakPointsType>,
      onSome: (value) =>
        Rec.fromEntries(
          Arr.map(Arr.filter(String.split(/,\s*/u)(value), String.isNonEmpty), hyphenationExceptionEntry)
        )
    })
  )

const normalizedHyphenationCharacters = (
  normalizedWord: string,
  substitutions: HyphenationSubstitutionsType
): StringValuesType =>
  Arr.map(Arr.fromIterable(normalizedWord), (char) => Rec.get(substitutions, char).pipe(Option.getOrElse(() => char)))

const overlayPatternPoints = (
  points: HyphenationBreakPointsType,
  pattern: ParsedHyphenationPattern,
  matchIndex: number
): HyphenationBreakPointsType =>
  Arr.map(points, (point, pointIndex) =>
    Number.max(
      point,
      Arr.get(pattern.points, Number.subtract(pointIndex, matchIndex)).pipe(Option.getOrElse(() => 0))
    ))

const compiledHyphenationPatternSource = (
  source: HyphenationPatternSourceType
): CompiledHyphenationPatternSource =>
  new CompiledHyphenationPatternSource({
    charSubstitution: Option.fromNullable(source.charSubstitution).pipe(
      Option.getOrElse(Rec.empty<string, string>)
    ),
    exceptions: hyphenationExceptions(source.exceptions),
    leftMin: source.leftmin,
    patternIndex: indexedHyphenationPatterns(parsedHyphenationPatterns(source.patterns)),
    rightMin: source.rightmin
  })

const patternBreakPoints = (
  normalizedWord: NormalizedHyphenationWord,
  working: string,
  source: CompiledHyphenationPatternSource
): HyphenationBreakPointsType => {
  const workingLength = String.length(working)
  const minimumWorkingLength = Number.increment(Number.sum(source.leftMin, source.rightMin))

  return Boolean.match(Number.lessThanOrEqualTo(workingLength, minimumWorkingLength), {
    onTrue: Arr.empty<number>,
    onFalse: () => {
      const initialPoints: HyphenationBreakPointsType = Arr.makeBy(Number.increment(workingLength), () => 0)
      const points = Arr.reduce(
        Arr.makeBy(workingLength, (index) => index),
        initialPoints,
        (currentPoints, startIndex) => {
          const firstCharacter = String.at(startIndex)(working).pipe(
            Option.getOrElse(() => hyphenationBoundaryMarker)
          )
          const patterns = Rec.get(source.patternIndex, firstCharacter).pipe(
            Option.getOrElse(Arr.empty<ParsedHyphenationPattern>)
          )
          return Arr.reduce(
            patterns,
            currentPoints,
            (nextPoints, pattern) =>
              Boolean.match(String.startsWith(pattern.letters, startIndex)(working), {
                onFalse: () => nextPoints,
                onTrue: () => overlayPatternPoints(nextPoints, pattern, startIndex)
              })
          )
        }
      )
      const candidateCount = Number.max(Number.subtract(workingLength, 2), 0)
      const normalizedBreakPoints = Arr.map(
        Arr.filter(Arr.makeBy(candidateCount, Number.increment), (index) => {
          const insideLeft = Number.greaterThan(index, source.leftMin)
          const insideRight = Number.lessThan(index, Number.subtract(workingLength, source.rightMin))
          const isOdd = Number.Equivalence(
            Number.remainder(Arr.get(points, index).pipe(Option.getOrElse(() => 0)), 2),
            1
          )
          return Boolean.and(Boolean.and(insideLeft, insideRight), isOdd)
        }),
        Number.decrement
      )
      return mapNormalizedBreakPointsToOriginalWord(normalizedWord, normalizedBreakPoints)
    }
  })
}

const hyphenationBreakPointsFromPatterns = (
  word: string,
  source: CompiledHyphenationPatternSource
): HyphenationBreakPointsType => {
  const normalizedWord = normalizedHyphenationWord(word)
  const substitutedWord = Arr.join(
    normalizedHyphenationCharacters(normalizedWord.value, source.charSubstitution),
    String.empty
  )
  const working = String.concat(
    String.concat(hyphenationBoundaryMarker, substitutedWord),
    hyphenationBoundaryMarker
  )

  return Rec.get(source.exceptions, normalizedWord.value).pipe(
    Option.match({
      onNone: () => patternBreakPoints(normalizedWord, working, source),
      onSome: (breakPoints) => mapNormalizedBreakPointsToOriginalWord(normalizedWord, breakPoints)
    })
  )
}

const compiledWordBreakDictionary = (
  dictionary: HyphenationWordBreakDictionaryType
): CompiledHyphenationDictionary => {
  const normalizedDictionary = Rec.fromEntries(
    Arr.map(Rec.toEntries(dictionary), ([word, breakPoints]) => {
      const normalizedWord = normalizeHyphenationWord(word)
      return Tuple.make(normalizedWord, normalizedHyphenationBreakPoints(normalizedWord, breakPoints))
    })
  )

  return {
    hyphenateWord: (word) => {
      const normalizedWord = normalizedHyphenationWord(word)
      const breakPoints = Rec.get(normalizedDictionary, normalizedWord.value).pipe(
        Option.getOrElse(Arr.empty<number>)
      )
      return mapNormalizedBreakPointsToOriginalWord(normalizedWord, breakPoints)
    }
  }
}

const compiledPatternDictionary = (
  source: HyphenationPatternSourceType
): CompiledHyphenationDictionary => {
  const compiledSource = compiledHyphenationPatternSource(source)
  return {
    hyphenateWord: (word) => hyphenationBreakPointsFromPatterns(word, compiledSource)
  }
}

/** Reuses compiled providers or compiles Liang patterns and explicit word breaks. */
export const compileHyphenationDictionary = (
  dictionary: LoadedHyphenationDictionary
): CompiledHyphenationDictionary =>
  Match.value(dictionary).pipe(
    Match.when(Schema.is(CompiledHyphenationDictionary), (compiled) => compiled),
    Match.not(Schema.is(HyphenationWordBreakDictionary), compiledPatternDictionary),
    Match.when(Schema.is(HyphenationWordBreakDictionary), compiledWordBreakDictionary),
    Match.exhaustive
  )

const HyphenationPatternSources = Schema.Array(HyphenationPatternSource)
const shippedHyphenationPatternSources: typeof HyphenationPatternSources.Type = Arr.make(
  enUsHyphenationPatternSource,
  enGbHyphenationPatternSource,
  deHyphenationPatternSource,
  frHyphenationPatternSource,
  esHyphenationPatternSource
)

const shippedHyphenationLocaleEntries = Arr.map(shippedHyphenationPatternSources, (source) => {
  const normalizedIds = Arr.map(hyphenationPatternIds(source.id), normalizeHyphenationLocale)
  return new ShippedHyphenationLocaleEntry({
    ids: normalizedIds,
    primaryLocale: Arr.head(normalizedIds).pipe(Option.getOrElse(() => String.empty)),
    source
  })
})

/** Internal locale set and fallback policy consumed by the dictionary layer. */
export const shippedHyphenationSupport = HyphenationSupportManifest

const HyphenationPatternSourcesByLocale = Schema.Record({
  key: Schema.String,
  value: HyphenationPatternSource
})

/** Internal map from normalized locale ids to the checked-in shipped pattern sources. */
export const shippedHyphenationDictionarySources: typeof HyphenationPatternSourcesByLocale.Type = Rec.fromEntries(
  Arr.flatMap(shippedHyphenationLocaleEntries, (entry) => Arr.map(entry.ids, (id) => Tuple.make(id, entry.source)))
)

/** Resolves one shipped source using the released exact-or-base-language fallback policy. */
export const shippedHyphenationDictionarySourceForLocale = (
  locale: string
): Option.Option<HyphenationPatternSourceType> =>
  Arr.findFirst(
    hyphenationLocaleFallbackCandidates(locale),
    (candidate) => Rec.has(shippedHyphenationDictionarySources, candidate)
  ).pipe(
    Option.flatMap((candidate) => Rec.get(shippedHyphenationDictionarySources, candidate))
  )

/** Splits a word into preparation-time pieces annotated with dictionary break opportunities. */
export const splitDictionaryHyphenationPieces = (
  word: string,
  breakPoints: HyphenationBreakPointsType,
  finalBreakOpportunity: HyphenationBreakOpportunityType
): HyphenatedPiecesType =>
  Boolean.match(String.isEmpty(word), {
    onTrue: Arr.empty<HyphenatedPiece>,
    onFalse: () => {
      const wordLength = String.length(word)
      const boundaries = Arr.append(sanitizeHyphenationBreakPoints(word, breakPoints), wordLength)
      return Tuple.getSecond(Arr.mapAccum(boundaries, 0, (startIndex, boundary) =>
        Tuple.make(
          boundary,
          new HyphenatedPiece({
            breakOpportunity: Boolean.match(Number.Equivalence(boundary, wordLength), {
              onFalse: () => "dictionary-hyphen",
              onTrue: () => finalBreakOpportunity
            }),
            text: String.slice(startIndex, boundary)(word)
          })
        )))
    }
  })
