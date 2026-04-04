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

import { deHyphenationPatternSource } from "./hyphenationPatterns/de.js"
import { enGbHyphenationPatternSource } from "./hyphenationPatterns/enGb.js"
import { enUsHyphenationPatternSource } from "./hyphenationPatterns/enUs.js"
import { esHyphenationPatternSource } from "./hyphenationPatterns/es.js"
import { frHyphenationPatternSource } from "./hyphenationPatterns/fr.js"

export type HyphenationBreakOpportunity = "dictionary-hyphen" | "none" | "soft-hyphen"

export type HyphenatedPiece = Readonly<{
  breakOpportunity: HyphenationBreakOpportunity
  text: string
}>

export type HyphenationWordBreakDictionary = Readonly<Record<string, ReadonlyArray<number>>>

export type HyphenationPatternSource = Readonly<{
  id: string | ReadonlyArray<string>
  leftmin: number
  rightmin: number
  patterns: Readonly<Record<string, string>>
  charSubstitution?: Readonly<Record<string, string>>
  exceptions?: string
}>

export type HyphenationDictionarySource = HyphenationPatternSource | HyphenationWordBreakDictionary

export type CompiledHyphenationDictionary = Readonly<{
  hyphenateWord: (word: string) => ReadonlyArray<number>
}>

type ParsedHyphenationPattern = Readonly<{
  letters: string
  points: ReadonlyArray<number>
}>

type CompiledHyphenationPatternSource = Readonly<{
  charSubstitution: Readonly<Record<string, string>>
  exceptions: Readonly<Record<string, ReadonlyArray<number>>>
  leftMin: number
  patterns: ReadonlyArray<ParsedHyphenationPattern>
  rightMin: number
}>

const hyphenationBoundaryMarker = "_"
const hyphenationDigitPattern = /^[0-9]$/u

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

export const normalizeHyphenationLocale = (locale: string): string => locale.trim().toLowerCase()

export const normalizeHyphenationWord = (word: string): string => word.toLowerCase()

export const normalizedHyphenationBreakPoints = (
  word: string,
  breakPoints: ReadonlyArray<number>
): ReadonlyArray<number> => sanitizeHyphenationBreakPoints(word, breakPoints)

const hyphenationPatternIds = (id: HyphenationPatternSource["id"]): ReadonlyArray<string> =>
  typeof id === "string" ? [id] : id

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
  word: string,
  substitutions: Readonly<Record<string, string>>
): ReadonlyArray<string> =>
  Arr.map(
    Arr.fromIterable(normalizeHyphenationWord(word)),
    (char) => substitutions[char] ?? char
  )

const patternMatchIndices = (
  text: string,
  pattern: string,
  startIndex: number = 0
): ReadonlyArray<number> => {
  const matchIndex = text.indexOf(pattern, startIndex)

  return matchIndex === -1
    ? Arr.empty<number>()
    : Arr.prepend(patternMatchIndices(text, pattern, matchIndex + 1), matchIndex)
}

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
  patterns: parsedHyphenationPatterns(source.patterns),
  rightMin: source.rightmin
})

const hyphenationBreakPointsFromPatterns = (
  word: string,
  source: CompiledHyphenationPatternSource
): ReadonlyArray<number> => {
  const normalizedWord = normalizeHyphenationWord(word)
  const working = `${hyphenationBoundaryMarker}${
    normalizedHyphenationCharacters(word, source.charSubstitution).join("")
  }${hyphenationBoundaryMarker}`

  const exceptionBreakPoints = Option.fromNullable(source.exceptions[normalizedWord])

  if (Option.isSome(exceptionBreakPoints)) {
    return exceptionBreakPoints.value
  }

  if (working.length <= source.leftMin + source.rightMin + 1) {
    return Arr.empty<number>()
  }

  const initialPoints: ReadonlyArray<number> = Arr.makeBy(working.length + 1, () => 0)
  const points = Arr.reduce(
    source.patterns,
    initialPoints,
    (currentPoints, pattern) =>
      pattern.letters.length === 0
        ? currentPoints
        : Arr.reduce(
          patternMatchIndices(working, pattern.letters),
          currentPoints,
          (nextPoints, matchIndex) => overlayPatternPoints(nextPoints, pattern, matchIndex)
        )
  )

  return normalizedHyphenationBreakPoints(
    word,
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
    hyphenateWord: (word: string) => normalizedDictionary[normalizeHyphenationWord(word)] ?? Arr.empty<number>()
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

export const shippedHyphenationDictionarySources: Readonly<Record<string, HyphenationPatternSource>> = Rec.fromEntries(
  Arr.flatMap(
    shippedHyphenationPatternSources,
    (source) => Arr.map(hyphenationPatternIds(source.id), (id) => Tuple.make(normalizeHyphenationLocale(id), source))
  )
)

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
