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
import { preparedTextCore } from "./model.js"
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
 * @since 0.1.0
 * @category layout
 */
export const layoutLines = (prepared: PreparedText, request: LayoutRequestType): ReadonlyArray<LayoutLineType> =>
  materializeLines(preparedTextCore(prepared), request)

/**
 * Materializes lines while allowing the caller to vary max width per line.
 *
 * This keeps `prepare` effectful and `layout` pure while letting downstream
 * projections reuse the prepared handle for staged or obstacle-aware layout.
 *
 * @since 0.1.0
 * @category layout
 */
export const layoutLinesWith = (
  prepared: PreparedText,
  request: LayoutRequestType,
  resolveMaxWidth: LineWidthResolver
): ReadonlyArray<LayoutLineType> => materializeLines(preparedTextCore(prepared), request, resolveMaxWidth)

/**
 * Walks laid out line ranges without materializing line text.
 *
 * @since 0.2.0
 * @category layout
 */
export const walkLineRanges = (
  prepared: PreparedText,
  request: LayoutRequestType,
  resolveMaxWidth: LineWidthResolver = () => request.maxWidth
): ReadonlyArray<LayoutLineRangeType> => walkLineRangesFromCore(preparedTextCore(prepared), request, resolveMaxWidth)

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
  materializeLineAtCursor(preparedTextCore(prepared), request, cursor).pipe(
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
  Stream.unfold(initialCursor(), (cursor) =>
    Option.map(
      layoutNextLine(prepared, request, cursor),
      ([line, nextCursor]): readonly [LayoutLineType, LayoutCursorType] => [line, nextCursor]
    ))
