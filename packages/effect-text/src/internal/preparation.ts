/**
 * Compilation of measured logical segments into immutable walker tables.
 *
 * @since 0.1.0
 */
import { Boolean, Chunk, Data, Effect, Match, Number, Option, Schema, String, Tuple } from "effect"
import type { Context } from "effect"
import * as Arr from "effect/Array"

import type * as Hyphenation from "../Hyphenation.js"
import type * as MeasurementCache from "../MeasurementCache.js"
import type * as Text from "../Text.js"
import type * as TextMeasurer from "../TextMeasurer.js"
import {
  bidiLevelForDirection,
  detectTextDirection,
  graphemeClusters,
  noBreakSpace,
  resolveBaseDirection,
  softHyphen,
  splitSoftHyphenPieces,
  splitWhitespaceTokens,
  type TextDirection,
  wordJoiner,
  zeroWidthSpace
} from "./analysis.js"
import { containsUnsupportedBidiControls, mirrorText } from "./bidi.js"
import {
  type BreakOpportunity,
  HyphenatedPiece,
  normalizeLocale,
  splitDictionaryHyphenationPieces
} from "./hyphenation.js"
import * as Prepared from "./prepared.js"

type Measure = (text: string) => Effect.Effect<number, TextMeasurer.Failed>
type HyphenateWord = (word: string) => Effect.Effect<Hyphenation.BreakPoints>

const WhitespaceSegmentKind = Prepared.SegmentKind.pipe(Schema.pickLiteral("space", "tab"))
type WhitespaceSegmentKind = typeof WhitespaceSegmentKind.Type
type HyphenatedPieces = Chunk.Chunk<HyphenatedPiece>
type StringValues = Chunk.Chunk<string>
type WidthValues = Chunk.Chunk<number>

class PreparationContext extends Data.Class<{
  baseDirection: Text.Direction
  dictionaryHyphenationActive: boolean
  engineProfile: Text.Profile
  hyphenWidth: number
  hyphenateWord: HyphenateWord
  measure: Measure
  tabStopAdvance: number
}> {}

class GraphemeMeasurement extends Data.Class<{
  readonly fitPrefixWidths: WidthValues
  readonly fitWidth: number
  readonly graphemeAdvances: WidthValues
  readonly graphemes: StringValues
  readonly paintWidth: number
}> {}

class PreparedBidiGraphemeData extends Data.Class<{
  readonly graphemeBidiLevels: WidthValues
  readonly mirroredGraphemes: StringValues
}> {}

class HyphenationRun extends Data.Class<{
  readonly hyphenate: boolean
  readonly text: string
}> {}

type HyphenationRuns = Chunk.Chunk<HyphenationRun>

class PreparedSegmentsCompilation extends Data.Class<{
  readonly kernelRuntime: Prepared.RuntimeTables
  readonly surface: Prepared.Surface
}> {}

const isZeroWidthControlText = (text: string): boolean =>
  Boolean.or(String.Equivalence(text, zeroWidthSpace), String.Equivalence(text, wordJoiner))
const isHyphenatableText = Schema.is(Schema.String.pipe(Schema.pattern(/^[\p{Letter}\p{Mark}\u200c\u200d]+$/u)))

const lastWidthOrElse = (values: WidthValues, fallback: number): number =>
  Chunk.last(values).pipe(Option.getOrElse(() => fallback))

const valueAtOrZero = (values: WidthValues, index: number): number =>
  Chunk.get(values, index).pipe(Option.getOrElse(() => 0))

const widthFromPrefixMeasurements = (measuredWidths: WidthValues, index: number): number =>
  Number.subtract(valueAtOrZero(measuredWidths, index), valueAtOrZero(measuredWidths, Number.decrement(index)))

const prefixWidthsFor = (widths: WidthValues): WidthValues =>
  Tuple.getSecond(
    Chunk.mapAccum(widths, 0, (total, width) => {
      const next = Number.sum(total, width)
      return Tuple.make(next, next)
    })
  )

const resolvedTextDirection = (
  direction: TextDirection,
  fallback: Text.Direction
): Text.Direction =>
  Match.value(direction).pipe(
    Match.withReturnType<Text.Direction>(),
    Match.when("neutral", () => fallback),
    Match.when("ltr", () => "ltr"),
    Match.when("rtl", () => "rtl"),
    Match.exhaustive
  )

