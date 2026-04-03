/**
 * Internal segmentation helpers.
 *
 * @since 0.1.0
 */
import { Option } from "effect"
import * as Arr from "effect/Array"

import type { BaseTextDirectionType, TextSegmentType, WhiteSpaceModeType } from "../schema.js"

export const SOFT_HYPHEN = "\u00ad"

const TAB = "\t"
const RTL_PATTERN = /[\u0590-\u08ff\uFB1D-\uFDFD\uFE70-\uFEFC]/u
const STRONG_PATTERN = /\p{Letter}|\p{Number}/u
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u
const Segmenter = typeof Intl === "undefined" ? undefined : Reflect.get(Intl, "Segmenter")

type TextDirection = "ltr" | "rtl" | "neutral"
type WhitespaceToken = readonly [kind: "space" | "tab", text: string]
type SoftHyphenPiece = readonly [text: string, breakAfter: boolean]

const classifySegment = (text: string): TextSegmentType =>
  text === "\n"
    ? { kind: "hard-break", text }
    : /^\s+$/.test(text)
    ? { kind: "space", text }
    : { kind: "text", text }

const segmentedMatches = (input: string, pattern: RegExp): ReadonlyArray<TextSegmentType> =>
  Arr.fromIterable(input.matchAll(pattern)).map((match) => classifySegment(match[0]))

const normalizeWhitespace = (text: string): string => text.trim().replace(/\s+/g, " ")

const graphemeClusters = (text: string): ReadonlyArray<string> =>
  typeof Segmenter === "function"
    ? Arr.fromIterable(new Segmenter(undefined, { granularity: "grapheme" }).segment(text)).map((part) => part.segment)
    : Arr.fromIterable(text)

/**
 * Builds text, space, and hard-break segments.
 *
 * @since 0.1.0
 * @category internals
 */
export const segmentText = (text: string, whiteSpace: WhiteSpaceModeType): ReadonlyArray<TextSegmentType> =>
  whiteSpace === "normal"
    ? segmentedMatches(normalizeWhitespace(text), /( +|[^\s]+)/g)
    : segmentedMatches(text.replace(/\r\n/g, "\n"), /(\n|[^\S\n]+|[^\s]+)/g)

export const detectTextDirection = (text: string): TextDirection => {
  const strongCharacter = Arr.fromIterable(text).find((char) => RTL_PATTERN.test(char) || STRONG_PATTERN.test(char))

  return Option.fromNullable(strongCharacter).pipe(
    Option.match({
      onNone: () => "neutral",
      onSome: (char) => (RTL_PATTERN.test(char) ? "rtl" : "ltr")
    })
  )
}

export const resolveBaseDirection = (text: string, fallback: BaseTextDirectionType): BaseTextDirectionType => {
  const direction = detectTextDirection(text)
  return direction === "neutral" ? fallback : direction
}

export const bidiLevelForDirection = (direction: TextDirection, baseDirection: BaseTextDirectionType): number =>
  direction === "neutral" ? (baseDirection === "rtl" ? 1 : 0) : direction === "rtl" ? 1 : 0

export const splitWhitespaceTokens = (text: string): ReadonlyArray<WhitespaceToken> =>
  Arr.fromIterable(text).reduce<ReadonlyArray<WhitespaceToken>>((tokens, char) => {
    const token: WhitespaceToken = char === TAB ? ["tab", char] : ["space", char]

    return Option.fromNullable(tokens[tokens.length - 1]).pipe(
      Option.match({
        onNone: () => [...tokens, token],
        onSome: (previous) =>
          previous[0] === token[0] && token[0] === "space"
            ? [...tokens.slice(0, -1), ["space", previous[1] + char]]
            : [...tokens, token]
      })
    )
  }, [])

export const splitSoftHyphenPieces = (text: string): ReadonlyArray<SoftHyphenPiece> =>
  text.split(SOFT_HYPHEN).reduce<ReadonlyArray<SoftHyphenPiece>>((pieces, part, index, parts) => {
    if (part.length === 0) {
      return pieces
    }

    return [...pieces, [part, index < parts.length - 1]]
  }, [])

export const containsEmoji = (text: string): boolean => EMOJI_PATTERN.test(text)

export const stripEmojiClusters = (text: string): readonly [string, number] => {
  const result = graphemeClusters(text).reduce(
    (state, cluster) =>
      EMOJI_PATTERN.test(cluster)
        ? { text: state.text, count: state.count + 1 }
        : { text: state.text + cluster, count: state.count },
    { text: "", count: 0 }
  )

  return [result.text, result.count]
}
