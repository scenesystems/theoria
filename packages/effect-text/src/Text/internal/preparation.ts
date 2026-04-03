/**
 * Internal preparation helpers.
 *
 * @since 0.1.0
 */
import { Effect, Match, Option } from "effect"
import * as Arr from "effect/Array"
import * as Data from "effect/Data"

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

const isZeroWidthControlText = (text: string): boolean => text === ZERO_WIDTH_SPACE || text === WORD_JOINER
const preparedBreakKind = (value: PreparedBreakKindType): PreparedBreakKindType => value

const lastOrElse = <A>(values: ReadonlyArray<A>, fallback: A): A =>
  Arr.last(values).pipe(Option.getOrElse(() => fallback))

const widthFromPrefixMeasurements = (measuredWidths: ReadonlyArray<number>, index: number): number =>
  (measuredWidths[index] ?? 0) - (measuredWidths[index - 1] ?? 0)

const preparedTextBreakKindFor = (segment: PreparedSegmentType): PreparedBreakKindType =>
  Match.value(segment.text).pipe(
    Match.when(ZERO_WIDTH_SPACE, () => preparedBreakKind("zero-width-break")),
    Match.when(WORD_JOINER, () => preparedBreakKind("glue")),
    Match.when(NO_BREAK_SPACE, () => preparedBreakKind("glue")),
    Match.orElse(() => preparedBreakKind(segment.breakOpportunity === "soft-hyphen" ? "soft-hyphen" : "text"))
  )

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
  Arr.reduce(pieces, Arr.empty<string>(), (texts, piece) => Arr.append(texts, lastOrElse(texts, "") + piece[0]))

const cumulativeTexts = (parts: ReadonlyArray<string>): ReadonlyArray<string> =>
  Arr.reduce(parts, Arr.empty<string>(), (texts, part) => Arr.append(texts, lastOrElse(texts, "") + part))

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
  if (isZeroWidthControlText(text)) {
    return Effect.succeed({
      graphemeAdvances: Arr.make(0),
      graphemes: Arr.make(text),
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
        ? Arr.map(measuredWidths, (_width, index) => widthFromPrefixMeasurements(measuredWidths, index))
        : measuredWidths

      return {
        graphemeAdvances,
        graphemes,
        width: lastOrElse(measuredWidths, 0)
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
    : Arr.map(pieces, (piece) => piece[0])

  return Effect.forEach(measurementTexts, context[3]).pipe(
    Effect.flatMap((measuredWidths) =>
      Effect.forEach(
        pieces,
        (piece, index) =>
          measureGraphemeData(piece[0], context[3], context[1].preferPrefixWidthsForBreakableRuns).pipe(
            Effect.map((graphemeData) =>
              makeTextSegment(
                piece[0],
                isZeroWidthControlText(piece[0])
                  ? 0
                  : pieces.length > 1 && context[1].preferPrefixWidthsForBreakableRuns
                  ? widthFromPrefixMeasurements(measuredWidths, index)
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
    Match.value(token[0]).pipe(
      Match.when("tab", () => Effect.succeed(makeWhitespaceSegment("tab", token[1], context[4], context[0]))),
      Match.orElse(() =>
        context[3](token[1]).pipe(
          Effect.map((width) => makeWhitespaceSegment("space", token[1], width, context[0]))
        )
      )
    ))

const prepareSegment = (
  segment: TextSegmentType,
  context: PreparationContext
): Effect.Effect<ReadonlyArray<PreparedSegmentType>, MeasurementFailed> =>
  Match.value(segment.kind).pipe(
    Match.when("hard-break", () => Effect.succeed(Arr.make(makeHardBreakSegment(context[0])))),
    Match.when("space", () => prepareWhitespaceSegment(segment, context)),
    Match.orElse(() => prepareTextSegment(segment, context))
  )

const preparedBreakKindFor = (
  segment: PreparedSegmentType,
  whiteSpace: WhiteSpaceModeType
): PreparedBreakKindType =>
  Match.value(segment.kind).pipe(
    Match.when("hard-break", () => preparedBreakKind("hard-break")),
    Match.when("tab", () => preparedBreakKind("tab")),
    Match.when("space", () => preparedBreakKind(whiteSpace === "pre-wrap" ? "preserved-space" : "space")),
    Match.orElse(() => preparedTextBreakKindFor(segment))
  )

const breakableGraphemeWidthsFor = (segment: PreparedSegmentType): ReadonlyArray<number> =>
  segment.kind === "text" ? segment.graphemeAdvances : []

const emptyChunks: ReadonlyArray<PreparedLineChunkType> = []

const prefixWidthsFor = (widths: ReadonlyArray<number>): ReadonlyArray<number> =>
  Arr.reduce(widths, Arr.empty<number>(), (prefixes, width) => Arr.append(prefixes, lastOrElse(prefixes, 0) + width))

const lineChunksFor = (segments: ReadonlyArray<PreparedSegmentType>): ReadonlyArray<PreparedLineChunkType> => {
  const reduced = Arr.reduce(
    Arr.map(segments, (segment, index) => Data.tuple(segment, index)),
    {
      chunks: emptyChunks,
      startSegmentIndex: 0
    },
    (state, [segment, index]) =>
      segment.kind === "hard-break"
        ? {
          chunks: Arr.append(state.chunks, {
            startSegmentIndex: state.startSegmentIndex,
            endSegmentIndex: index,
            consumedEndSegmentIndex: index + 1
          }),
          startSegmentIndex: index + 1
        }
        : state
  )

  return Arr.append(reduced.chunks, {
    startSegmentIndex: reduced.startSegmentIndex,
    endSegmentIndex: segments.length,
    consumedEndSegmentIndex: segments.length
  })
}

const compileRuntimeTables = (
  segments: ReadonlyArray<PreparedSegmentType>,
  chunks: ReadonlyArray<PreparedLineChunkType>,
  hyphenWidth: number,
  tabStopWidth: number,
  whiteSpace: WhiteSpaceModeType
): PreparedRuntimeTablesType => {
  const breakableGraphemeWidths = Arr.map(segments, breakableGraphemeWidthsFor)

  return {
    breakKinds: Arr.map(segments, (segment) => preparedBreakKindFor(segment, whiteSpace)),
    fitAdvances: Arr.map(segments, (segment) => segment.width),
    paintAdvances: Arr.map(segments, (segment) => segment.width),
    chunkStartIndices: Arr.map(chunks, (chunk) => chunk.startSegmentIndex),
    chunkConsumedEndIndices: Arr.map(chunks, (chunk) => chunk.consumedEndSegmentIndex),
    breakableGraphemeWidths,
    breakablePrefixWidths: Arr.map(breakableGraphemeWidths, prefixWidthsFor),
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
    const needsSoftHyphenWidth = Arr.some(
      segments,
      (segment) => segment.kind === "text" && segment.text.includes(SOFT_HYPHEN)
    )
    const needsTabStopWidth = Arr.some(segments, (segment) => segment.kind === "space" && segment.text.includes("\t"))
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
