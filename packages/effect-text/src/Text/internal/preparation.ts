/**
 * Compilation of measured logical segments into immutable walker tables.
 *
 * @since 0.1.0
 */
import { Boolean, Data, Effect, Match, Number, Option, Schema, String, Tuple } from "effect"
import * as Arr from "effect/Array"

import type { MeasurementFailed } from "../../Errors/index.js"
import type {
  PreparedBreakKindType,
  PreparedRuntimeSegmentType,
  PreparedRuntimeTablesType,
  PreparedSegmentType,
  PreparedTextLogicalSurfaceType
} from "../model.js"
import {
  PreparedLineChunk,
  PreparedRuntimeSegment,
  PreparedRuntimeTables,
  PreparedSegment,
  PreparedSegmentKind,
  PreparedTextLogicalSurface
} from "../model.js"
import {
  type BaseTextDirectionType,
  type EngineProfileType,
  TextSegment,
  type TextSegmentType,
  type WhiteSpaceModeType
} from "../schema.js"
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
import { HyphenatedPiece, type HyphenationBreakOpportunity, splitDictionaryHyphenationPieces } from "./hyphenation.js"

type Measure = (text: string) => Effect.Effect<number, MeasurementFailed>
const BreakPoints = Schema.Array(Schema.Number)
type BreakPointsType = typeof BreakPoints.Type
type HyphenateWord = (word: string) => Effect.Effect<BreakPointsType>

const PreparedSegments = Schema.Array(PreparedSegment)
type PreparedSegmentsType = typeof PreparedSegments.Type
const PreparedLineChunks = Schema.Array(PreparedLineChunk)
type PreparedLineChunksType = typeof PreparedLineChunks.Type
const WhitespaceSegmentKind = PreparedSegmentKind.pipe(Schema.pickLiteral("space", "tab"))
type WhitespaceSegmentKindType = typeof WhitespaceSegmentKind.Type
const PreparedRuntimeSegments = Schema.Array(PreparedRuntimeSegment)
type PreparedRuntimeSegmentsType = typeof PreparedRuntimeSegments.Type
const TextSegments = Schema.Array(TextSegment)
type TextSegmentsType = typeof TextSegments.Type
const HyphenatedPieces = Schema.Array(HyphenatedPiece)
type HyphenatedPiecesType = typeof HyphenatedPieces.Type
const StringValues = Schema.Array(Schema.String)
type StringValuesType = typeof StringValues.Type
const WidthValues = Schema.Array(Schema.Number)
type WidthValuesType = typeof WidthValues.Type

class PreparationContext extends Data.Class<{
  baseDirection: BaseTextDirectionType
  dictionaryHyphenationActive: boolean
  engineProfile: EngineProfileType
  hyphenWidth: number
  hyphenateWord: HyphenateWord
  measure: Measure
  tabStopAdvance: number
}> {}

class GraphemeMeasurement extends Schema.Class<GraphemeMeasurement>("effect-text/GraphemeMeasurement")({
  fitPrefixWidths: WidthValues,
  fitWidth: Schema.Number,
  graphemeAdvances: WidthValues,
  graphemes: StringValues,
  paintWidth: Schema.Number
}) {}

class PreparedBidiGraphemeData extends Schema.Class<PreparedBidiGraphemeData>(
  "effect-text/PreparedBidiGraphemeData"
)({
  graphemeBidiLevels: WidthValues,
  mirroredGraphemes: StringValues
}) {}

class HyphenationRun extends Schema.Class<HyphenationRun>("effect-text/HyphenationRun")({
  hyphenate: Schema.Boolean,
  text: Schema.String
}) {}

const HyphenationRuns = Schema.Array(HyphenationRun)
type HyphenationRunsType = typeof HyphenationRuns.Type

class PreparedSegmentsCompilation extends Schema.Class<PreparedSegmentsCompilation>(
  "effect-text/PreparedSegmentsCompilation"
)({
  kernelRuntime: PreparedRuntimeTables,
  logicalSurface: PreparedTextLogicalSurface
}) {}

