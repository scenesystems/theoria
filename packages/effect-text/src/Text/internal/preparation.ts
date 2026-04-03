/**
 * Internal preparation helpers.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"
import * as Arr from "effect/Array"

import type { MeasurementFailed } from "../../Errors/index.js"
import type {
  PreparedBreakKindType,
  PreparedLineChunkType,
  PreparedRuntimeTablesType,
  PreparedSegmentType,
  PreparedTextManualSurfaceType
} from "../model.js"
import type { BaseTextDirectionType, EngineProfileType, TextSegmentType, WhiteSpaceModeType } from "../schema.js"
import {
  bidiLevelForDirection,
  detectTextDirection,
  graphemeClusters,
  NO_BREAK_SPACE,
  resolveBaseDirection,
  SOFT_HYPHEN,
  splitSoftHyphenPieces,
  splitWhitespaceTokens,
  WORD_JOINER,
  ZERO_WIDTH_SPACE
} from "./analysis.js"

// Decomposition note: WP1 is mid-kernel migration, so preparation and runtime-table compilation stay together here.
// Split plan: move chunk/runtime-table compilation into a dedicated internal module when the canonical walker replaces legacy materialization.

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
  graphemes: ReadonlyArray<string>,
  graphemeAdvances: ReadonlyArray<number>,
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
    breakWidth: breakAfter ? breakWidth : 0,
    graphemes,
    graphemeAdvances
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
  breakWidth: 0,
  graphemes: [],
  graphemeAdvances: []
})

const makeHardBreakSegment = (baseDirection: BaseTextDirectionType): PreparedSegmentType => ({
  kind: "hard-break",
  text: "\n",
  width: 0,
  direction: "neutral",
  bidiLevel: bidiLevelForDirection("neutral", baseDirection),
  breakOpportunity: "none",
  breakText: "",
  breakWidth: 0,
  graphemes: [],
  graphemeAdvances: []
})

const cumulativePieceTexts = (pieces: ReadonlyArray<readonly [string, boolean]>): ReadonlyArray<string> =>
  pieces.reduce<ReadonlyArray<string>>((texts, piece) => {
    const previous = texts[texts.length - 1] ?? ""
    return [...texts, previous + piece[0]]
  }, [])

const cumulativeTexts = (parts: ReadonlyArray<string>): ReadonlyArray<string> =>
  parts.reduce<ReadonlyArray<string>>((texts, part) => {
    const previous = texts[texts.length - 1] ?? ""
    return [...texts, previous + part]
  }, [])

const measureGraphemeData = (
  text: string,
  measure: Measure,
  preferPrefixWidthsForBreakableRuns: boolean
): Effect.Effect<
  {
    readonly graphemeAdvances: ReadonlyArray<number>
    readonly graphemes: ReadonlyArray<string>
    readonly width: number
  },
  MeasurementFailed
> => {
  if (text === ZERO_WIDTH_SPACE || text === WORD_JOINER) {
    return Effect.succeed({
      graphemeAdvances: [0],
      graphemes: [text],
      width: 0
    })
  }

  const graphemes = graphemeClusters(text)

  if (graphemes.length === 0) {
    return Effect.succeed({
      graphemeAdvances: [],
      graphemes,
      width: 0
    })
  }

  const measurementTexts = preferPrefixWidthsForBreakableRuns ? cumulativeTexts(graphemes) : graphemes

  return Effect.forEach(measurementTexts, measure).pipe(
    Effect.map((measuredWidths) => {
      const graphemeAdvances = preferPrefixWidthsForBreakableRuns
        ? measuredWidths.map((width, index) => width - (measuredWidths[index - 1] ?? 0))
        : measuredWidths

      return {
        graphemeAdvances,
        graphemes,
        width: measuredWidths[measuredWidths.length - 1] ?? 0
      }
    })
  )
}

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
    Effect.flatMap((measuredWidths) =>
      Effect.forEach(
        pieces,
        (piece, index) =>
          measureGraphemeData(piece[0], context[3], context[1].preferPrefixWidthsForBreakableRuns).pipe(
            Effect.map((graphemeData) =>
              makeTextSegment(
                piece[0],
                piece[0] === ZERO_WIDTH_SPACE || piece[0] === WORD_JOINER
                  ? 0
                  : pieces.length > 1 && context[1].preferPrefixWidthsForBreakableRuns
                  ? (measuredWidths[index] ?? 0) - (measuredWidths[index - 1] ?? 0)
                  : graphemeData.width,
                graphemeData.graphemes,
                graphemeData.graphemeAdvances,
                piece[1],
                context[2],
                context[0]
              )
            )
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

const preparedBreakKindFor = (
  segment: PreparedSegmentType,
  whiteSpace: WhiteSpaceModeType
): PreparedBreakKindType =>
  segment.kind === "hard-break"
    ? "hard-break"
    : segment.kind === "tab"
    ? "tab"
    : segment.kind === "space"
    ? whiteSpace === "pre-wrap"
      ? "preserved-space"
      : "space"
    : segment.text === ZERO_WIDTH_SPACE
    ? "zero-width-break"
    : segment.text === WORD_JOINER || segment.text === NO_BREAK_SPACE
    ? "glue"
    : segment.breakOpportunity === "soft-hyphen"
    ? "soft-hyphen"
    : "text"

const breakableGraphemeWidthsFor = (segment: PreparedSegmentType): ReadonlyArray<number> =>
  segment.kind === "text" ? segment.graphemeAdvances : []

const emptyChunks: ReadonlyArray<PreparedLineChunkType> = []

const prefixWidthsFor = (widths: ReadonlyArray<number>): ReadonlyArray<number> =>
  widths.reduce<ReadonlyArray<number>>((prefixes, width) => {
    const previous = prefixes[prefixes.length - 1] ?? 0
    return [...prefixes, previous + width]
  }, [])

const lineChunksFor = (segments: ReadonlyArray<PreparedSegmentType>): ReadonlyArray<PreparedLineChunkType> => {
  const reduced = segments.reduce(
    (state, segment, index) =>
      segment.kind === "hard-break"
        ? {
          chunks: [
            ...state.chunks,
            {
              startSegmentIndex: state.startSegmentIndex,
              endSegmentIndex: index,
              consumedEndSegmentIndex: index + 1
            }
          ],
          startSegmentIndex: index + 1
        }
        : state,
    {
      chunks: emptyChunks,
      startSegmentIndex: 0
    }
  )

  return [
    ...reduced.chunks,
    {
      startSegmentIndex: reduced.startSegmentIndex,
      endSegmentIndex: segments.length,
      consumedEndSegmentIndex: segments.length
    }
  ]
}

const compileRuntimeTables = (
  segments: ReadonlyArray<PreparedSegmentType>,
  chunks: ReadonlyArray<PreparedLineChunkType>,
  hyphenWidth: number,
  tabStopWidth: number,
  whiteSpace: WhiteSpaceModeType
): PreparedRuntimeTablesType => {
  const breakableGraphemeWidths = segments.map(breakableGraphemeWidthsFor)

  return {
    breakKinds: segments.map((segment) => preparedBreakKindFor(segment, whiteSpace)),
    fitAdvances: segments.map((segment) => segment.width),
    paintAdvances: segments.map((segment) => segment.width),
    chunkStartIndices: chunks.map((chunk) => chunk.startSegmentIndex),
    chunkConsumedEndIndices: chunks.map((chunk) => chunk.consumedEndSegmentIndex),
    breakableGraphemeWidths,
    breakablePrefixWidths: breakableGraphemeWidths.map(prefixWidthsFor),
    discretionaryHyphenWidth: hyphenWidth,
    tabStopAdvance: tabStopWidth
  }
}

export const resolvePreparedBaseDirection = (
  text: string,
  engineProfile: EngineProfileType
): BaseTextDirectionType => resolveBaseDirection(text, engineProfile.defaultDirection)

export const prepareSegments = (
  segments: ReadonlyArray<TextSegmentType>,
  whiteSpace: WhiteSpaceModeType,
  engineProfile: EngineProfileType,
  baseDirection: BaseTextDirectionType,
  measure: Measure
): Effect.Effect<
  {
    readonly tabStopWidth: number
    readonly runtime: PreparedRuntimeTablesType
    readonly manualSurface: PreparedTextManualSurfaceType
  },
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
    const flattenedSegments = Arr.flatten(prepared)
    const chunks = lineChunksFor(flattenedSegments)

    return {
      tabStopWidth,
      runtime: compileRuntimeTables(flattenedSegments, chunks, hyphenWidth, tabStopWidth, whiteSpace),
      manualSurface: {
        segments: flattenedSegments,
        chunks
      }
    }
  })
