/**
 * Internal preparation helpers.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"
import * as Arr from "effect/Array"

import type { MeasurementFailed } from "../../Errors/index.js"
import type { PreparedSegmentType } from "../model.js"
import type { BaseTextDirectionType, EngineProfileType, TextSegmentType } from "../schema.js"
import {
  bidiLevelForDirection,
  detectTextDirection,
  resolveBaseDirection,
  SOFT_HYPHEN,
  splitSoftHyphenPieces,
  splitWhitespaceTokens
} from "./analysis.js"

type Measure = (text: string) => Effect.Effect<number, MeasurementFailed>
type PreparationContext = readonly [
  baseDirection: BaseTextDirectionType,
  engineProfile: EngineProfileType,
  hyphenWidth: number,
  measure: Measure,
  tabStopWidth: number
]

const makeTextSegment = (
  text: string,
  width: number,
  breakAfter: boolean,
  breakWidth: number,
  baseDirection: BaseTextDirectionType
): PreparedSegmentType => {
  const direction = detectTextDirection(text)

  return {
    kind: "text",
    text,
    width,
    direction,
    bidiLevel: bidiLevelForDirection(direction, baseDirection),
    breakOpportunity: breakAfter ? "soft-hyphen" : "none",
    breakText: breakAfter ? "-" : "",
    breakWidth: breakAfter ? breakWidth : 0
  }
}

const makeWhitespaceSegment = (
  kind: "space" | "tab",
  text: string,
  width: number,
  baseDirection: BaseTextDirectionType
): PreparedSegmentType => ({
  kind,
  text,
  width,
  direction: "neutral",
  bidiLevel: bidiLevelForDirection("neutral", baseDirection),
  breakOpportunity: "space",
  breakText: "",
  breakWidth: 0
})

const makeHardBreakSegment = (baseDirection: BaseTextDirectionType): PreparedSegmentType => ({
  kind: "hard-break",
  text: "\n",
  width: 0,
  direction: "neutral",
  bidiLevel: bidiLevelForDirection("neutral", baseDirection),
  breakOpportunity: "none",
  breakText: "",
  breakWidth: 0
})

const cumulativePieceTexts = (pieces: ReadonlyArray<readonly [string, boolean]>): ReadonlyArray<string> =>
  pieces.reduce<ReadonlyArray<string>>((texts, piece) => {
    const previous = texts[texts.length - 1] ?? ""
    return [...texts, previous + piece[0]]
  }, [])

const prepareTextSegment = (
  segment: TextSegmentType,
  context: PreparationContext
): Effect.Effect<ReadonlyArray<PreparedSegmentType>, MeasurementFailed> => {
  const pieces = splitSoftHyphenPieces(segment.text)
  if (pieces.length === 0) {
    return Effect.succeed([])
  }

  const measurementTexts = pieces.length > 1 && context[1].preferPrefixWidthsForBreakableRuns
    ? cumulativePieceTexts(pieces)
    : pieces.map((piece) => piece[0])

  return Effect.forEach(measurementTexts, context[3]).pipe(
    Effect.map((measuredWidths) =>
      pieces.map((piece, index) =>
        makeTextSegment(
          piece[0],
          pieces.length > 1 && context[1].preferPrefixWidthsForBreakableRuns
            ? (measuredWidths[index] ?? 0) - (measuredWidths[index - 1] ?? 0)
            : measuredWidths[index] ?? 0,
          piece[1],
          context[2],
          context[0]
        )
      )
    )
  )
}

const prepareWhitespaceSegment = (
  segment: TextSegmentType,
  context: PreparationContext
): Effect.Effect<ReadonlyArray<PreparedSegmentType>, MeasurementFailed> =>
  Effect.forEach(splitWhitespaceTokens(segment.text), (token) =>
    token[0] === "tab"
      ? Effect.succeed(makeWhitespaceSegment("tab", token[1], context[4], context[0]))
      : context[3](token[1]).pipe(
        Effect.map((width) => makeWhitespaceSegment("space", token[1], width, context[0]))
      ))

const prepareSegment = (
  segment: TextSegmentType,
  context: PreparationContext
): Effect.Effect<ReadonlyArray<PreparedSegmentType>, MeasurementFailed> =>
  segment.kind === "hard-break"
    ? Effect.succeed([makeHardBreakSegment(context[0])])
    : segment.kind === "space"
    ? prepareWhitespaceSegment(segment, context)
    : prepareTextSegment(segment, context)

export const resolvePreparedBaseDirection = (
  text: string,
  engineProfile: EngineProfileType
): BaseTextDirectionType => resolveBaseDirection(text, engineProfile.defaultDirection)

export const prepareSegments = (
  segments: ReadonlyArray<TextSegmentType>,
  engineProfile: EngineProfileType,
  baseDirection: BaseTextDirectionType,
  measure: Measure
): Effect.Effect<
  { readonly segments: ReadonlyArray<PreparedSegmentType>; readonly tabStopWidth: number },
  MeasurementFailed
> =>
  Effect.gen(function*() {
    const needsSoftHyphenWidth = segments.some(
      (segment) => segment.kind === "text" && segment.text.includes(SOFT_HYPHEN)
    )
    const needsTabStopWidth = segments.some((segment) => segment.kind === "space" && segment.text.includes("\t"))
    const hyphenWidth = needsSoftHyphenWidth ? yield* measure("-") : 0
    const tabStopWidth = needsTabStopWidth ? (yield* measure(" ")) * engineProfile.tabWidth : 0
    const prepared = yield* Effect.forEach(
      segments,
      (segment) => prepareSegment(segment, [baseDirection, engineProfile, hyphenWidth, measure, tabStopWidth])
    )

    return { segments: Arr.flatten(prepared), tabStopWidth }
  })