const isZeroWidthControlText = (text: string): boolean =>
  Boolean.or(String.Equivalence(text, ZERO_WIDTH_SPACE), String.Equivalence(text, WORD_JOINER))
const isHyphenatableText = Schema.is(Schema.String.pipe(Schema.pattern(/^[\p{Letter}\p{Mark}\u200c\u200d]+$/u)))

const lastWidthOrElse = (values: WidthValuesType, fallback: number): number =>
  Arr.last(values).pipe(Option.getOrElse(() => fallback))

const valueAtOrZero = (values: WidthValuesType, index: number): number =>
  Arr.get(values, index).pipe(Option.getOrElse(() => 0))

const widthFromPrefixMeasurements = (measuredWidths: WidthValuesType, index: number): number =>
  Number.subtract(valueAtOrZero(measuredWidths, index), valueAtOrZero(measuredWidths, Number.decrement(index)))

const prefixWidthsFor = (widths: WidthValuesType): WidthValuesType => Arr.drop(Arr.scan(widths, 0, Number.sum), 1)

const resolvedTextDirection = (
  direction: TextDirection,
  fallback: BaseTextDirectionType
): BaseTextDirectionType =>
  Match.value(direction).pipe(
    Match.withReturnType<BaseTextDirectionType>(),
    Match.when("neutral", () => fallback),
    Match.when("ltr", () => "ltr"),
    Match.when("rtl", () => "rtl"),
    Match.exhaustive
  )

const preparedTextBreakKindFor = (segment: PreparedSegmentType): PreparedBreakKindType =>
  Match.value(segment.text).pipe(
    Match.withReturnType<PreparedBreakKindType>(),
    Match.when(ZERO_WIDTH_SPACE, () => "zero-width-break"),
    Match.when(WORD_JOINER, () => "glue"),
    Match.when(NO_BREAK_SPACE, () => "glue"),
    Match.orElse(() =>
      Match.value(segment.breakOpportunity).pipe(
        Match.withReturnType<PreparedBreakKindType>(),
        Match.when("soft-hyphen", () => "soft-hyphen"),
        Match.when("dictionary-hyphen", () => "dictionary-hyphen"),
        Match.when("none", () => "text"),
        Match.when("space", () => "text"),
        Match.exhaustive
      )
    )
  )

const compilePreparedBidiGraphemeData = (
  text: string,
  graphemes: StringValuesType,
  segmentDirection: BaseTextDirectionType,
  baseDirection: BaseTextDirectionType
): PreparedBidiGraphemeData =>
  Boolean.match(containsUnsupportedBidiControls(text), {
    onFalse: () =>
      new PreparedBidiGraphemeData({
        graphemeBidiLevels: Arr.map(
          graphemes,
          (grapheme) =>
            bidiLevelForDirection(resolvedTextDirection(detectTextDirection(grapheme), segmentDirection), baseDirection)
        ),
        mirroredGraphemes: Arr.map(graphemes, mirrorText)
      }),
    onTrue: () =>
      new PreparedBidiGraphemeData({
        graphemeBidiLevels: Arr.map(graphemes, () => bidiLevelForDirection(segmentDirection, baseDirection)),
        mirroredGraphemes: graphemes
      })
  })

