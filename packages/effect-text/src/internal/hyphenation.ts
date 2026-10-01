/** Locale fallback, Liang compilation, and original UTF-16 boundary mapping. @internal */
import { Array as Arr, Boolean, Chunk, Data, Match, Number, Option, Order, Record, Schema, String, Tuple } from "effect"

import * as Hyphenation from "../Hyphenation.js"
import { graphemeClusters } from "./grapheme.js"
import { de } from "./hyphenationPatterns/de.js"
import { enGb } from "./hyphenationPatterns/enGb.js"
import { enUs } from "./hyphenationPatterns/enUs.js"
import { es } from "./hyphenationPatterns/es.js"
import { fr } from "./hyphenationPatterns/fr.js"

/** Canonical preparation-time discretionary break vocabulary. */
export const BreakOpportunity = Schema.Literal("dictionary-hyphen", "none", "soft-hyphen")

/** Canonical preparation-time discretionary break vocabulary. */
export type BreakOpportunity = typeof BreakOpportunity.Type

/** A preparation-time slice with its trailing discretionary break. */
export class HyphenatedPiece extends Data.Class<{
  readonly breakOpportunity: BreakOpportunity
  readonly text: string
}> {}

class Pattern extends Data.Class<{ readonly letters: string; readonly points: Hyphenation.BreakPoints }> {}
class Word extends Data.Class<{
  readonly original: string
  readonly value: string
  readonly boundaryMap: Hyphenation.BreakPoints
}> {}
class WordState extends Data.Class<Word & { readonly originalIndex: number }> {}
class PatternState extends Data.Class<{
  readonly letters: Chunk.Chunk<string>
  readonly points: Hyphenation.BreakPoints
}> {}
class ExceptionState extends Data.Class<{ readonly word: string; readonly breakPoints: Hyphenation.BreakPoints }> {}
class CompiledPatterns extends Data.Class<{
  readonly charSubstitution: Record.ReadonlyRecord<string, string>
  readonly exceptions: Hyphenation.Words
  readonly leftMin: number
  readonly rightMin: number
  readonly index: Record.ReadonlyRecord<string, Chunk.Chunk<Pattern>>
}> {}

const strings = Schema.Array(Schema.String)
const isDigit = Schema.is(Schema.String.pipe(Schema.pattern(/^[0-9]$/u)))
const longestFirst = Order.reverse(Order.mapInput(Order.number, (pattern: Pattern) => String.length(pattern.letters)))

const sanitize = (word: string, points: Hyphenation.BreakPoints): Hyphenation.BreakPoints =>
  Arr.dedupe(Arr.sort(
    Arr.filter(points, (point) =>
      Boolean.and(
        Number.greaterThan(point, 0),
        Number.lessThan(point, String.length(word))
      )),
    Order.number
  ))

/** Canonical lowercase hyphen-separated locale spelling. */
export const normalizeLocale = (locale: string): string =>
  String.toLowerCase(String.replace(/_/gu, "-")(String.normalize("NFC")(String.trim(locale))))

/** Exact-to-base candidates, retaining script/region precedence. */
export const localeCandidates = (locale: string) => {
  const parts = Arr.filter(String.split("-")(normalizeLocale(locale)), String.isNonEmpty)
  return Arr.map(parts, (_part, index) => Arr.join(Arr.take(parts, Number.subtract(Arr.length(parts), index)), "-"))
}

const normalizeWord = (word: string): Word => {
  const state = Chunk.reduce(
    Chunk.fromIterable(graphemeClusters(word)),
    new WordState({
      boundaryMap: Arr.of(0),
      original: word,
      originalIndex: 0,
      value: String.empty
    }),
    (current, cluster) => {
      const normalized = String.toLowerCase(String.normalize("NFC")(cluster))
      const originalIndex = Number.sum(current.originalIndex, String.length(cluster))
      return new WordState({
        boundaryMap: Arr.appendAll(current.boundaryMap, Arr.makeBy(String.length(normalized), () => originalIndex)),
        original: word,
        originalIndex,
        value: String.concat(current.value, normalized)
      })
    }
  )
  return new Word({ original: state.original, value: state.value, boundaryMap: state.boundaryMap })
}

