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
 * Resolves the maximum width available for a projected line index.
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
 * Materializes all lines for the supplied width.
 *
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
 * Materializes lines while allowing the caller to vary max width per line.
 *
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
 * Walks laid out line ranges without materializing line text.
 *
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
 * Measures the widest forced line produced by hard breaks in the prepared handle.
 *
 * @since 0.2.0
 * @category layout
 */
export const measureNaturalWidth = (prepared: PreparedText): number =>
  measureNaturalWidthFromCore(preparedTextCore(prepared))

/**
 * Computes line count and height without exposing line text.
 *
 * @since 0.1.0
 * @category layout
 */
export const layout = (prepared: PreparedText, request: LayoutRequestType): LayoutSummaryType =>
  summarizeLines(preparedTextCore(prepared), request)

/**
 * Returns the next line for a cursor, if one exists.
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
 * Streams laid out lines as a pure `Stream` projection.
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
