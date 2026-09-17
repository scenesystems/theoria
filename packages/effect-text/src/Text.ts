/**
 * Compiles measured text once and projects summaries, visual lines, cursor
 * ranges, incremental lines, and streams without remeasurement.
 *
 * @since 0.5.0
 * @module
 */
import {
  Boolean,
  Context,
  Data,
  Effect,
  Function,
  Layer,
  Number,
  Option,
  ParseResult,
  Predicate,
  Schema,
  Stream,
  Tuple
} from "effect"
import * as Arr from "effect/Array"

import * as Hyphenation from "./Hyphenation.js"
import { segmentText } from "./internal/analysis.js"
import * as InternalLayout from "./internal/layout.js"
import * as Preparation from "./internal/preparation.js"
import type * as Prepared from "./internal/prepared.js"
import * as MeasurementCache from "./MeasurementCache.js"
import * as TextMeasurer from "./TextMeasurer.js"

const finiteNumber = Schema.Number.pipe(Schema.finite())
const nonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
const positiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))

/**
 * A font family, positive CSS-pixel size, and optional positive integer weight.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Font = Schema.Struct({
  family: Schema.String,
  size: finiteNumber.pipe(Schema.greaterThan(0)),
  weight: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)))
})

/**
 * A font family, positive CSS-pixel size, and optional positive integer weight.
 *
 * @since 0.5.0
 * @category models
 */
export type Font = typeof Font.Type

/**
 * Whitespace collapsing or preservation policy used during preparation.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Whitespace = Schema.Literal("normal", "pre-wrap")

/**
 * Whitespace collapsing or preservation policy used during preparation.
 *
 * @since 0.5.0
 * @category models
 */
export type Whitespace = typeof Whitespace.Type

/**
 * Resolved paragraph direction retained by prepared text and projected lines.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Direction = Schema.Literal("ltr", "rtl")

/**
 * Resolved paragraph direction retained by prepared text and projected lines.
 *
 * @since 0.5.0
 * @category models
 */
export type Direction = typeof Direction.Type

/**
 * Logical segment classifications produced by a `Segmenter`.
 *
 * @since 0.5.0
 * @category schemas
 */
export const SegmentKind = Schema.Literal("text", "space", "hard-break")

/**
 * Logical segment classifications produced by a `Segmenter`.
 *
 * @since 0.5.0
 * @category models
 */
export type SegmentKind = typeof SegmentKind.Type

/**
 * One logical text, whitespace, or hard-break segment.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Segment = Schema.Struct({
  kind: SegmentKind,
  text: Schema.String
})

/**
 * One logical text, whitespace, or hard-break segment.
 *
 * @since 0.5.0
 * @category models
 */
export type Segment = typeof Segment.Type

/**
 * Ordered logical segments emitted by a `Segmenter`.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Segments = Schema.Array(Segment)

/**
 * Ordered logical segments emitted by a `Segmenter`.
 *
 * @since 0.5.0
 * @category models
 */
export type Segments = typeof Segments.Type

/**
 * Source text and policies compiled by `prepare` and `prepareWithSegments`.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Input = Schema.Struct({
  text: Schema.String,
  font: Font,
  whiteSpace: Whitespace,
  hyphenationLocale: Schema.optional(Hyphenation.Locale)
})

/**
 * Source text and policies compiled by `prepare` and `prepareWithSegments`.
 *
 * @since 0.5.0
 * @category models
 */
export type Input = typeof Input.Type

/**
 * Available line width and painted line height.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Request = Schema.Struct({
  maxWidth: finiteNumber.pipe(Schema.greaterThan(0)),
  lineHeight: finiteNumber.pipe(Schema.greaterThan(0))
})

/**
 * Available line width and painted line height.
 *
 * @since 0.5.0
 * @category models
 */
export type Request = typeof Request.Type

/**
 * Logical segment and grapheme position used for incremental layout.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Cursor = Schema.Struct({
  segmentIndex: nonNegativeInt,
  graphemeIndex: nonNegativeInt
})

/**
 * Logical segment and grapheme position used for incremental layout.
 *
 * @since 0.5.0
 * @category models
 */
export type Cursor = typeof Cursor.Type

const visualMetadata = {
  order: Schema.Literal("visual"),
  baseDirection: Direction
}

/**
 * One materialized visual-order line.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Line = Schema.Struct({
  index: nonNegativeInt,
  ...visualMetadata,
  text: Schema.String,
  width: finiteNumber.pipe(Schema.greaterThanOrEqualTo(0))
})

/**
 * One materialized visual-order line.
 *
 * @since 0.5.0
 * @category models
 */
export type Line = typeof Line.Type

