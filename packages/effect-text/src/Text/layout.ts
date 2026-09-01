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
 * Supplies available width for each zero-based projected line in traversal order.
 * Returned widths are used directly without schema decoding.
 *
 * @since 0.1.0
 * @category models
 */
export type LineWidthResolver = (lineIndex: number) => number

/**
 * Creates the first cursor for incremental line walking.
 *
 * @since 0.1.0
 * @category constructors
 */
export const initialCursor = (): LayoutCursorType => makeInitialCursor({ segmentIndex: 0, graphemeIndex: 0 })

/**
 * Materializes every line at `request.maxWidth` in visual text order.
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
 * Materializes lines in order using the width returned for each line index.
 *
 * @remarks
 * This keeps `prepare` effectful and `layout` pure while letting downstream
 * projections reuse the prepared handle for staged or obstacle-aware layout.
 *
 * Requires `PreparedTextWithSegments` because obstacle-aware materialization
 * still projects full visual line text.
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
 * Walks line geometry and logical cursor bounds without constructing visual
 * line strings.
 *
 * @remarks
 * Requires `PreparedTextWithSegments` because logical cursor bounds are walked
 * against retained logical-surface data.
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
 * Returns the widest natural hard-break-delimited line measured during
 * preparation, without applying a layout width.
 *
 * @since 0.2.0
 * @category layout
 */
export const measureNaturalWidth = (prepared: PreparedText): number =>
  measureNaturalWidthFromCore(preparedTextCore(prepared))

/**
 * Materializes lines and derives summary from one walk pass.
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
 * Computes line count, `lineCount * lineHeight`, and maximum painted width
 * without materializing line strings.
 *
 * @since 0.1.0
 * @category layout
 */
export const layout = (prepared: PreparedText, request: LayoutRequestType): LayoutSummaryType =>
  summarizeLines(preparedTextCore(prepared), request)

/**
 * Materializes the line beginning at `cursor` and returns its successor cursor,
 * or `Option.none` after the final line.
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
 * Lazily unfolds visually ordered lines from the initial cursor. The stream has
 * no failure or service channel because preparation is complete.
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