const originalPoints = (word: Word, points: Hyphenation.BreakPoints): Hyphenation.BreakPoints =>
  sanitize(
    word.original,
    Arr.map(sanitize(word.value, points), (point) =>
      Arr.get(word.boundaryMap, point).pipe(
        Option.getOrElse(() => String.length(word.original))
      ))
  )

const parsePattern = (pattern: string): Pattern => {
  const parsed = Arr.reduce(
    Arr.fromIterable(pattern),
    new PatternState({ letters: Chunk.empty(), points: Arr.of(0) }),
    (state, char) =>
      Boolean.match(isDigit(char), {
        onFalse: () =>
          new PatternState({ letters: Chunk.append(state.letters, char), points: Arr.append(state.points, 0) }),
        onTrue: () =>
          new PatternState({
            letters: state.letters,
            points: Arr.append(
              Arr.take(state.points, Number.decrement(Arr.length(state.points))),
              Number.parse(char).pipe(Option.getOrElse(() => 0))
            )
          })
      })
  )
  return new Pattern({ letters: Arr.join(parsed.letters, String.empty), points: parsed.points })
}

const parseGroups = (groups: Hyphenation.Patterns["patterns"]) =>
  Arr.flatMap(Record.toEntries(groups), ([sizeKey, body]) =>
    Number.parse(sizeKey).pipe(
      Option.filter(Number.greaterThan(0)),
      Option.match({
        onNone: Arr.empty<Pattern>,
        onSome: (size) =>
          Arr.map(Arr.chunksOf(Arr.filter(String.split("")(body), String.isNonEmpty), size), (units) =>
            parsePattern(Arr.join(units, "")))
      })
    ))

const exceptionEntry = (exception: string) => {
  const reduced = Arr.reduce(
    Arr.fromIterable(String.trim(exception)),
    new ExceptionState({ word: String.empty, breakPoints: Arr.empty() }),
    (state, char) =>
      Match.value(char).pipe(
        Match.when("-", () =>
          new ExceptionState({
            word: state.word,
            breakPoints: Arr.append(state.breakPoints, String.length(state.word))
          })),
        Match.orElse((letter) =>
          new ExceptionState({
            word: String.concat(state.word, letter),
            breakPoints: state.breakPoints
          })
        )
      )
  )
  const word = normalizeWord(reduced.word).value
  return Tuple.make(word, sanitize(word, reduced.breakPoints))
}

const compilePatterns = (source: Hyphenation.Patterns): CompiledPatterns =>
  new CompiledPatterns({
    charSubstitution: Option.fromNullable(source.charSubstitution).pipe(Option.getOrElse(Record.empty<string, string>)),
    exceptions: Option.fromNullable(source.exceptions).pipe(
      Option.map(String.trim),
      Option.filter(String.isNonEmpty),
      Option.match({
        onNone: Record.empty<string, Hyphenation.BreakPoints>,
        onSome: (value) =>
          Record.fromEntries(Arr.map(Arr.filter(String.split(/,\s*/u)(value), String.isNonEmpty), exceptionEntry))
      })
    ),
    leftMin: source.leftmin,
    rightMin: source.rightmin,
    index: Record.map(
      Arr.groupBy(
        Arr.filter(parseGroups(source.patterns), (pattern) => String.isNonEmpty(pattern.letters)),
        (pattern) => String.at(0)(pattern.letters).pipe(Option.getOrElse(() => "_"))
      ),
      (patterns) => Chunk.fromIterable(Arr.sort(patterns, longestFirst))
    )
  })