/**
 * Materialized visual lines in output order.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Lines = Schema.Array(Line)

/**
 * Materialized visual lines in output order.
 *
 * @since 0.5.0
 * @category models
 */
export type Lines = typeof Lines.Type

/**
 * A materialized line paired with its successor cursor.
 *
 * @since 0.5.0
 * @category schemas
 */
export const LineStep = Schema.Tuple(Line, Cursor)

/**
 * A materialized line paired with its successor cursor.
 *
 * @since 0.5.0
 * @category models
 */
export type LineStep = typeof LineStep.Type

/**
 * Painted width and half-open logical cursor bounds for one line.
 *
 * @since 0.5.0
 * @category schemas
 */
export const LineRange = Schema.Struct({
  ...visualMetadata,
  width: finiteNumber.pipe(Schema.greaterThanOrEqualTo(0)),
  start: Cursor,
  end: Cursor
})

/**
 * Painted width and half-open logical cursor bounds for one line.
 *
 * @since 0.5.0
 * @category models
 */
export type LineRange = typeof LineRange.Type

/**
 * Ordered logical cursor ranges and painted widths.
 *
 * @since 0.5.0
 * @category schemas
 */
export const LineRanges = Schema.Array(LineRange)

/**
 * Ordered logical cursor ranges and painted widths.
 *
 * @since 0.5.0
 * @category models
 */
export type LineRanges = typeof LineRanges.Type

/**
 * Aggregate line count, height, and maximum painted width.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Summary = Schema.Struct({
  lineCount: nonNegativeInt,
  height: finiteNumber.pipe(Schema.greaterThanOrEqualTo(0)),
  maxLineWidth: finiteNumber.pipe(Schema.greaterThanOrEqualTo(0))
})

/**
 * Aggregate line count, height, and maximum painted width.
 *
 * @since 0.5.0
 * @category models
 */
export type Summary = typeof Summary.Type

/**
 * Materialized lines and aggregate geometry from the same walk.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Layout = Schema.Struct({
  lines: Lines,
  summary: Summary
})

/**
 * Materialized lines and aggregate geometry from the same walk.
 *
 * @since 0.5.0
 * @category models
 */
export type Layout = typeof Layout.Type

/**
 * Preparation-time fit tolerance, tab width, direction, and break preferences.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Profile = Schema.Struct({
  lineFitEpsilon: finiteNumber.pipe(Schema.greaterThanOrEqualTo(0)),
  tabWidth: positiveInt,
  defaultDirection: Direction,
  preferEarlySoftHyphenBreak: Schema.Boolean,
  preferPrefixWidthsForBreakableRuns: Schema.Boolean
})

/**
 * Preparation-time fit tolerance, tab width, direction, and break preferences.
 *
 * @since 0.5.0
 * @category models
 */
export type Profile = typeof Profile.Type

/**
 * Splits source text into logical segments under a whitespace policy.
 *
 * @since 0.5.0
 * @category services
 */
export class Segmenter extends Context.Tag("@scenesystems/effect-text/Text/Segmenter")<
  Segmenter,
  {
    readonly segment: (text: string, whiteSpace: Whitespace) => Effect.Effect<Segments>
  }
>() {}

/**
 * Supplies the profile captured by each prepared handle.
 *
 * @since 0.5.0
 * @category services
 */
export class CurrentProfile extends Context.Tag("@scenesystems/effect-text/Text/CurrentProfile")<
  CurrentProfile,
  Profile
>() {}

/**
 * Required environment for text preparation.
 *
 * @since 0.5.0
 * @category models
 */
export type Services = Segmenter | MeasurementCache.MeasurementCache | CurrentProfile

/**
 * Reports a strict input decoding failure from `prepareUnknown`.
 *
 * @since 0.5.0
 * @category errors
 */
export class DecodeError extends Schema.TaggedError<DecodeError>("@scenesystems/effect-text/Text/DecodeError")(
  "TextLayoutDecodeError",
  {
    reason: Schema.String
  }
) {}

/**
 * Failures produced while decoding or measuring text during preparation.
 *
 * @since 0.5.0
 * @category errors
 */
export type Error = TextMeasurer.Failed | DecodeError

/**
 * Prepared text supporting pure summary and natural-width projections.
 * Construction through `prepare` captures private measurement tables in these
 * operations. Handles have no encoding or content-based equality contract.
 *
 * @since 0.5.0
 * @category models
 */
export class Text extends Data.Class<{
  /** Computes aggregate layout geometry without materializing line strings. */
  readonly summary: (request: Request) => Summary
  /** Returns the widest hard-break-delimited painted width before wrapping. */
  readonly naturalWidth: () => number
}> {}

