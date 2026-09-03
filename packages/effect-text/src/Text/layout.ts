/**
 * Pure layout projections over `PreparedText`.
 *
 * @since 0.1.0
 */
import { Option, Stream, Tuple } from "effect"

import {
  makeInitialCursor,
  materializeLineAtCursor,
  materializeLines,
  materializeLinesWithSummary,
  measureNaturalWidth as measureNaturalWidthFromCore,
  summarizeLines,
  walkLineRanges as walkLineRangesFromCore
} from "./internal/layout.js"
import type { PreparedText, PreparedTextWithSegments } from "./model.js"
import { preparedTextCore, preparedTextWithSegmentsCore } from "./model.js"
import type {
  LayoutCursorType,
  LayoutLineRangeType,
  LayoutLineType,
  LayoutRequestType,
  LayoutSummaryType
} from "./schema.js"

/**
 * Supplies a positive finite width for each zero-based output line. Whole-layout
 * projections call the resolver once per emitted line in traversal order. The
 * returned value is used without Schema decoding.
 *
 * @since 0.1.0
 * @category models
 */
export type LineWidthResolver = (lineIndex: number) => number

/**
 * Creates the zero position accepted by `layoutNextLine`.
 *
 * @since 0.1.0
 * @category constructors
 */
export const initialCursor = (): LayoutCursorType => makeInitialCursor({ segmentIndex: 0, graphemeIndex: 0 })

/**
 * Materializes every line at `request.maxWidth` in output order, with each
 * line's text arranged in visual order.
 *
 * @remarks
 * Requires `PreparedTextWithSegments` because visual text materialization needs
 * retained logical-surface data in addition to the compiled summary kernel.
 *
 * @since 0.1.0
 * @category layout
 */
export const layoutLines = (
  prepared: PreparedTextWithSegments,
  request: LayoutRequestType
): ReadonlyArray<LayoutLineType> => materializeLines(preparedTextWithSegmentsCore(prepared), request)

/**
 * Materializes lines using the width returned for each zero-based line index.
 *
 * @remarks
 * The resolver runs synchronously once per emitted line. Its result is not
 * decoded; return a positive finite value in the measurement service's units.
 * The prepared measurements are reused.
 *
 * @since 0.1.0
 * @category layout
 */
export const layoutLinesWith = (
  prepared: PreparedTextWithSegments,
  request: LayoutRequestType,
  resolveMaxWidth: LineWidthResolver
): ReadonlyArray<LayoutLineType> => materializeLines(preparedTextWithSegmentsCore(prepared), request, resolveMaxWidth)

/**
 * Computes line widths and half-open logical cursor bounds without constructing
 * visual line strings.
 *
 * @remarks
 * Requires `PreparedTextWithSegments` because logical cursor bounds are walked
 * against retained logical-surface data. The width resolver follows the same
 * invocation and input contract as `layoutLinesWith`.
 *
 * @since 0.2.0
 * @category layout
 */
export const walkLineRanges = (
  prepared: PreparedTextWithSegments,
  request: LayoutRequestType,
  resolveMaxWidth: LineWidthResolver = () => request.maxWidth
): ReadonlyArray<LayoutLineRangeType> =>
  walkLineRangesFromCore(preparedTextWithSegmentsCore(prepared), request, resolveMaxWidth)

/**
 * Returns the painted width of the widest hard-break-delimited chunk without
 * applying wrapping or a layout width. Empty text returns zero.
 *
 * @since 0.2.0
 * @category layout
 */
export const measureNaturalWidth = (prepared: PreparedText): number =>
  measureNaturalWidthFromCore(preparedTextCore(prepared))

/**
 * Materializes visual lines and derives their aggregate geometry in one walk.
 *
 * @since 0.2.0
 * @category layout
 */
export const layoutLinesWithSummary = (
  prepared: PreparedTextWithSegments,
  request: LayoutRequestType
): { readonly summary: LayoutSummaryType; readonly lines: ReadonlyArray<LayoutLineType> } =>
  materializeLinesWithSummary(preparedTextWithSegmentsCore(prepared), request)

/**
 * Computes line count, `lineCount * lineHeight`, and maximum painted width from
 * the summary-only prepared kernel. Empty text yields zero for all fields.
 *
 * @since 0.1.0
 * @category layout
 */
export const layout = (prepared: PreparedText, request: LayoutRequestType): LayoutSummaryType =>
  summarizeLines(preparedTextCore(prepared), request)

/**
 * Materializes the line beginning at `cursor` and pairs it with the next logical
 * cursor. The terminal cursor and positions beyond the prepared text return
 * `Option.none`.
 *
 * @remarks
 * Cursors should originate from `initialCursor` or an earlier call for the same
 * prepared handle. Reusing a cursor with a different width recomputes its output
 * line index.
 *
 * @since 0.1.0
 * @category layout
 */
export const layoutNextLine = (
  prepared: PreparedTextWithSegments,
  request: LayoutRequestType,
  cursor: LayoutCursorType
): Option.Option<readonly [LayoutLineType, LayoutCursorType]> =>
  materializeLineAtCursor(prepared, request, cursor).pipe(
    Option.map(([line, nextCursor]) => Tuple.make(line, nextCursor))
  )

/**
 * Lazily unfolds visual lines from the initial cursor. Each run starts at the
 * first line. Pulling stops computation at the requested prefix, and the stream
 * has no failure or service channel after preparation succeeds.
 *
 * @since 0.1.0
 * @category layout
 */
export const streamLines = (
  prepared: PreparedTextWithSegments,
  request: LayoutRequestType
): Stream.Stream<LayoutLineType> =>
  Stream.unfold({ cursor: initialCursor(), lineIndex: 0 }, (state) =>
    Option.map(
      materializeLineAtCursor(prepared, request, state.cursor, state.lineIndex),
      (
        [line, nextCursor]
      ): readonly [LayoutLineType, { readonly cursor: LayoutCursorType; readonly lineIndex: number }] => [
        line,
        {
          cursor: nextCursor,
          lineIndex: state.lineIndex + 1
        }
      ]
    ))