const preparedTextBreakKindFor = (segment: Prepared.Segment): Prepared.BreakKind =>
  Match.value(segment.text).pipe(
    Match.withReturnType<Prepared.BreakKind>(),
    Match.when(zeroWidthSpace, () => "zero-width-break"),
    Match.when(wordJoiner, () => "glue"),
    Match.when(noBreakSpace, () => "glue"),
    Match.orElse(() =>
      Match.value(segment.breakOpportunity).pipe(
        Match.withReturnType<Prepared.BreakKind>(),
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
  graphemes: StringValues,
  segmentDirection: Text.Direction,
  baseDirection: Text.Direction
): PreparedBidiGraphemeData =>
  Boolean.match(containsUnsupportedBidiControls(text), {
    onFalse: () =>
      new PreparedBidiGraphemeData({
        graphemeBidiLevels: Chunk.map(
          graphemes,
          (grapheme) =>
            bidiLevelForDirection(resolvedTextDirection(detectTextDirection(grapheme), segmentDirection), baseDirection)
        ),
        mirroredGraphemes: Chunk.map(graphemes, mirrorText)
      }),
    onTrue: () =>
      new PreparedBidiGraphemeData({
        graphemeBidiLevels: Chunk.map(graphemes, () => bidiLevelForDirection(segmentDirection, baseDirection)),
        mirroredGraphemes: graphemes
      })
  })

const makeTextSegment = (
  text: string,
  width: number,
  fitWidth: number,
  graphemes: StringValues,
  graphemeAdvances: WidthValues,
  fitPrefixWidths: WidthValues,
  breakOpportunity: BreakOpportunity,
  breakWidth: number,
  baseDirection: Text.Direction
): Prepared.Segment => {
  const direction = detectTextDirection(text)
  const segmentDirection = resolvedTextDirection(direction, baseDirection)
  const bidiData = compilePreparedBidiGraphemeData(text, graphemes, segmentDirection, baseDirection)

  return new Prepared.Segment({
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
  kind: WhitespaceSegmentKind,
  text: string,
  width: number,
  baseDirection: Text.Direction
): Prepared.Segment =>
  new Prepared.Segment({
    kind,
    text,
    width,
    fitWidth: width,
    direction: "neutral",
    bidiLevel: bidiLevelForDirection("neutral", baseDirection),
    breakOpportunity: "space",
    breakText: "",
    breakWidth: 0,
    graphemes: Chunk.empty(),
    graphemeAdvances: Chunk.empty(),
    fitPrefixWidths: Chunk.empty(),
    graphemeBidiLevels: Chunk.empty(),
    mirroredGraphemes: Chunk.empty()
  })

const makeHardBreakSegment = (baseDirection: Text.Direction): Prepared.Segment =>
  new Prepared.Segment({
    kind: "hard-break",
    text: "\n",
    width: 0,
    fitWidth: 0,
    direction: "neutral",
    bidiLevel: bidiLevelForDirection("neutral", baseDirection),
    breakOpportunity: "none",
    breakText: "",
    breakWidth: 0,
    graphemes: Chunk.empty(),
    graphemeAdvances: Chunk.empty(),
    fitPrefixWidths: Chunk.empty(),
    graphemeBidiLevels: Chunk.empty(),
    mirroredGraphemes: Chunk.empty()
  })

const cumulativeTexts = (parts: StringValues): StringValues =>
  Tuple.getSecond(
    Chunk.mapAccum<string, string, string>(parts, String.empty, (prefix, part) => {
      const next = String.concat(prefix, part)
      return Tuple.make(next, next)
    })
  )

const hyphenationRuns = (text: string): HyphenationRuns =>
  Arr.match(graphemeClusters(text), {
    onEmpty: Chunk.empty<HyphenationRun>,
    onNonEmpty: (clusters) =>
      Chunk.fromIterable(Arr.map(
        Arr.groupWith(clusters, (left, right) =>
          Boolean.Equivalence(isHyphenatableText(left), isHyphenatableText(right))),
        (graphemes) =>
          new HyphenationRun({
            hyphenate: isHyphenatableText(Arr.headNonEmpty(graphemes)),
            text: Arr.join(graphemes, "")
          })
      ))
  })

const hyphenatedRunPieces = (
  run: HyphenationRun,
  hyphenateWord: HyphenateWord,
  finalBreakOpportunity: BreakOpportunity
): Effect.Effect<HyphenatedPieces> =>
  Boolean.match(run.hyphenate, {
    onFalse: () =>
      Effect.succeed(Chunk.of(new HyphenatedPiece({ breakOpportunity: finalBreakOpportunity, text: run.text }))),
    onTrue: () =>
      hyphenateWord(run.text).pipe(
        Effect.map((breakPoints) => splitDictionaryHyphenationPieces(run.text, breakPoints, finalBreakOpportunity))
      )
  })

const hyphenatedTextPieces = (
  text: string,
  hyphenateWord: HyphenateWord,
  dictionaryHyphenationActive: boolean
): Effect.Effect<HyphenatedPieces> =>
  Effect.forEach(splitSoftHyphenPieces(text), (piece) => {
    const runs = Boolean.match(dictionaryHyphenationActive, {
      onFalse: () => Chunk.of(new HyphenationRun({ hyphenate: false, text: piece.text })),
      onTrue: () => hyphenationRuns(piece.text)
    })

    return Effect.forEach(Chunk.toReadonlyArray(runs), (run, runIndex) =>
      hyphenatedRunPieces(
        run,
        hyphenateWord,
        Boolean.match(Boolean.and(piece.breakAfter, Number.Equivalence(runIndex, Number.decrement(runs.length))), {
          onFalse: () => "none",
          onTrue: () => "soft-hyphen"
        })
      )).pipe(Effect.map((pieces) => Chunk.flatten(Chunk.fromIterable(pieces))))
  }).pipe(Effect.map((pieces) => Chunk.flatten(Chunk.fromIterable(pieces))))

const measureGraphemeData = (
  text: string,
  measure: Measure,
  preferPrefixWidthsForBreakableRuns: boolean
): Effect.Effect<GraphemeMeasurement, TextMeasurer.Failed> => {
  const zeroWidthMeasurement = new GraphemeMeasurement({
    fitPrefixWidths: Chunk.of(0),
    fitWidth: 0,
    graphemeAdvances: Chunk.of(0),
    graphemes: Chunk.of(text),
    paintWidth: 0
  })
  const graphemes = Chunk.fromIterable(graphemeClusters(text))
  const emptyMeasurement = new GraphemeMeasurement({
    fitPrefixWidths: Chunk.empty(),
    fitWidth: 0,
    graphemeAdvances: Chunk.empty(),
    graphemes: Chunk.empty(),
    paintWidth: 0
  })
  const measured = Boolean.match(preferPrefixWidthsForBreakableRuns, {
    onFalse: () =>
      Effect.forEach(Chunk.toReadonlyArray(graphemes), measure).pipe(
        Effect.map((measuredAdvances) => {
          const graphemeAdvances = Chunk.fromIterable(measuredAdvances)
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
        fitPrefixWidths: Effect.forEach(Chunk.toReadonlyArray(cumulativeTexts(graphemes)), measure).pipe(
          Effect.map(Chunk.fromIterable)
        ),
        graphemeAdvances: Effect.forEach(Chunk.toReadonlyArray(graphemes), measure).pipe(
          Effect.map(Chunk.fromIterable)
        )
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
      Boolean.match(Chunk.isEmpty(graphemes), {
        onFalse: () => measured,
        onTrue: () => Effect.succeed(emptyMeasurement)
      }),
    onTrue: () => Effect.succeed(zeroWidthMeasurement)
  })
}

const prepareTextSegment = (
  segment: Text.Segment,
  context: PreparationContext
): Effect.Effect<Prepared.Segments, TextMeasurer.Failed> =>
  Effect.gen(function*() {
    const pieces = yield* hyphenatedTextPieces(
      segment.text,
      context.hyphenateWord,
      context.dictionaryHyphenationActive
    )

    const pieceTexts = Chunk.map(pieces, (piece) => piece.text)
    const useCumulativeMeasurements = Boolean.and(
      Number.greaterThan(pieces.length, 1),
      context.engineProfile.preferPrefixWidthsForBreakableRuns
    )
    const fitMeasurementTexts = Boolean.match(useCumulativeMeasurements, {
      onFalse: () => pieceTexts,
      onTrue: () => cumulativeTexts(pieceTexts)
    })
    const fitPieceWidths = yield* Effect.forEach(
      Chunk.toReadonlyArray(fitMeasurementTexts),
      context.measure
    ).pipe(Effect.map(Chunk.fromIterable))

    return yield* Boolean.match(Chunk.isEmpty(pieces), {
      onFalse: () =>
        Effect.forEach(
          Chunk.toReadonlyArray(pieces),
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
        ).pipe(Effect.map(Chunk.fromIterable)),
      onTrue: () => Effect.succeed(Chunk.empty<Prepared.Segment>())
    })
  })

const prepareWhitespaceSegment = (
  segment: Text.Segment,
  context: PreparationContext
): Effect.Effect<Prepared.Segments, TextMeasurer.Failed> =>
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
    )).pipe(Effect.map(Chunk.fromIterable))

const prepareSegment = (
  segment: Text.Segment,
  context: PreparationContext
): Effect.Effect<Prepared.Segments, TextMeasurer.Failed> =>
  Match.value(segment.kind).pipe(
    Match.when("hard-break", () => Effect.succeed(Chunk.of(makeHardBreakSegment(context.baseDirection)))),
    Match.when("space", () => prepareWhitespaceSegment(segment, context)),
    Match.when("text", () => prepareTextSegment(segment, context)),
    Match.exhaustive
  )

const preparedBreakKindFor = (
  segment: Prepared.Segment,
  whiteSpace: Text.Whitespace
): Prepared.BreakKind =>
  Match.value(segment.kind).pipe(
    Match.withReturnType<Prepared.BreakKind>(),
    Match.when("hard-break", () => "hard-break"),
    Match.when("tab", () => "tab"),
    Match.when("space", () =>
      Match.value(whiteSpace).pipe(
        Match.withReturnType<Prepared.BreakKind>(),
        Match.when("normal", () => "space"),
        Match.when("pre-wrap", () => "preserved-space"),
        Match.exhaustive
      )),
    Match.when("text", () => preparedTextBreakKindFor(segment)),
    Match.exhaustive
  )

const lineChunksFor = (segments: Prepared.Segments): Prepared.LineChunks => {
  const hardBreakIndices = Chunk.filterMap(
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
  const [trailingStartSegmentIndex, hardBreakChunks] = Chunk.mapAccum(
    hardBreakIndices,
    0,
    (startSegmentIndex, hardBreakIndex) => {
      const consumedEndSegmentIndex = Number.increment(hardBreakIndex)

      return Tuple.make(
        consumedEndSegmentIndex,
        new Prepared.LineChunk({ startSegmentIndex, consumedEndSegmentIndex })
      )
    }
  )

  return Chunk.append(
    hardBreakChunks,
    new Prepared.LineChunk({
      startSegmentIndex: trailingStartSegmentIndex,
      consumedEndSegmentIndex: segments.length
    })
  )
}

const compileRuntimeSegment = (
  segment: Prepared.Segment,
  whiteSpace: Text.Whitespace
): Prepared.RuntimeSegment => {
  const breakableGraphemeWidths = Chunk.toReadonlyArray(segment.graphemeAdvances)
  const prefixes = Chunk.toReadonlyArray(segment.fitPrefixWidths)

  return new Prepared.RuntimeSegment({
    breakKind: preparedBreakKindFor(segment, whiteSpace),
    breakableGraphemeCount: Arr.length(breakableGraphemeWidths),
    breakableGraphemeWidths,
    // Every subsequent layout uses these same differences. Retain their
    // binary64 rounding here rather than subtracting again per grapheme.
    breakableFitAdvances: Arr.map(prefixes, (width, index) =>
      Boolean.match(Number.Equivalence(index, 0), {
        onTrue: () => width,
        onFalse: () => Number.subtract(width, Arr.unsafeGet(prefixes, Number.decrement(index)))
      })),
    fitAdvance: segment.fitWidth,
    graphemeBidiLevels: Chunk.toReadonlyArray(segment.graphemeBidiLevels),
    mirroredGraphemes: Chunk.toReadonlyArray(segment.mirroredGraphemes),
    paintAdvance: segment.width
  })
}

const compileKernelRuntime = (
  segments: Prepared.Segments,
  hyphenWidth: number,
  tabStopAdvance: number,
  whiteSpace: Text.Whitespace
): Prepared.RuntimeTables => {
  const chunks = lineChunksFor(segments)
  const runtimeSegments: Prepared.RuntimeSegments = Arr.map(
    Chunk.toReadonlyArray(segments),
    (segment) => compileRuntimeSegment(segment, whiteSpace)
  )

  return new Prepared.RuntimeTables({
    chunks,
    discretionaryHyphenWidth: hyphenWidth,
    segments: runtimeSegments,
    tabStopAdvance
  })
}

const retainLogicalSurface = (segments: Prepared.Segments): Prepared.Surface =>
  new Prepared.Surface({ segments: Chunk.toReadonlyArray(segments) })

/**
 * Resolves the prepared base direction once from source text and engine defaults.
 *
 * @since 0.2.0
 * @category internals
 */
export const resolvePreparedBaseDirection = (
  text: string,
  engineProfile: Text.Profile
): Text.Direction => resolveBaseDirection(text, engineProfile.defaultDirection)

/**
 * Compiles analyzed segments into the walker kernel and retained logical surface.
 *
 * @since 0.2.0
 * @category internals
 */
export const prepareSegments = (
  segments: Text.Segments,
  whiteSpace: Text.Whitespace,
  engineProfile: Text.Profile,
  baseDirection: Text.Direction,
  measure: Measure,
  hyphenateWord: HyphenateWord,
  dictionaryHyphenationActive: boolean
): Effect.Effect<PreparedSegmentsCompilation, TextMeasurer.Failed> =>
  Effect.gen(function*() {
    const needsDiscretionaryHyphenWidth = Arr.some(
      segments,
      (segment) =>
        Boolean.and(
          String.Equivalence(segment.kind, "text"),
          Boolean.or(String.includes(softHyphen)(segment.text), dictionaryHyphenationActive)
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
    const context = new PreparationContext({
      baseDirection,
      dictionaryHyphenationActive,
      engineProfile,
      hyphenWidth,
      hyphenateWord,
      measure,
      tabStopAdvance
    })
    const prepared = yield* Effect.forEach(segments, (segment) => prepareSegment(segment, context))
    const flattenedSegments = Chunk.flatten(Chunk.fromIterable(prepared))

    return new PreparedSegmentsCompilation({
      kernelRuntime: compileKernelRuntime(flattenedSegments, hyphenWidth, tabStopAdvance, whiteSpace),
      surface: retainLogicalSurface(flattenedSegments)
    })
  })

/** Acquires measurements and compiles the complete prepared handle state. */
export const compile = (
  input: Text.Input,
  segmenter: Context.Tag.Service<typeof Text.Segmenter>,
  cache: Context.Tag.Service<typeof MeasurementCache.MeasurementCache>,
  profile: Text.Profile,
  hyphenationOption: Option.Option<Context.Tag.Service<typeof Hyphenation.Hyphenation>>
): Effect.Effect<Prepared.Compilation, TextMeasurer.Failed> =>
  Effect.gen(function*() {
    const normalizedFont: Text.Font = {
      ...input.font,
      weight: Option.fromNullable(input.font.weight).pipe(Option.getOrElse(() => 400))
    }
    const localeOption = Option.fromNullable(input.hyphenationLocale).pipe(Option.map(normalizeLocale))
    const hyphenationActive = yield* Option.match(Option.product(hyphenationOption, localeOption), {
      onNone: () => Effect.succeed(false),
      onSome: ([hyphenation, locale]) =>
        Option.fromNullable(hyphenation.supportsLocale).pipe(Option.match({
          onNone: () => Effect.succeed(true),
          onSome: (supportsLocale) => supportsLocale(locale)
        }))
    })
    const segments = yield* segmenter.segment(input.text, input.whiteSpace)
    const baseDirection = resolvePreparedBaseDirection(input.text, profile)
    const prepared = yield* prepareSegments(
      segments,
      input.whiteSpace,
      profile,
      baseDirection,
      (text) => cache.measure(normalizedFont, text),
      (word) =>
        Boolean.match(hyphenationActive, {
          onFalse: () => Effect.succeed(Arr.empty<number>()),
          onTrue: () =>
            Option.match(Option.product(hyphenationOption, localeOption), {
              onNone: () => Effect.succeed(Arr.empty<number>()),
              onSome: ([hyphenation, locale]) => hyphenation.hyphenateWord(locale, word)
            })
        }),
      hyphenationActive
    )
    return new Prepared.Compilation({
      kernel: new Prepared.Kernel({
        baseDirection,
        lineFitEpsilon: profile.lineFitEpsilon,
        preferEarlySoftHyphenBreak: profile.preferEarlySoftHyphenBreak,
        runtime: prepared.kernelRuntime,
        whiteSpace: input.whiteSpace
      }),
      surface: prepared.surface
    })
  })