/**
 * Prepared text with pure visual-line, range, cursor, and stream projections.
 * `prepareWithSegments` retains the logical surface privately; callers do not
 * receive mutable cursor hints or depend on the measurement-table representation.
 *
 * @since 0.5.0
 * @category models
 */
export class WithSegments extends Data.Class<
  Text & {
    /** Materializes lines at a uniform or per-line width. */
    readonly lines: (request: Request, resolveMaxWidth?: LineWidthResolver) => Lines
    /** Materializes lines and summary geometry in one walk. */
    readonly layout: (request: Request) => Layout
    /** Materializes one line and returns its successor cursor. */
    readonly nextLine: (request: Request, cursor: Cursor) => Option.Option<LineStep>
    /** Projects logical bounds at a uniform or per-line width. */
    readonly ranges: (request: Request, resolveMaxWidth?: LineWidthResolver) => LineRanges
    /** Lazily unfolds visual lines without remeasurement. */
    readonly stream: (request: Request) => Stream.Stream<Line>
  }
> {}

const fromKernel = (kernel: Prepared.Kernel): Text =>
  new Text({
    summary: (request) => InternalLayout.summarizeLines(kernel, request),
    naturalWidth: () => InternalLayout.measureNaturalWidth(kernel)
  })

const compile = (input: Input): Effect.Effect<Prepared.Compilation, TextMeasurer.Failed, Services> =>
  Effect.gen(function*() {
    const segmenter = yield* Segmenter
    const cache = yield* MeasurementCache.MeasurementCache
    const profile = yield* CurrentProfile
    const hyphenation = yield* Effect.serviceOption(Hyphenation.Hyphenation)
    return yield* Preparation.compile(input, segmenter, cache, profile, hyphenation)
  })

/**
 * Segments and measures typed input into a summary-capable prepared handle.
 *
 * @since 0.5.0
 * @category constructors
 */
export const prepare = (input: Input): Effect.Effect<Text, TextMeasurer.Failed, Services> =>
  compile(input).pipe(Effect.map(({ kernel }) => fromKernel(kernel)))

/**
 * Segments and measures typed input while retaining visual materialization data.
 *
 * @since 0.5.0
 * @category constructors
 */
export const prepareWithSegments = (input: Input): Effect.Effect<WithSegments, TextMeasurer.Failed, Services> =>
  compile(input).pipe(
    Effect.map((compilation) =>
      new WithSegments({
        ...fromKernel(compilation.kernel),
        lines: (request, resolveMaxWidth) => InternalLayout.materializeLines(compilation, request, resolveMaxWidth),
        layout: (request) => InternalLayout.materializeLinesWithSummary(compilation, request),
        nextLine: (request, cursor) => InternalLayout.materializeLineAtCursor(compilation, request, cursor),
        ranges: (request, resolveMaxWidth) => InternalLayout.walkLineRanges(compilation, request, resolveMaxWidth),
        stream: (request) =>
          Stream.unfold(new StreamState({ cursor: start, lineIndex: 0 }), (state) =>
            Option.map(
              InternalLayout.materializeLineAtCursor(compilation, request, state.cursor, Option.some(state.lineIndex)),
              ([line, cursor]) =>
                Tuple.make(line, new StreamState({ cursor, lineIndex: Number.increment(state.lineIndex) }))
            ))
      })
    )
  )

/**
 * Strictly decodes unknown input and prepares a summary-capable handle.
 *
 * @since 0.5.0
 * @category constructors
 */
export const prepareUnknown = (input: unknown): Effect.Effect<Text, TextMeasurer.Failed | DecodeError, Services> =>
  Schema.decodeUnknown(Input)(input, { onExcessProperty: "error" }).pipe(
    Effect.mapError((error) => new DecodeError({ reason: ParseResult.TreeFormatter.formatIssueSync(error.issue) })),
    Effect.flatMap(prepare)
  )

/**
 * Supplies a width for each zero-based output line.
 *
 * @since 0.5.0
 * @category models
 */
export type LineWidthResolver = (lineIndex: number) => number

/**
 * Canonical cursor at the beginning of prepared text.
 *
 * @since 0.5.0
 * @category constants
 */
export const start: Cursor = Cursor.make({ segmentIndex: 0, graphemeIndex: 0 })

/**
 * Computes aggregate layout geometry without materializing line strings.
 *
 * @since 0.5.0
 * @category layout
 */
export const summary: {
  (self: Text, request: Request): Summary
  (request: Request): (self: Text) => Summary
} = Function.dual(2, (self: Text, request: Request): Summary => self.summary(request))

/**
 * Materializes every visual line at the request's uniform width.
 *
 * @since 0.5.0
 * @category layout
 */
export const lines: {
  (self: WithSegments, request: Request): Lines
  (request: Request): (self: WithSegments) => Lines
} = Function.dual(2, (self: WithSegments, request: Request): Lines => self.lines(request))