const makeTextSegment = (
  text: string,
  width: number,
  fitWidth: number,
  graphemes: StringValuesType,
  graphemeAdvances: WidthValuesType,
  fitPrefixWidths: WidthValuesType,
  breakOpportunity: HyphenationBreakOpportunity,
  breakWidth: number,
  baseDirection: BaseTextDirectionType
): PreparedSegmentType => {
  const direction = detectTextDirection(text)
  const segmentDirection = resolvedTextDirection(direction, baseDirection)
  const bidiData = compilePreparedBidiGraphemeData(text, graphemes, segmentDirection, baseDirection)

  return new PreparedSegment({
    kind: "text",
    text,
    width,
    fitWidth,
    direction,
    bidiLevel: bidiLevelForDirection(direction, baseDirection),
    breakOpportunity,
    breakText: Match.value(breakOpportunity).pipe(
      Match.when("none", () => String.empty),
      Match.when("soft-hyphen", () => "-"),
      Match.when("dictionary-hyphen", () => "-"),
      Match.exhaustive
    ),
    breakWidth: Match.value(breakOpportunity).pipe(
      Match.when("none", () => 0),
      Match.when("soft-hyphen", () => breakWidth),
      Match.when("dictionary-hyphen", () => breakWidth),
      Match.exhaustive
    ),
    graphemes,
    graphemeAdvances,
    fitPrefixWidths,
    graphemeBidiLevels: bidiData.graphemeBidiLevels,
    mirroredGraphemes: bidiData.mirroredGraphemes
  })
}

const makeWhitespaceSegment = (
  kind: WhitespaceSegmentKindType,
  text: string,
  width: number,
  baseDirection: BaseTextDirectionType
): PreparedSegmentType =>
  new PreparedSegment({
    kind,
    text,
    width,
    fitWidth: width,
    direction: "neutral",
    bidiLevel: bidiLevelForDirection("neutral", baseDirection),
    breakOpportunity: "space",
    breakText: "",
    breakWidth: 0,
    graphemes: Arr.empty<string>(),
    graphemeAdvances: Arr.empty<number>(),
    fitPrefixWidths: Arr.empty<number>(),
    graphemeBidiLevels: Arr.empty<number>(),
    mirroredGraphemes: Arr.empty<string>()
  })

const makeHardBreakSegment = (baseDirection: BaseTextDirectionType): PreparedSegmentType =>
  new PreparedSegment({
    kind: "hard-break",
    text: "\n",
    width: 0,
    fitWidth: 0,
    direction: "neutral",
    bidiLevel: bidiLevelForDirection("neutral", baseDirection),
    breakOpportunity: "none",
    breakText: "",
    breakWidth: 0,
    graphemes: Arr.empty<string>(),
    graphemeAdvances: Arr.empty<number>(),
    fitPrefixWidths: Arr.empty<number>(),
    graphemeBidiLevels: Arr.empty<number>(),
    mirroredGraphemes: Arr.empty<string>()
  })

const cumulativeTexts = (parts: StringValuesType): StringValuesType =>
  Arr.drop(Arr.scan(parts, String.empty, String.concat), 1)

const hyphenationRuns = (text: string): HyphenationRunsType =>
  Arr.match(graphemeClusters(text), {
    onEmpty: Arr.empty<HyphenationRun>,
    onNonEmpty: (clusters) =>
      Arr.map(
        Arr.groupWith(clusters, (left, right) =>
          Boolean.Equivalence(isHyphenatableText(left), isHyphenatableText(right))),
        (graphemes) =>
          new HyphenationRun({
            hyphenate: isHyphenatableText(Arr.headNonEmpty(graphemes)),
            text: Arr.join(graphemes, "")
          })
      )
  })

const hyphenatedRunPieces = (
  run: HyphenationRun,
  hyphenateWord: HyphenateWord,
  finalBreakOpportunity: HyphenationBreakOpportunity
): Effect.Effect<HyphenatedPiecesType> =>
  Boolean.match(run.hyphenate, {
    onFalse: () =>
      Effect.succeed(Arr.of(new HyphenatedPiece({ breakOpportunity: finalBreakOpportunity, text: run.text }))),
    onTrue: () =>
      hyphenateWord(run.text).pipe(
        Effect.map((breakPoints) => splitDictionaryHyphenationPieces(run.text, breakPoints, finalBreakOpportunity))
      )
  })

