/**
 * Internal preparation helpers.
 *
 * @since 0.1.0
 */
import { Effect, Match } from "effect"
import * as Arr from "effect/Array"

import type { MeasurementFailed } from "../../Errors/index.js"
import type {
  PreparedBreakKindType,
  PreparedLineChunkType,
  PreparedRuntimeTablesType,
  PreparedSegmentType,
  PreparedTextLogicalSurfaceType
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
  type TextDirection,
  WORD_JOINER,
  ZERO_WIDTH_SPACE
} from "./analysis.js"
import { containsUnsupportedBidiControls, mirrorText } from "./bidi.js"

type Measure = (text: string) => Effect.Effect<number, MeasurementFailed>

type PreparationContext = Readonly<{
  baseDirection: BaseTextDirectionType
  engineProfile: EngineProfileType
  hyphenWidth: number
  measure: Measure
  tabStopAdvance: number
}>

type GraphemeMeasurement = Readonly<{
  graphemeAdvances: ReadonlyArray<number>
  graphemes: ReadonlyArray<string>
  width: number
}>

type PreparedBidiGraphemeData = Readonly<{
  graphemeBidiLevels: ReadonlyArray<number>
  mirroredGraphemes: ReadonlyArray<string>
}>

const isZeroWidthControlText = (text: string): boolean => text === ZERO_WIDTH_SPACE || text === WORD_JOINER
const preparedBreakKind = (value: PreparedBreakKindType): PreparedBreakKindType => value

const lastOrElse = <A>(values: ReadonlyArray<A>, fallback: A): A =>
  values.length === 0 ? fallback : values[values.length - 1] ?? fallback

const widthFromPrefixMeasurements = (measuredWidths: ReadonlyArray<number>, index: number): number =>
  (measuredWidths[index] ?? 0) - (measuredWidths[index - 1] ?? 0)

const resolvedTextDirection = (
  direction: TextDirection,
  fallback: BaseTextDirectionType
): BaseTextDirectionType => direction === "neutral" ? fallback : direction

const preparedTextBreakKindFor = (segment: PreparedSegmentType): PreparedBreakKindType =>
  Match.value(segment.text).pipe(
    Match.when(ZERO_WIDTH_SPACE, () => preparedBreakKind("zero-width-break")),
    Match.when(WORD_JOINER, () => preparedBreakKind("glue")),
    Match.when(NO_BREAK_SPACE, () => preparedBreakKind("glue")),
    Match.orElse(() => preparedBreakKind(segment.breakOpportunity === "soft-hyphen" ? "soft-hyphen" : "text"))
  )

const compilePreparedBidiGraphemeData = (
  text: string,
  graphemes: ReadonlyArray<string>,
  segmentDirection: BaseTextDirectionType,
  baseDirection: BaseTextDirectionType
): PreparedBidiGraphemeData =>
  containsUnsupportedBidiControls(text)
    ? {
      graphemeBidiLevels: Arr.makeBy(graphemes.length, () => bidiLevelForDirection(segmentDirection, baseDirection)),
      mirroredGraphemes: graphemes
    }
    : {
      graphemeBidiLevels: Arr.map(
        graphemes,
        (grapheme) =>
          bidiLevelForDirection(resolvedTextDirection(detectTextDirection(grapheme), segmentDirection), baseDirection)
      ),
      mirroredGraphemes: Arr.map(graphemes, mirrorText)
    }

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
  const segmentDirection = resolvedTextDirection(direction, baseDirection)
  const bidiData = compilePreparedBidiGraphemeData(text, graphemes, segmentDirection, baseDirection)

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
    graphemeAdvances,
    graphemeBidiLevels: bidiData.graphemeBidiLevels,
    mirroredGraphemes: bidiData.mirroredGraphemes
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
  graphemeAdvances: [],
  graphemeBidiLevels: [],
  mirroredGraphemes: []
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
  graphemeAdvances: [],
  graphemeBidiLevels: [],
  mirroredGraphemes: []
})

const cumulativeTexts = (parts: ReadonlyArray<string>): ReadonlyArray<string> =>
  Arr.reduce(parts, Arr.empty<string>(), (texts, part) => Arr.append(texts, lastOrElse(texts, "") + part))

const cumulativePieceTexts = (pieces: ReadonlyArray<readonly [string, boolean]>): ReadonlyArray<string> =>
  cumulativeTexts(Arr.map(pieces, (piece) => piece[0]))