/**
 * Materializes visual lines using a width resolved for each output index.
 *
 * @since 0.5.0
 * @category layout
 */
export const linesWith: {
  (self: WithSegments, request: Request, resolveMaxWidth: LineWidthResolver): Lines
  (request: Request, resolveMaxWidth: LineWidthResolver): (self: WithSegments) => Lines
} = Function.dual(
  3,
  (self: WithSegments, request: Request, resolveMaxWidth: LineWidthResolver): Lines =>
    self.lines(request, resolveMaxWidth)
)

/**
 * Computes line widths and half-open logical bounds without line strings.
 *
 * @since 0.5.0
 * @category layout
 */
export const ranges: {
  (self: WithSegments, request: Request): LineRanges
  (self: WithSegments, request: Request, resolveMaxWidth: LineWidthResolver): LineRanges
  (request: Request): (self: WithSegments) => LineRanges
  (request: Request, resolveMaxWidth: LineWidthResolver): (self: WithSegments) => LineRanges
} = Function.dual(
  (arguments_) => {
    const values = Arr.fromIterable(arguments_)

    return Boolean.and(
      Predicate.isTupleOfAtLeast(values, 2),
      Arr.get(values, 1).pipe(Option.exists(Schema.is(Request)))
    )
  },
  (self: WithSegments, request: Request, resolveMaxWidth?: LineWidthResolver): LineRanges =>
    self.ranges(request, resolveMaxWidth)
)

/**
 * Returns the widest hard-break-delimited painted width before wrapping.
 *
 * @since 0.5.0
 * @category layout
 */
export const naturalWidth = (self: Text): number => self.naturalWidth()

/**
 * Materializes lines and summary geometry in one walk.
 *
 * @since 0.5.0
 * @category layout
 */
export const layout: {
  (self: WithSegments, request: Request): Layout
  (request: Request): (self: WithSegments) => Layout
} = Function.dual(
  2,
  (self: WithSegments, request: Request): Layout => self.layout(request)
)

/**
 * Materializes the line at a cursor and returns its successor cursor.
 *
 * @since 0.5.0
 * @category layout
 */
export const nextLine: {
  (self: WithSegments, request: Request, cursor: Cursor): Option.Option<LineStep>
  (request: Request, cursor: Cursor): (self: WithSegments) => Option.Option<LineStep>
} = Function.dual(
  3,
  (self: WithSegments, request: Request, cursor: Cursor): Option.Option<LineStep> => self.nextLine(request, cursor)
)

class StreamState extends Data.Class<{
  readonly cursor: Cursor
  readonly lineIndex: number
}> {}

/**
 * Lazily unfolds visual lines from `start` without further measurement.
 *
 * @since 0.5.0
 * @category layout
 */
export const stream: {
  (self: WithSegments, request: Request): Stream.Stream<Line>
  (request: Request): (self: WithSegments) => Stream.Stream<Line>
} = Function.dual(
  2,
  (self: WithSegments, request: Request): Stream.Stream<Line> => self.stream(request)
)

/**
 * Derives summary geometry from already materialized lines.
 *
 * @since 0.5.0
 * @category layout
 */
export const summaryFromLines: {
  (self: Lines, lineHeight: number): Summary
  (lineHeight: number): (self: Lines) => Summary
} = Function.dual(2, (self: Lines, lineHeight: number): Summary => ({
  lineCount: Arr.length(self),
  height: Number.multiply(Arr.length(self), lineHeight),
  maxLineWidth: Arr.reduce(self, 0, (maximum, line) => Number.max(maximum, line.width))
}))

/**
 * Unicode-aware default logical segmenter.
 *
 * @since 0.5.0
 * @category layers
 */
export const layerSegmenter = Layer.succeed(Segmenter, {
  segment: (text, whiteSpace) => Effect.succeed(segmentText(text, whiteSpace))
})

/**
 * Default deterministic text preparation profile.
 *
 * @since 0.5.0
 * @category layers
 */
export const layerProfile = Layer.succeed(CurrentProfile, {
  lineFitEpsilon: 0.005,
  tabWidth: 4,
  defaultDirection: "ltr",
  preferEarlySoftHyphenBreak: false,
  preferPrefixWidthsForBreakableRuns: true
})

/**
 * Default segmentation, profile, hyphenation, measurement, and cache services.
 *
 * @since 0.5.0
 * @category layers
 */
export const layer = Layer.mergeAll(
  layerSegmenter,
  layerProfile,
  Hyphenation.layer(),
  TextMeasurer.layer,
  MeasurementCache.layer.pipe(Layer.provide(TextMeasurer.layer))
)