const matchPatterns = (word: Word, working: string, source: CompiledPatterns): Hyphenation.BreakPoints => {
  const length = String.length(working)
  return Boolean.match(
    Number.lessThanOrEqualTo(length, Number.increment(Number.sum(source.leftMin, source.rightMin))),
    {
      onTrue: Arr.empty<number>,
      onFalse: () => {
        const points = Arr.reduce(
          Arr.makeBy(length, (index) => index),
          Arr.makeBy(Number.increment(length), () => 0),
          (current, startIndex) => {
            const first = String.at(startIndex)(working).pipe(Option.getOrElse(() => "_"))
            const patterns = Record.get(source.index, first).pipe(Option.getOrElse(Chunk.empty<Pattern>))
            return Chunk.reduce(
              patterns,
              current,
              (next, pattern) =>
                Boolean.match(String.startsWith(pattern.letters, startIndex)(working), {
                  onFalse: () => next,
                  onTrue: () =>
                    Arr.map(next, (point, index) =>
                      Number.max(
                        point,
                        Arr.get(pattern.points, Number.subtract(index, startIndex)).pipe(Option.getOrElse(() => 0))
                      ))
                })
            )
          }
        )
        const candidates = Arr.filter(
          Arr.makeBy(Number.max(Number.subtract(length, 2), 0), Number.increment),
          (index) =>
            Boolean.and(
              Boolean.and(
                Number.greaterThan(index, source.leftMin),
                Number.lessThan(index, Number.subtract(length, source.rightMin))
              ),
              Number.Equivalence(Number.remainder(Arr.get(points, index).pipe(Option.getOrElse(() => 0)), 2), 1)
            )
        )
        return originalPoints(word, Arr.map(candidates, Number.decrement))
      }
    }
  )
}

const patternMatcher = (source: Hyphenation.Patterns): Hyphenation.Matcher => {
  const compiled = compilePatterns(source)
  return (text) => {
    const word = normalizeWord(text)
    const substituted = Arr.join(
      Arr.map(
        Arr.fromIterable(word.value),
        (char) => Record.get(compiled.charSubstitution, char).pipe(Option.getOrElse(() => char))
      ),
      String.empty
    )
    return Record.get(compiled.exceptions, word.value).pipe(Option.match({
      onNone: () => matchPatterns(word, String.concat(String.concat("_", substituted), "_"), compiled),
      onSome: (points) => originalPoints(word, points)
    }))
  }
}

const wordMatcher = (dictionary: Hyphenation.Words): Hyphenation.Matcher => {
  const normalized = Record.fromEntries(Arr.map(Record.toEntries(dictionary), ([word, points]) => {
    const key = normalizeWord(word).value
    return Tuple.make(key, sanitize(key, points))
  }))
  return (text) => {
    const word = normalizeWord(text)
    return originalPoints(word, Record.get(normalized, word.value).pipe(Option.getOrElse(Arr.empty<number>)))
  }
}

/** Compiles only source alternatives; a supplied matcher is retained unchanged. */
export const compileDictionary = (dictionary: Hyphenation.Dictionary): Hyphenation.Matcher =>
  Match.value(dictionary).pipe(Match.tagsExhaustive({
    Words: ({ words }) => wordMatcher(words),
    Patterns: ({ patterns }) => patternMatcher(patterns),
    Compiled: ({ hyphenateWord }) => hyphenateWord
  }))

/** Lazy source construction avoids initializing the public contract through an import cycle. */
export const shippedDictionaries = (): Record.ReadonlyRecord<string, Hyphenation.Dictionary> =>
  Record.fromEntries(Arr.flatMap(Arr.make(enUs(), enGb(), de(), fr(), es()), (source) => {
    const ids = Match.value(source.id).pipe(
      Match.when(String.isString, (id) => Arr.of(id)),
      Match.when(Schema.is(strings), (values) => values),
      Match.exhaustive
    )
    return Arr.map(ids, (id) => Tuple.make(normalizeLocale(id), Hyphenation.Dictionary.Patterns({ patterns: source })))
  }))

/** Splits only at bounded UTF-16 offsets, retaining the final explicit break. */
export const splitDictionaryHyphenationPieces = (
  word: string,
  breakPoints: Hyphenation.BreakPoints,
  finalBreakOpportunity: BreakOpportunity
) =>
  Boolean.match(String.isEmpty(word), {
    onTrue: Chunk.empty<HyphenatedPiece>,
    onFalse: () => {
      const length = String.length(word)
      const boundaries = Chunk.append(Chunk.fromIterable(sanitize(word, breakPoints)), length)
      return Tuple.getSecond(Chunk.mapAccum(boundaries, 0, (start, boundary) =>
        Tuple.make(
          boundary,
          new HyphenatedPiece({
            breakOpportunity: Boolean.match(Number.Equivalence(boundary, length), {
              onFalse: () => "dictionary-hyphen",
              onTrue: () => finalBreakOpportunity
            }),
            text: String.slice(start, boundary)(word)
          })
        )))
    }
  })