const measureGraphemeData = (
  text: string,
  measure: Measure,
  preferPrefixWidthsForBreakableRuns: boolean
): Effect.Effect<GraphemeMeasurement, MeasurementFailed> => {
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
    Effect.map((measuredWidths) => ({
      graphemeAdvances: preferPrefixWidthsForBreakableRuns
        ? Arr.map(measuredWidths, (_width, index) => widthFromPrefixMeasurements(measuredWidths, index))
        : measuredWidths,
      graphemes,
      width: lastOrElse(measuredWidths, 0)
    }))
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

  const measurementTexts = pieces.length > 1 && context.engineProfile.preferPrefixWidthsForBreakableRuns
    ? cumulativePieceTexts(pieces)
    : Arr.map(pieces, (piece) => piece[0])

  return Effect.forEach(measurementTexts, context.measure).pipe(
    Effect.flatMap((measuredWidths) =>
      Effect.forEach(
        pieces,
        (piece, index) =>
          measureGraphemeData(piece[0], context.measure, context.engineProfile.preferPrefixWidthsForBreakableRuns).pipe(
            Effect.map((graphemeData) =>
              makeTextSegment(
                piece[0],
                isZeroWidthControlText(piece[0])
                  ? 0
                  : pieces.length > 1 && context.engineProfile.preferPrefixWidthsForBreakableRuns
                  ? widthFromPrefixMeasurements(measuredWidths, index)
                  : graphemeData.width,
                graphemeData.graphemes,
                graphemeData.graphemeAdvances,
                piece[1],
                context.hyphenWidth,
                context.baseDirection
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
      Match.when("tab", () =>
        Effect.succeed(makeWhitespaceSegment("tab", token[1], context.tabStopAdvance, context.baseDirection))),
      Match.orElse(() =>
        context.measure(token[1]).pipe(
          Effect.map((width) =>
            makeWhitespaceSegment("space", token[1], width, context.baseDirection)
          )
        )
      )
    ))

const prepareSegment = (
  segment: TextSegmentType,
  context: PreparationContext
): Effect.Effect<ReadonlyArray<PreparedSegmentType>, MeasurementFailed> =>
  Match.value(segment.kind).pipe(
    Match.when("hard-break", () => Effect.succeed(Arr.make(makeHardBreakSegment(context.baseDirection)))),
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

const graphemeBidiLevelsFor = (segment: PreparedSegmentType): ReadonlyArray<number> =>
  segment.kind === "text" ? segment.graphemeBidiLevels : []

const mirroredGraphemesFor = (segment: PreparedSegmentType): ReadonlyArray<string> =>
  segment.kind === "text" ? segment.mirroredGraphemes : []

const prefixWidthsFor = (widths: ReadonlyArray<number>): ReadonlyArray<number> =>
  Arr.reduce(widths, Arr.empty<number>(), (prefixes, width) => Arr.append(prefixes, lastOrElse(prefixes, 0) + width))

const lineChunksFor = (segments: ReadonlyArray<PreparedSegmentType>): ReadonlyArray<PreparedLineChunkType> => {
  const indices = Arr.makeBy(segments.length, (index) => index)
  const reduced = Arr.reduce(
    indices,
    {
      chunks: Arr.empty<PreparedLineChunkType>(),
      startSegmentIndex: 0
    },
    (state, index) => {
      const segment = segments[index]

      return segment?.kind === "hard-break"
        ? {
          chunks: Arr.append(state.chunks, {
            startSegmentIndex: state.startSegmentIndex,
            endSegmentIndex: index,
            consumedEndSegmentIndex: index + 1
          }),
          startSegmentIndex: index + 1
        }
        : state
    }
  )

  return Arr.append(reduced.chunks, {
    startSegmentIndex: reduced.startSegmentIndex,
    endSegmentIndex: segments.length,
    consumedEndSegmentIndex: segments.length
  })
}

const compileKernelRuntime = (
  segments: ReadonlyArray<PreparedSegmentType>,
  hyphenWidth: number,
  tabStopAdvance: number,
  whiteSpace: WhiteSpaceModeType
): PreparedRuntimeTablesType => {
  const chunks = lineChunksFor(segments)
  const breakableGraphemeWidths = Arr.map(segments, breakableGraphemeWidthsFor)

  return {
    breakKinds: Arr.map(segments, (segment) => preparedBreakKindFor(segment, whiteSpace)),
    fitAdvances: Arr.map(segments, (segment) => segment.width),
    paintAdvances: Arr.map(segments, (segment) => segment.width),
    chunkStartIndices: Arr.map(chunks, (chunk) => chunk.startSegmentIndex),
    chunkConsumedEndIndices: Arr.map(chunks, (chunk) => chunk.consumedEndSegmentIndex),
    breakableGraphemeWidths,
    breakablePrefixWidths: Arr.map(breakableGraphemeWidths, prefixWidthsFor),
    graphemeBidiLevels: Arr.map(segments, graphemeBidiLevelsFor),
    mirroredGraphemes: Arr.map(segments, mirroredGraphemesFor),
    discretionaryHyphenWidth: hyphenWidth,
    tabStopAdvance
  }
}

const retainLogicalSurface = (segments: ReadonlyArray<PreparedSegmentType>): PreparedTextLogicalSurfaceType => ({
  segments
})

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
    readonly kernelRuntime: PreparedRuntimeTablesType
    readonly logicalSurface: PreparedTextLogicalSurfaceType
  },
  MeasurementFailed
> =>
  Effect.gen(function*() {
    const needsSoftHyphenWidth = Arr.some(
      segments,
      (segment) => segment.kind === "text" && segment.text.includes(SOFT_HYPHEN)
    )
    const needsTabStopAdvance = Arr.some(segments, (segment) => segment.kind === "space" && segment.text.includes("\t"))
    const hyphenWidth = needsSoftHyphenWidth ? yield* measure("-") : 0
    const tabStopAdvance = needsTabStopAdvance ? (yield* measure(" ")) * engineProfile.tabWidth : 0
    const context: PreparationContext = {
      baseDirection,
      engineProfile,
      hyphenWidth,
      measure,
      tabStopAdvance
    }
    const prepared = yield* Effect.forEach(segments, (segment) => prepareSegment(segment, context))
    const flattenedSegments = Arr.flatten(prepared)

    return {
      kernelRuntime: compileKernelRuntime(flattenedSegments, hyphenWidth, tabStopAdvance, whiteSpace),
      logicalSurface: retainLogicalSurface(flattenedSegments)
    }
  })
