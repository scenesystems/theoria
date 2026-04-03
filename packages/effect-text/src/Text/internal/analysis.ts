/**
 * Internal segmentation helpers.
 *
 * @since 0.1.0
 */
import { Option } from "effect"
import * as Arr from "effect/Array"

import type { BaseTextDirectionType, TextSegmentType, WhiteSpaceModeType } from "../schema.js"

export const SOFT_HYPHEN = "\u00ad"
export const NO_BREAK_SPACE = "\u00a0"
export const WORD_JOINER = "\u2060"
export const ZERO_WIDTH_SPACE = "\u200b"

const TAB = "\t"
const LINE_FEED = "\n"
const RTL_PATTERN = /[\u0590-\u08ff\uFB1D-\uFDFD\uFE70-\uFEFC]/u
const STRONG_PATTERN = /\p{Letter}|\p{Number}/u
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u
const COMBINING_MARK_PATTERN = /\p{Mark}/u
const VARIATION_SELECTOR_PATTERN = /[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/u
const EMOJI_MODIFIER_PATTERN = /\p{Emoji_Modifier}/u
const REGIONAL_INDICATOR_PATTERN = /\p{Regional_Indicator}/u
const NO_SPACE_SCRIPT_PATTERN =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u
const OPENING_PUNCTUATION_PATTERN =
  /^[([{\u2018\u201C\u00AB\u2039\u3008\u300A\u300C\u300E\u3010\u3014\uFF08\uFF3B\uFF5B]+$/u
const CLOSING_PUNCTUATION_PATTERN =
  /^[)\]}\u2019\u201D\u00BB\u203A\u3001\u3002\u3009\u300B\u300D\u300F\u3011\u3015\uFF09\uFF3D\uFF5D\uFF0C\uFF0E!?;,.:]+$/u
const RUN_CONNECTOR_PATTERN = /^[-._~/:@?&=#%+]+$/u

type TextDirection = "ltr" | "rtl" | "neutral"
type WhitespaceToken = readonly [kind: "space" | "tab", text: string]
type SoftHyphenPiece = readonly [text: string, breakAfter: boolean]

const makeWordPiece = (segment: string, isWordLike: boolean) => ({ isWordLike, segment })
const textSegment = (text: string): TextSegmentType => ({ kind: "text", text })
const spaceSegment = (text: string): TextSegmentType => ({ kind: "space", text })
const hardBreakSegment = (): TextSegmentType => ({ kind: "hard-break", text: LINE_FEED })
const emptyTextSegments = (): ReadonlyArray<TextSegmentType> => []

const getSegmenter = (granularity: "word" | "grapheme") => {
  const Segmenter = globalThis.Intl?.Segmenter
  return Segmenter ? new Segmenter(undefined, { granularity }) : undefined
}

const normalizeLineBreaks = (text: string): string => text.replace(/\r\n?/gu, LINE_FEED)

const isOrdinaryWhitespaceCharacter = (char: string): boolean =>
  char === " " || char === TAB || char === LINE_FEED || char === "\u000b" || char === "\u000c"

const isOrdinaryWhitespace = (text: string): boolean =>
  text.length > 0 && Arr.fromIterable(text).every(isOrdinaryWhitespaceCharacter)

const isClosingPunctuation = (text: string): boolean => CLOSING_PUNCTUATION_PATTERN.test(text)

const isOpeningPunctuation = (text: string): boolean => OPENING_PUNCTUATION_PATTERN.test(text)

const isRunConnector = (text: string): boolean => RUN_CONNECTOR_PATTERN.test(text)

const fallbackGraphemeClusters = (text: string): ReadonlyArray<string> =>
  Arr.fromIterable(text).reduce<ReadonlyArray<string>>((clusters, char) => {
    const previous = clusters[clusters.length - 1]

    return Option.fromNullable(previous).pipe(
      Option.match({
        onNone: () => [...clusters, char],
        onSome: (lastCluster) =>
          lastCluster.endsWith("\u200d") ||
            COMBINING_MARK_PATTERN.test(char) ||
            VARIATION_SELECTOR_PATTERN.test(char) ||
            EMOJI_MODIFIER_PATTERN.test(char) ||
            (REGIONAL_INDICATOR_PATTERN.test(char) && REGIONAL_INDICATOR_PATTERN.test(lastCluster))
            ? [...clusters.slice(0, -1), lastCluster + char]
            : [...clusters, char]
      })
    )
  }, [])

export const graphemeClusters = (text: string): ReadonlyArray<string> => {
  const segmenter = getSegmenter("grapheme")

  return segmenter
    ? Arr.fromIterable(segmenter.segment(text)).map((part) => part.segment)
    : fallbackGraphemeClusters(text)
}

const fallbackWordPieces = (text: string): ReadonlyArray<{ readonly isWordLike: boolean; readonly segment: string }> =>
  NO_SPACE_SCRIPT_PATTERN.test(text)
    ? graphemeClusters(text).map((segment) => makeWordPiece(segment, true))
    : [makeWordPiece(text, true)]

const wordPiecesFor = (text: string): ReadonlyArray<{ readonly isWordLike: boolean; readonly segment: string }> => {
  const segmenter = getSegmenter("word")

  return segmenter
    ? Arr.fromIterable(segmenter.segment(text)).map((part) => makeWordPiece(part.segment, Boolean(part.isWordLike)))
    : fallbackWordPieces(text)
}

const mergeWordPieces = (
  pieces: ReadonlyArray<{ readonly isWordLike: boolean; readonly segment: string }>
): ReadonlyArray<string> =>
  pieces.reduce<ReadonlyArray<string>>((segments, piece) => {
    const previous = segments[segments.length - 1]

    return Option.fromNullable(previous).pipe(
      Option.match({
        onNone: () => [piece.segment],
        onSome: (lastSegment) => {
          const shouldMerge = lastSegment.endsWith(NO_BREAK_SPACE) ||
            lastSegment.endsWith(WORD_JOINER) ||
            isOpeningPunctuation(lastSegment) ||
            isClosingPunctuation(piece.segment) ||
            isRunConnector(piece.segment) ||
            (piece.isWordLike && isRunConnector(lastSegment.slice(-1)))

          return shouldMerge
            ? [...segments.slice(0, -1), lastSegment + piece.segment]
            : [...segments, piece.segment]
        }
      })
    )
  }, [])

const textSegmentsFor = (text: string): ReadonlyArray<TextSegmentType> =>
  text
    .split(ZERO_WIDTH_SPACE)
    .reduce<ReadonlyArray<TextSegmentType>>((segments, part, index, parts) => {
      const mergedParts = part.length === 0
        ? segments
        : [
          ...segments,
          ...mergeWordPieces(wordPiecesFor(part)).map(textSegment)
        ]

      return index < parts.length - 1
        ? [...mergedParts, textSegment(ZERO_WIDTH_SPACE)]
        : mergedParts
    }, emptyTextSegments())

const segmentNormalText = (text: string): ReadonlyArray<TextSegmentType> =>
  wordPiecesFor(normalizeLineBreaks(text)).reduce(
    (state, piece) =>
      piece.segment === LINE_FEED || isOrdinaryWhitespace(piece.segment)
        ? {
          pendingSpace: state.pendingSpace || state.segments.length > 0,
          segments: state.segments
        }
        : {
          pendingSpace: false,
          segments: [
            ...state.segments,
            ...(state.pendingSpace && state.segments.length > 0 ? [spaceSegment(" ")] : []),
            ...textSegmentsFor(piece.segment)
          ]
        },
    {
      pendingSpace: false,
      segments: emptyTextSegments()
    }
  ).segments

const segmentPreWrapText = (text: string): ReadonlyArray<TextSegmentType> =>
  wordPiecesFor(normalizeLineBreaks(text)).reduce<ReadonlyArray<TextSegmentType>>((segments, piece) => {
    if (piece.segment === LINE_FEED) {
      return [...segments, hardBreakSegment()]
    }

    if (isOrdinaryWhitespace(piece.segment)) {
      return [...segments, spaceSegment(piece.segment)]
    }

    return [...segments, ...textSegmentsFor(piece.segment)]
  }, emptyTextSegments())

/**
 * Builds text, space, and hard-break segments from `Intl.Segmenter` word/grapheme
 * analysis when available, with a deterministic fallback for runtimes without it.
 *
 * @since 0.1.0
 * @category internals
 */
export const segmentText = (text: string, whiteSpace: WhiteSpaceModeType): ReadonlyArray<TextSegmentType> =>
  whiteSpace === "normal"
    ? segmentNormalText(text)
    : segmentPreWrapText(text)

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
