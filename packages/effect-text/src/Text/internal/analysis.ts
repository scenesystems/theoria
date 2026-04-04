/**
 * Internal segmentation helpers.
 *
 * @since 0.1.0
 */
import { Match, Option } from "effect"
import * as Arr from "effect/Array"

import type { BaseTextDirectionType, TextSegmentType, WhiteSpaceModeType } from "../schema.js"

/**
 * Author-provided discretionary hyphen marker preserved through preparation.
 *
 * @since 0.1.0
 * @category internals
 */
export const SOFT_HYPHEN = "\u00ad"

/**
 * Non-breaking space character treated as glue by the segment classifier.
 *
 * @since 0.1.0
 * @category internals
 */
export const NO_BREAK_SPACE = "\u00a0"

/**
 * Word-joiner control character that suppresses breaks inside a run.
 *
 * @since 0.1.0
 * @category internals
 */
export const WORD_JOINER = "\u2060"

/**
 * Zero-width break marker preserved as an explicit break opportunity.
 *
 * @since 0.1.0
 * @category internals
 */
export const ZERO_WIDTH_SPACE = "\u200b"

const TAB = "\t"
const LINE_FEED = "\n"
const RTL_PATTERN = /[\u0590-\u08ff\uFB1D-\uFDFD\uFE70-\uFEFC]/u
const STRONG_PATTERN = /\p{Letter}|\p{Number}/u
const LETTER_PATTERN = /\p{Letter}/u
const NUMBER_PATTERN = /\p{Number}/u
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u
const COMBINING_MARK_PATTERN = /\p{Mark}/u
const VARIATION_SELECTOR_PATTERN = /[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/u
const EMOJI_MODIFIER_PATTERN = /\p{Emoji_Modifier}/u
const REGIONAL_INDICATOR_PATTERN = /\p{Regional_Indicator}/u
const CJK_SCRIPT_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
const NO_SPACE_SCRIPT_PATTERN = /[\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u
const OPENING_PUNCTUATION_PATTERN =
  /^[([{\u2018\u201C\u00AB\u2039\u3008\u300A\u300C\u300E\u3010\u3014\uFF08\uFF3B\uFF5B]+$/u
const CLOSING_PUNCTUATION_PATTERN =
  /^[)\]}\u2019\u201D\u00BB\u203A\u3001\u3002\u3009\u300B\u300D\u300F\u3011\u3015\uFF09\uFF3D\uFF5D\uFF0C\uFF0E!?;,.:]+$/u
const RUN_CONNECTOR_PATTERN = /^[-._~,/:@?&=#%+]+$/u

/**
 * Internal logical direction classification used by preparation and bidi projection.
 *
 * @since 0.1.0
 * @category internals
 */
export type TextDirection = "ltr" | "rtl" | "neutral"

type WhitespaceToken = readonly [kind: "space" | "tab", text: string]
type SoftHyphenPiece = readonly [text: string, breakAfter: boolean]
type TextBreakClass =
  | "alphabetic"
  | "cjk"
  | "closing-punctuation"
  | "connector"
  | "glue"
  | "no-space-script"
  | "numeric"
  | "opening-punctuation"
  | "other"
  | "soft-hyphen"
  | "zero-width-break"
type AtomicToken =
  | {
    readonly breakClass: TextBreakClass
    readonly kind: "text"
    readonly text: string
  }
  | {
    readonly kind: "hard-break" | "space" | "tab"
    readonly text: string
  }
type TextAtomicToken = Extract<AtomicToken, { readonly kind: "text" }>

const textSegment = (text: string): TextSegmentType => ({ kind: "text", text })
const spaceSegment = (text: string): TextSegmentType => ({ kind: "space", text })
const hardBreakSegment = (): TextSegmentType => ({ kind: "hard-break", text: LINE_FEED })
const emptyTextSegments = (): ReadonlyArray<TextSegmentType> => []

const getSegmenter = (granularity: "grapheme") => {
  const Segmenter = globalThis.Intl?.Segmenter
  return Segmenter ? new Segmenter(undefined, { granularity }) : undefined
}

const normalizeLineBreaks = (text: string): string => text.replace(/\r\n?/gu, LINE_FEED)

const isOrdinaryWhitespaceCharacter = (char: string): boolean =>
  char === " " || char === TAB || char === LINE_FEED || char === "\u000b" || char === "\u000c"

const isOrdinaryWhitespace = (text: string): boolean =>
  text.length > 0 && Arr.every(Arr.fromIterable(text), isOrdinaryWhitespaceCharacter)

const isClosingPunctuation = (text: string): boolean => CLOSING_PUNCTUATION_PATTERN.test(text)

const isOpeningPunctuation = (text: string): boolean => OPENING_PUNCTUATION_PATTERN.test(text)

const isRunConnector = (text: string): boolean => RUN_CONNECTOR_PATTERN.test(text)

const breakClass = (value: TextBreakClass): TextBreakClass => value
const hardBreakToken = (text: string): AtomicToken => ({ kind: "hard-break", text })
const spaceToken = (text: string): AtomicToken => ({ kind: "space", text })
const tabToken = (text: string): AtomicToken => ({ kind: "tab", text })
const textAtomicToken = (text: string): AtomicToken => ({ breakClass: classifyTextCluster(text), kind: "text", text })

const classifyTextCluster = (text: string): TextBreakClass =>
  Match.value(text).pipe(
    Match.when(SOFT_HYPHEN, () => breakClass("soft-hyphen")),
    Match.when(NO_BREAK_SPACE, () => breakClass("glue")),
    Match.when(WORD_JOINER, () => breakClass("glue")),
    Match.when(ZERO_WIDTH_SPACE, () => breakClass("zero-width-break")),
    Match.orElse((value) =>
      isRunConnector(value)
        ? "connector"
        : isOpeningPunctuation(value)
        ? "opening-punctuation"
        : isClosingPunctuation(value)
        ? "closing-punctuation"
        : CJK_SCRIPT_PATTERN.test(value)
        ? "cjk"
        : NO_SPACE_SCRIPT_PATTERN.test(value)
        ? "no-space-script"
        : NUMBER_PATTERN.test(value)
        ? "numeric"
        : LETTER_PATTERN.test(value)
        ? "alphabetic"
        : "other"
    )
  )

const atomicTokenFor = (cluster: string): AtomicToken =>
  Match.value(cluster).pipe(
    Match.when(LINE_FEED, hardBreakToken),
    Match.when(TAB, tabToken),
    Match.orElse((text) =>
      isOrdinaryWhitespace(text)
        ? spaceToken(text)
        : textAtomicToken(text)
    )
  )

const tokenizeText = (text: string): ReadonlyArray<AtomicToken> =>
  Arr.map(graphemeClusters(normalizeLineBreaks(text)), atomicTokenFor)

const isRunEndpoint = (token: TextAtomicToken): boolean =>
  token.breakClass === "alphabetic" || token.breakClass === "cjk" || token.breakClass === "numeric"

const continuesConnectorRun = (token: TextAtomicToken): boolean =>
  token.breakClass === "closing-punctuation" ||
  token.breakClass === "connector" ||
  isRunEndpoint(token)

const shouldMergeTextAtoms = (
  previous: TextAtomicToken,
  current: TextAtomicToken,
  next: Option.Option<TextAtomicToken>
): boolean => {
  if (previous.breakClass === "glue" || previous.breakClass === "zero-width-break") {
    return false
  }

  if (current.breakClass === "glue" || current.breakClass === "zero-width-break") {
    return false
  }

  if (previous.breakClass === "opening-punctuation") {
    return true
  }

  if (current.breakClass === "closing-punctuation") {
    return true
  }

  if (previous.breakClass === "soft-hyphen" || current.breakClass === "soft-hyphen") {
    return true
  }

  if (previous.breakClass === "cjk" && current.breakClass === "cjk") {
    return true
  }

  if (previous.breakClass === "no-space-script" || current.breakClass === "no-space-script") {
    return false
  }

  if (previous.breakClass === "connector") {
    return continuesConnectorRun(current)
  }

  if (current.breakClass === "connector") {
    return isRunEndpoint(previous) ||
      previous.breakClass === "closing-punctuation" ||
      Option.exists(next, continuesConnectorRun)
  }

  return isRunEndpoint(previous) && isRunEndpoint(current)
}

const textSegmentsFromAtoms = (atoms: ReadonlyArray<TextAtomicToken>): ReadonlyArray<TextSegmentType> => {
  const reduced = atoms.reduce<{
    readonly current: string
    readonly previous: Option.Option<TextAtomicToken>
    readonly segments: ReadonlyArray<TextSegmentType>
  }>(
    (state, atom, index) =>
      Option.match(state.previous, {
        onNone: () => ({
          current: atom.text,
          previous: Option.some(atom),
          segments: state.segments
        }),
        onSome: (previous) =>
          shouldMergeTextAtoms(previous, atom, Option.fromNullable(atoms[index + 1]))
            ? {
              current: state.current + atom.text,
              previous: Option.some(atom),
              segments: state.segments
            }
            : {
              current: atom.text,
              previous: Option.some(atom),
              segments: state.current.length === 0 ? state.segments : [...state.segments, textSegment(state.current)]
            }
      }),
    {
      current: "",
      previous: Option.none<TextAtomicToken>(),
      segments: emptyTextSegments()
    }
  )

  return reduced.current.length === 0 ? reduced.segments : [...reduced.segments, textSegment(reduced.current)]
}

const spaceSegmentsFromText = (text: string): ReadonlyArray<TextSegmentType> =>
  Arr.map(splitWhitespaceTokens(text), (token) => spaceSegment(token[1]))

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

/**
 * Splits text into grapheme clusters using `Intl.Segmenter` when present and a deterministic fallback otherwise.
 *
 * @since 0.1.0
 * @category internals
 */
export const graphemeClusters = (text: string): ReadonlyArray<string> => {
  const segmenter = getSegmenter("grapheme")

  return segmenter
    ? Arr.map(Arr.fromIterable(segmenter.segment(text)), (part) => part.segment)
    : fallbackGraphemeClusters(text)
}

const segmentNormalText = (text: string): ReadonlyArray<TextSegmentType> =>
  ((state: {
    readonly pendingSpace: boolean
    readonly segments: ReadonlyArray<TextSegmentType>
    readonly textRun: ReadonlyArray<TextAtomicToken>
  }) => [...state.segments, ...textSegmentsFromAtoms(state.textRun)])(
    tokenizeText(text).reduce<{
      readonly pendingSpace: boolean
      readonly segments: ReadonlyArray<TextSegmentType>
      readonly textRun: ReadonlyArray<TextAtomicToken>
    }>(
      (state, token) =>
        token.kind === "text"
          ? {
            pendingSpace: false,
            segments: state.pendingSpace && state.segments.length > 0 && state.textRun.length === 0
              ? [...state.segments, spaceSegment(" ")]
              : state.segments,
            textRun: [...state.textRun, token]
          }
          : {
            pendingSpace: state.pendingSpace || state.textRun.length > 0 || state.segments.length > 0,
            segments: [
              ...state.segments,
              ...textSegmentsFromAtoms(state.textRun)
            ],
            textRun: []
          },
      {
        pendingSpace: false,
        segments: emptyTextSegments(),
        textRun: []
      }
    )
  )

const segmentPreWrapText = (text: string): ReadonlyArray<TextSegmentType> =>
  ((state: {
    readonly segments: ReadonlyArray<TextSegmentType>
    readonly textRun: ReadonlyArray<TextAtomicToken>
    readonly whitespace: string
  }) => [
    ...state.segments,
    ...textSegmentsFromAtoms(state.textRun),
    ...spaceSegmentsFromText(state.whitespace)
  ])(
    tokenizeText(text).reduce<{
      readonly segments: ReadonlyArray<TextSegmentType>
      readonly textRun: ReadonlyArray<TextAtomicToken>
      readonly whitespace: string
    }>(
      (state, token) =>
        token.kind === "text"
          ? {
            segments: state.whitespace.length === 0
              ? state.segments
              : [
                ...state.segments,
                ...textSegmentsFromAtoms(state.textRun),
                ...spaceSegmentsFromText(state.whitespace)
              ],
            textRun: state.whitespace.length === 0 ? [...state.textRun, token] : [token],
            whitespace: ""
          }
          : token.kind === "hard-break"
          ? {
            segments: [
              ...state.segments,
              ...textSegmentsFromAtoms(state.textRun),
              ...spaceSegmentsFromText(state.whitespace),
              hardBreakSegment()
            ],
            textRun: [],
            whitespace: ""
          }
          : {
            segments: [...state.segments, ...textSegmentsFromAtoms(state.textRun)],
            textRun: [],
            whitespace: state.whitespace + token.text
          },
      {
        segments: emptyTextSegments(),
        textRun: [],
        whitespace: ""
      }
    )
  )

/**
 * Builds text, space, and hard-break segments from canonical grapheme and
 * break-class analysis, using `Intl.Segmenter` grapheme boundaries when available
 * and a deterministic fallback otherwise.
 *
 * @since 0.1.0
 * @category internals
 */
export const segmentText = (text: string, whiteSpace: WhiteSpaceModeType): ReadonlyArray<TextSegmentType> =>
  whiteSpace === "normal"
    ? segmentNormalText(text)
    : segmentPreWrapText(text)

/**
 * Detects the first strong text direction present in a string.
 *
 * @since 0.1.0
 * @category internals
 */
export const detectTextDirection = (text: string): TextDirection => {
  const strongCharacter = Arr.fromIterable(text).find((char) => RTL_PATTERN.test(char) || STRONG_PATTERN.test(char))

  return Option.fromNullable(strongCharacter).pipe(
    Option.match({
      onNone: () => "neutral",
      onSome: (char) => (RTL_PATTERN.test(char) ? "rtl" : "ltr")
    })
  )
}

/**
 * Resolves the base direction for preparation, falling back when input is neutral.
 *
 * @since 0.1.0
 * @category internals
 */
export const resolveBaseDirection = (text: string, fallback: BaseTextDirectionType): BaseTextDirectionType => {
  const direction = detectTextDirection(text)
  return direction === "neutral" ? fallback : direction
}

/**
 * Maps logical text direction into the line-level bidi level used by the visual projector.
 *
 * @since 0.1.0
 * @category internals
 */
export const bidiLevelForDirection = (direction: TextDirection, baseDirection: BaseTextDirectionType): number =>
  direction === "neutral"
    ? baseDirection === "rtl"
      ? 1
      : 0
    : direction === baseDirection
    ? baseDirection === "rtl"
      ? 1
      : 0
    : baseDirection === "rtl"
    ? 2
    : 1

/**
 * Splits whitespace into grouped spaces and single tab tokens for later measurement.
 *
 * @since 0.1.0
 * @category internals
 */
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

/**
 * Splits author-provided soft hyphens into pieces while preserving discretionary break ownership.
 *
 * @since 0.1.0
 * @category internals
 */
export const splitSoftHyphenPieces = (text: string): ReadonlyArray<SoftHyphenPiece> =>
  text.split(SOFT_HYPHEN).reduce<ReadonlyArray<SoftHyphenPiece>>((pieces, part, index, parts) => {
    if (part.length === 0) {
      return pieces
    }

    return [...pieces, [part, index < parts.length - 1]]
  }, [])

/**
 * Detects whether a string contains extended pictographic graphemes.
 *
 * @since 0.1.0
 * @category internals
 */
export const containsEmoji = (text: string): boolean => EMOJI_PATTERN.test(text)

/**
 * Removes emoji grapheme clusters while counting how many clusters were stripped.
 *
 * @since 0.1.0
 * @category internals
 */
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
