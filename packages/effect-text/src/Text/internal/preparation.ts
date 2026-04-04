/**
 * Internal preparation helpers.
 *
 * @since 0.1.0
 */
import { Effect, Match, Option } from "effect"
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
import {
  type HyphenatedPiece,
  type HyphenationBreakOpportunity,
  splitDictionaryHyphenationPieces
} from "./hyphenation.js"

type Measure = (text: string) => Effect.Effect<number, MeasurementFailed>
type HyphenateWord = (word: string) => Effect.Effect<ReadonlyArray<number>>

type PreparationContext = Readonly<{
  baseDirection: BaseTextDirectionType
  dictionaryHyphenationActive: boolean
  engineProfile: EngineProfileType
  hyphenWidth: number
  hyphenateWord: HyphenateWord
  measure: Measure
  tabStopAdvance: number
}>

type GraphemeMeasurement = Readonly<{
  fitPrefixWidths: ReadonlyArray<number>
  fitWidth: number
  graphemeAdvances: ReadonlyArray<number>
  graphemes: ReadonlyArray<string>
  paintWidth: number
}>

type PreparedBidiGraphemeData = Readonly<{
  graphemeBidiLevels: ReadonlyArray<number>
  mirroredGraphemes: ReadonlyArray<string>
}>

type HyphenationRun = Readonly<{
  hyphenate: boolean
  text: string
}>

const isZeroWidthControlText = (text: string): boolean => text === ZERO_WIDTH_SPACE || text === WORD_JOINER
const preparedBreakKind = (value: PreparedBreakKindType): PreparedBreakKindType => value
const hyphenatableTextPattern = /^[\p{Letter}\p{Mark}\u200c\u200d]+$/u

const lastOrElse = <A>(values: ReadonlyArray<A>, fallback: A): A =>
  values.length === 0 ? fallback : values[values.length - 1] ?? fallback

const sumWidths = (widths: ReadonlyArray<number>): number => Arr.reduce(widths, 0, (total, width) => total + width)

const widthFromPrefixMeasurements = (measuredWidths: ReadonlyArray<number>, index: number): number =>
  (measuredWidths[index] ?? 0) - (measuredWidths[index - 1] ?? 0)

const prefixWidthsFor = (widths: ReadonlyArray<number>): ReadonlyArray<number> =>
  Arr.reduce(widths, Arr.empty<number>(), (prefixes, width) => Arr.append(prefixes, lastOrElse(prefixes, 0) + width))

const resolvedTextDirection = (
  direction: TextDirection,
  fallback: BaseTextDirectionType
): BaseTextDirectionType => direction === "neutral" ? fallback : direction

const preparedTextBreakKindFor = (segment: PreparedSegmentType): PreparedBreakKindType =>
  Match.value(segment.text).pipe(
    Match.when(ZERO_WIDTH_SPACE, () => preparedBreakKind("zero-width-break")),
    Match.when(WORD_JOINER, () => preparedBreakKind("glue")),
    Match.when(NO_BREAK_SPACE, () => preparedBreakKind("glue")),
    Match.orElse(() =>
      preparedBreakKind(
        segment.breakOpportunity === "soft-hyphen"
          ? "soft-hyphen"
          : segment.breakOpportunity === "dictionary-hyphen"
          ? "dictionary-hyphen"
          : "text"
      )
    )
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
  fitWidth: number,
  graphemes: ReadonlyArray<string>,
  graphemeAdvances: ReadonlyArray<number>,
  fitPrefixWidths: ReadonlyArray<number>,
  breakOpportunity: HyphenationBreakOpportunity,
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
    fitWidth,
    direction,
    bidiLevel: bidiLevelForDirection(direction, baseDirection),
    breakOpportunity,
    breakText: breakOpportunity === "none" ? "" : "-",
    breakWidth: breakOpportunity === "none" ? 0 : breakWidth,
    graphemes,
    graphemeAdvances,
    fitPrefixWidths,
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
  fitWidth: width,
  direction: "neutral",
  bidiLevel: bidiLevelForDirection("neutral", baseDirection),
  breakOpportunity: "space",
  breakText: "",
  breakWidth: 0,
  graphemes: [],
  graphemeAdvances: [],
  fitPrefixWidths: [],
  graphemeBidiLevels: [],
  mirroredGraphemes: []
})

const makeHardBreakSegment = (baseDirection: BaseTextDirectionType): PreparedSegmentType => ({
  kind: "hard-break",
  text: "\n",
  width: 0,
  fitWidth: 0,
  direction: "neutral",
  bidiLevel: bidiLevelForDirection("neutral", baseDirection),
  breakOpportunity: "none",
  breakText: "",
  breakWidth: 0,
  graphemes: [],
  graphemeAdvances: [],
  fitPrefixWidths: [],
  graphemeBidiLevels: [],
  mirroredGraphemes: []
})