const hyphenatedTextPieces = (
  text: string,
  hyphenateWord: HyphenateWord,
  dictionaryHyphenationActive: boolean
): Effect.Effect<HyphenatedPiecesType> =>
  Effect.forEach(splitSoftHyphenPieces(text), (piece) => {
    const runs = Boolean.match(dictionaryHyphenationActive, {
      onFalse: () => Arr.of(new HyphenationRun({ hyphenate: false, text: piece.text })),
      onTrue: () => hyphenationRuns(piece.text)
    })

    return Effect.forEach(runs, (run, runIndex) =>
      hyphenatedRunPieces(
        run,
        hyphenateWord,
        Boolean.match(Boolean.and(piece.breakAfter, Number.Equivalence(runIndex, Number.decrement(Arr.length(runs)))), {
          onFalse: () => "none",
          onTrue: () => "soft-hyphen"
        })
      )).pipe(Effect.map(Arr.flatten))
  }).pipe(Effect.map(Arr.flatten))

const measureGraphemeData = (
  text: string,
  measure: Measure,
  preferPrefixWidthsForBreakableRuns: boolean
): Effect.Effect<GraphemeMeasurement, MeasurementFailed> => {
  const zeroWidthMeasurement = new GraphemeMeasurement({
    fitPrefixWidths: Arr.of(0),
    fitWidth: 0,
    graphemeAdvances: Arr.of(0),
    graphemes: Arr.of(text),
    paintWidth: 0
  })
  const graphemes = graphemeClusters(text)
  const emptyMeasurement = new GraphemeMeasurement({
    fitPrefixWidths: Arr.empty<number>(),
    fitWidth: 0,
    graphemeAdvances: Arr.empty<number>(),
    graphemes: Arr.empty<string>(),
    paintWidth: 0
  })
  const measured = Boolean.match(preferPrefixWidthsForBreakableRuns, {
    onFalse: () =>
      Effect.forEach(graphemes, measure).pipe(
        Effect.map((graphemeAdvances) => {
          const fitPrefixWidths = prefixWidthsFor(graphemeAdvances)

          return new GraphemeMeasurement({
            fitPrefixWidths,
            fitWidth: lastWidthOrElse(fitPrefixWidths, 0),
            graphemeAdvances,
            graphemes,
            paintWidth: Number.sumAll(graphemeAdvances)
          })
        })
      ),
    onTrue: () =>
      Effect.all({
        fitPrefixWidths: Effect.forEach(cumulativeTexts(graphemes), measure),
        graphemeAdvances: Effect.forEach(graphemes, measure)
      }).pipe(
        Effect.map(({ fitPrefixWidths, graphemeAdvances }) =>
          new GraphemeMeasurement({
            fitPrefixWidths,
            fitWidth: lastWidthOrElse(fitPrefixWidths, 0),
            graphemeAdvances,
            graphemes,
            paintWidth: Number.sumAll(graphemeAdvances)
          })
        )
      )
  })

  return Boolean.match(isZeroWidthControlText(text), {
    onFalse: () =>
      Boolean.match(Arr.isEmptyReadonlyArray(graphemes), {
        onFalse: () => measured,
        onTrue: () => Effect.succeed(emptyMeasurement)
      }),
    onTrue: () => Effect.succeed(zeroWidthMeasurement)
  })
}