const cumulativeTexts = (parts: ReadonlyArray<string>): ReadonlyArray<string> =>
  Arr.reduce(parts, Arr.empty<string>(), (texts, part) => Arr.append(texts, lastOrElse(texts, "") + part))

const hyphenationRuns = (text: string): ReadonlyArray<HyphenationRun> =>
  Arr.reduce(graphemeClusters(text), Arr.empty<HyphenationRun>(), (runs, grapheme) => {
    const hyphenate = hyphenatableTextPattern.test(grapheme)

    return Arr.last(runs).pipe(
      Option.match({
        onNone: () => Arr.of({ hyphenate, text: grapheme }),
        onSome: (previousRun) =>
          previousRun.hyphenate === hyphenate
            ? Arr.append(
              Arr.take(runs, Math.max(runs.length - 1, 0)),
              {
                hyphenate,
                text: `${previousRun.text}${grapheme}`
              }
            )
            : Arr.append(runs, { hyphenate, text: grapheme })
      })
    )
  })

const hyphenatedRunPieces = (
  run: HyphenationRun,
  hyphenateWord: HyphenateWord,
  finalBreakOpportunity: HyphenationBreakOpportunity
): Effect.Effect<ReadonlyArray<HyphenatedPiece>> =>
  run.hyphenate
    ? hyphenateWord(run.text).pipe(
      Effect.map((breakPoints) => splitDictionaryHyphenationPieces(run.text, breakPoints, finalBreakOpportunity))
    )
    : Effect.succeed(Arr.of({ breakOpportunity: finalBreakOpportunity, text: run.text }))

const hyphenatedTextPieces = (
  text: string,
  hyphenateWord: HyphenateWord,
  dictionaryHyphenationActive: boolean
): Effect.Effect<ReadonlyArray<HyphenatedPiece>> =>
  Effect.forEach(splitSoftHyphenPieces(text), (piece) => {
    const runs = dictionaryHyphenationActive ? hyphenationRuns(piece[0]) : Arr.of({ hyphenate: false, text: piece[0] })

    return Effect.forEach(runs, (run, runIndex) =>
      hyphenatedRunPieces(
        run,
        hyphenateWord,
        piece[1] && runIndex === runs.length - 1 ? "soft-hyphen" : "none"
      )).pipe(Effect.map(Arr.flatten))
  }).pipe(Effect.map(Arr.flatten))

const measureGraphemeData = (
  text: string,
  measure: Measure,
  preferPrefixWidthsForBreakableRuns: boolean
): Effect.Effect<GraphemeMeasurement, MeasurementFailed> => {
  if (isZeroWidthControlText(text)) {
    return Effect.succeed({
      fitPrefixWidths: Arr.make(0),
      fitWidth: 0,
      graphemeAdvances: Arr.make(0),
      graphemes: Arr.make(text),
      paintWidth: 0
    })
  }

  const graphemes = graphemeClusters(text)

  if (graphemes.length === 0) {
    return Effect.succeed({
      fitPrefixWidths: [],
      fitWidth: 0,
      graphemeAdvances: [],
      graphemes,
      paintWidth: 0
    })
  }

  return preferPrefixWidthsForBreakableRuns
    ? Effect.all({
      fitPrefixWidths: Effect.forEach(cumulativeTexts(graphemes), measure),
      graphemeAdvances: Effect.forEach(graphemes, measure)
    }).pipe(
      Effect.map(({ fitPrefixWidths, graphemeAdvances }) => ({
        fitPrefixWidths,
        fitWidth: lastOrElse(fitPrefixWidths, 0),
        graphemeAdvances,
        graphemes,
        paintWidth: sumWidths(graphemeAdvances)
      }))
    )
    : Effect.forEach(graphemes, measure).pipe(
      Effect.map((graphemeAdvances) => {
        const fitPrefixWidths = prefixWidthsFor(graphemeAdvances)

        return {
          fitPrefixWidths,
          fitWidth: lastOrElse(fitPrefixWidths, 0),
          graphemeAdvances,
          graphemes,
          paintWidth: sumWidths(graphemeAdvances)
        }
      })
    )
}