const prepareTextSegment = (
  segment: TextSegmentType,
  context: PreparationContext
): Effect.Effect<PreparedSegmentsType, MeasurementFailed> =>
  Effect.gen(function*() {
    const pieces = yield* hyphenatedTextPieces(
      segment.text,
      context.hyphenateWord,
      context.dictionaryHyphenationActive
    )

    const pieceTexts = Arr.map(pieces, (piece) => piece.text)
    const useCumulativeMeasurements = Boolean.and(
      Number.greaterThan(Arr.length(pieces), 1),
      context.engineProfile.preferPrefixWidthsForBreakableRuns
    )
    const fitMeasurementTexts = Boolean.match(useCumulativeMeasurements, {
      onFalse: () => pieceTexts,
      onTrue: () => cumulativeTexts(pieceTexts)
    })
    const fitPieceWidths = yield* Effect.forEach(fitMeasurementTexts, context.measure)

    return yield* Boolean.match(Arr.isEmptyReadonlyArray(pieces), {
      onFalse: () =>
        Effect.forEach(
          pieces,
          (piece, index) =>
            measureGraphemeData(piece.text, context.measure, context.engineProfile.preferPrefixWidthsForBreakableRuns)
              .pipe(
                Effect.map((graphemeData) => {
                  const fitWidth = Boolean.match(isZeroWidthControlText(piece.text), {
                    onFalse: () =>
                      Boolean.match(useCumulativeMeasurements, {
                        onFalse: () => graphemeData.fitWidth,
                        onTrue: () => widthFromPrefixMeasurements(fitPieceWidths, index)
                      }),
                    onTrue: () => 0
                  })

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
        ),
      onTrue: () => Effect.succeed(Arr.empty<PreparedSegmentType>())
    })
  })

const prepareWhitespaceSegment = (
  segment: TextSegmentType,
  context: PreparationContext
): Effect.Effect<PreparedSegmentsType, MeasurementFailed> =>
  Effect.forEach(splitWhitespaceTokens(segment.text), (token) =>
    Match.value(token.kind).pipe(
      Match.when("tab", () =>
        Effect.succeed(makeWhitespaceSegment("tab", token.text, context.tabStopAdvance, context.baseDirection))),
      Match.when("space", () =>
        context.measure(token.text).pipe(
          Effect.map((width) =>
            makeWhitespaceSegment("space", token.text, width, context.baseDirection)
          )
        )),
      Match.exhaustive
    ))

const prepareSegment = (
  segment: TextSegmentType,
  context: PreparationContext
): Effect.Effect<PreparedSegmentsType, MeasurementFailed> =>
  Match.value(segment.kind).pipe(
    Match.when("hard-break", () => Effect.succeed(Arr.make(makeHardBreakSegment(context.baseDirection)))),
    Match.when("space", () => prepareWhitespaceSegment(segment, context)),
    Match.when("text", () => prepareTextSegment(segment, context)),
    Match.exhaustive
  )

const preparedBreakKindFor = (
  segment: PreparedSegmentType,
  whiteSpace: WhiteSpaceModeType
): PreparedBreakKindType =>
  Match.value(segment.kind).pipe(
    Match.withReturnType<PreparedBreakKindType>(),
    Match.when("hard-break", () => "hard-break"),
    Match.when("tab", () => "tab"),
    Match.when("space", () =>
      Match.value(whiteSpace).pipe(
        Match.withReturnType<PreparedBreakKindType>(),
        Match.when("normal", () => "space"),
        Match.when("pre-wrap", () => "preserved-space"),
        Match.exhaustive
      )),
    Match.when("text", () => preparedTextBreakKindFor(segment)),
    Match.exhaustive
  )

const textWidthsOrEmpty = (segment: PreparedSegmentType, values: WidthValuesType): WidthValuesType =>
  Match.value(segment.kind).pipe(
    Match.when("text", () => values),
    Match.when("space", Arr.empty<number>),
    Match.when("tab", Arr.empty<number>),
    Match.when("hard-break", Arr.empty<number>),
    Match.exhaustive
  )

const textStringsOrEmpty = (segment: PreparedSegmentType, values: StringValuesType): StringValuesType =>
  Match.value(segment.kind).pipe(
    Match.when("text", () => values),
    Match.when("space", Arr.empty<string>),
    Match.when("tab", Arr.empty<string>),
    Match.when("hard-break", Arr.empty<string>),
    Match.exhaustive
  )

const lineChunksFor = (segments: PreparedSegmentsType): PreparedLineChunksType => {
  const hardBreakIndices = Arr.filterMap(
    segments,
    (segment, index) =>
      Match.value(segment.kind).pipe(
        Match.withReturnType<Option.Option<number>>(),
        Match.when("hard-break", () => Option.some(index)),
        Match.when("text", () => Option.none()),
        Match.when("space", () => Option.none()),
        Match.when("tab", () => Option.none()),
        Match.exhaustive
      )
  )
  const [trailingStartSegmentIndex, hardBreakChunks] = Arr.mapAccum(
    hardBreakIndices,
    0,
    (startSegmentIndex, hardBreakIndex) => {
      const consumedEndSegmentIndex = Number.increment(hardBreakIndex)

      return Tuple.make(
        consumedEndSegmentIndex,
        new PreparedLineChunk({ startSegmentIndex, consumedEndSegmentIndex })
      )
    }
  )

  return Arr.append(
    hardBreakChunks,
    new PreparedLineChunk({
      startSegmentIndex: trailingStartSegmentIndex,
      consumedEndSegmentIndex: Arr.length(segments)
    })
  )
}

const compileRuntimeSegment = (
  segment: PreparedSegmentType,
  whiteSpace: WhiteSpaceModeType
): PreparedRuntimeSegmentType =>
  new PreparedRuntimeSegment({
    breakKind: preparedBreakKindFor(segment, whiteSpace),
    breakableGraphemeWidths: textWidthsOrEmpty(segment, segment.graphemeAdvances),
    breakablePrefixWidths: textWidthsOrEmpty(segment, segment.fitPrefixWidths),
    fitAdvance: segment.fitWidth,
    graphemeBidiLevels: textWidthsOrEmpty(segment, segment.graphemeBidiLevels),
    mirroredGraphemes: textStringsOrEmpty(segment, segment.mirroredGraphemes),
    paintAdvance: segment.width
  })

const compileKernelRuntime = (
  segments: PreparedSegmentsType,
  hyphenWidth: number,
  tabStopAdvance: number,
  whiteSpace: WhiteSpaceModeType
): PreparedRuntimeTablesType => {
  const chunks = lineChunksFor(segments)
  const runtimeSegments: PreparedRuntimeSegmentsType = Arr.map(
    segments,
    (segment) => compileRuntimeSegment(segment, whiteSpace)
  )

  return new PreparedRuntimeTables({
    chunks,
    discretionaryHyphenWidth: hyphenWidth,
    segments: runtimeSegments,
    tabStopAdvance
  })
}

const retainLogicalSurface = (segments: PreparedSegmentsType): PreparedTextLogicalSurfaceType =>
  new PreparedTextLogicalSurface({ segments })

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
  segments: TextSegmentsType,
  whiteSpace: WhiteSpaceModeType,
  engineProfile: EngineProfileType,
  baseDirection: BaseTextDirectionType,
  measure: Measure,
  hyphenateWord: HyphenateWord,
  dictionaryHyphenationActive: boolean
): Effect.Effect<PreparedSegmentsCompilation, MeasurementFailed> =>
  Effect.gen(function*() {
    const needsDiscretionaryHyphenWidth = Arr.some(
      segments,
      (segment) =>
        Boolean.and(
          String.Equivalence(segment.kind, "text"),
          Boolean.or(String.includes(SOFT_HYPHEN)(segment.text), dictionaryHyphenationActive)
        )
    )
    const needsTabStopAdvance = Arr.some(
      segments,
      (segment) => Boolean.and(String.Equivalence(segment.kind, "space"), String.includes("\t")(segment.text))
    )
    const hyphenWidth = yield* Boolean.match(needsDiscretionaryHyphenWidth, {
      onFalse: () => Effect.succeed(0),
      onTrue: () => measure("-")
    })
    const tabStopAdvance = yield* Boolean.match(needsTabStopAdvance, {
      onFalse: () => Effect.succeed(0),
      onTrue: () => measure(" ").pipe(Effect.map(Number.multiply(engineProfile.tabWidth)))
    })
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

    return new PreparedSegmentsCompilation({
      kernelRuntime: compileKernelRuntime(flattenedSegments, hyphenWidth, tabStopAdvance, whiteSpace),
      logicalSurface: retainLogicalSurface(flattenedSegments)
    })
  })