const prepareTextSegment = (
  segment: TextSegmentType,
  context: PreparationContext
): Effect.Effect<ReadonlyArray<PreparedSegmentType>, MeasurementFailed> =>
  Effect.gen(function*() {
    const pieces = yield* hyphenatedTextPieces(
      segment.text,
      context.hyphenateWord,
      context.dictionaryHyphenationActive
    )

    if (pieces.length === 0) {
      return []
    }

    const fitMeasurementTexts = pieces.length > 1 && context.engineProfile.preferPrefixWidthsForBreakableRuns
      ? cumulativeTexts(Arr.map(pieces, (piece) => piece.text))
      : Arr.map(pieces, (piece) => piece.text)
    const fitPieceWidths = yield* Effect.forEach(fitMeasurementTexts, context.measure)

    return yield* Effect.forEach(
      pieces,
      (piece, index) =>
        measureGraphemeData(piece.text, context.measure, context.engineProfile.preferPrefixWidthsForBreakableRuns).pipe(
          Effect.map((graphemeData) => {
            const fitWidth = isZeroWidthControlText(piece.text)
              ? 0
              : pieces.length > 1 && context.engineProfile.preferPrefixWidthsForBreakableRuns
              ? widthFromPrefixMeasurements(fitPieceWidths, index)
              : graphemeData.fitWidth

            return makeTextSegment(
              piece.text,
              graphemeData.paintWidth,
              fitWidth,
              graphemeData.graphemes,
              graphemeData.graphemeAdvances,
              graphemeData.fitPrefixWidths,
              piece.breakOpportunity,
              context.hyphenWidth,
              context.baseDirection
            )
          })
        )
    )
  })

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

const fitPrefixWidthsFor = (segment: PreparedSegmentType): ReadonlyArray<number> =>
  segment.kind === "text" ? segment.fitPrefixWidths : []

const graphemeBidiLevelsFor = (segment: PreparedSegmentType): ReadonlyArray<number> =>
  segment.kind === "text" ? segment.graphemeBidiLevels : []

const mirroredGraphemesFor = (segment: PreparedSegmentType): ReadonlyArray<string> =>
  segment.kind === "text" ? segment.mirroredGraphemes : []

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
    fitAdvances: Arr.map(segments, (segment) => segment.fitWidth),
    paintAdvances: Arr.map(segments, (segment) => segment.width),
    chunkStartIndices: Arr.map(chunks, (chunk) => chunk.startSegmentIndex),
    chunkConsumedEndIndices: Arr.map(chunks, (chunk) => chunk.consumedEndSegmentIndex),
    breakableGraphemeWidths,
    breakablePrefixWidths: Arr.map(segments, fitPrefixWidthsFor),
    graphemeBidiLevels: Arr.map(segments, graphemeBidiLevelsFor),
    mirroredGraphemes: Arr.map(segments, mirroredGraphemesFor),
    discretionaryHyphenWidth: hyphenWidth,
    tabStopAdvance
  }
}

const retainLogicalSurface = (segments: ReadonlyArray<PreparedSegmentType>): PreparedTextLogicalSurfaceType => ({
  segments
})

/**
 * Resolves the prepared base direction once from source text and engine defaults.
 *
 * @since 0.2.0
 * @category internals
 */
export const resolvePreparedBaseDirection = (
  text: string,
  engineProfile: EngineProfileType
): BaseTextDirectionType => resolveBaseDirection(text, engineProfile.defaultDirection)

/**
 * Compiles analyzed segments into the walker kernel and retained logical surface.
 *
 * @since 0.2.0
 * @category internals
 */
export const prepareSegments = (
  segments: ReadonlyArray<TextSegmentType>,
  whiteSpace: WhiteSpaceModeType,
  engineProfile: EngineProfileType,
  baseDirection: BaseTextDirectionType,
  measure: Measure,
  hyphenateWord: HyphenateWord,
  dictionaryHyphenationActive: boolean
): Effect.Effect<
  {
    readonly kernelRuntime: PreparedRuntimeTablesType
    readonly logicalSurface: PreparedTextLogicalSurfaceType
  },
  MeasurementFailed
> =>
  Effect.gen(function*() {
    const needsDiscretionaryHyphenWidth = Arr.some(
      segments,
      (segment) => segment.kind === "text" && (segment.text.includes(SOFT_HYPHEN) || dictionaryHyphenationActive)
    )
    const needsTabStopAdvance = Arr.some(segments, (segment) => segment.kind === "space" && segment.text.includes("\t"))
    const hyphenWidth = needsDiscretionaryHyphenWidth ? yield* measure("-") : 0
    const tabStopAdvance = needsTabStopAdvance ? (yield* measure(" ")) * engineProfile.tabWidth : 0
    const context: PreparationContext = {
      baseDirection,
      dictionaryHyphenationActive,
      engineProfile,
      hyphenWidth,
      hyphenateWord,
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
