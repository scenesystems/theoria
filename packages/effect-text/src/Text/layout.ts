/**
 * Pure layout projections over `PreparedText`.
 *
 * @since 0.1.0
 */
import { Option, Stream, Tuple } from "effect"

import { materializeLines } from "./internal/layout.js"
import { PreparedText } from "./model.js"
import type { LayoutCursorType, LayoutLineType, LayoutRequestType, LayoutSummaryType } from "./schema.js"

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
export const initialCursor = (): LayoutCursorType => ({ lineIndex: 0 })

/**
 * Materializes all lines for the supplied width.
 *
 * @since 0.1.0
 * @category layout
 */
export const layoutLines = (prepared: PreparedText, request: LayoutRequestType): ReadonlyArray<LayoutLineType> =>
  materializeLines(PreparedText.core(prepared), request)

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
): ReadonlyArray<LayoutLineType> => materializeLines(PreparedText.core(prepared), request, resolveMaxWidth)

/**
 * Computes line count and height without exposing line text.
 *
 * @since 0.1.0
 * @category layout
 */
export const layout = (prepared: PreparedText, request: LayoutRequestType): LayoutSummaryType => {
  const lines = layoutLines(prepared, request)
  const maxLineWidth = lines.reduce((maxWidth, line) => Math.max(maxWidth, line.width), 0)

  return {
    lineCount: lines.length,
    height: lines.length * request.lineHeight,
    maxLineWidth
  }
}

/**
 * Returns the next line for a cursor, if one exists.
 *
 * @since 0.1.0
 * @category layout
 */
export const layoutNextLine = (
  prepared: PreparedText,
  request: LayoutRequestType,
  cursor: LayoutCursorType
): Option.Option<readonly [LayoutLineType, LayoutCursorType]> =>
  Option.fromNullable(layoutLines(prepared, request)[cursor.lineIndex]).pipe(
    Option.map((line) => Tuple.make(line, { lineIndex: cursor.lineIndex + 1 }))
  )

/**
 * Streams laid out lines as a pure `Stream` projection.
 *
 * @since 0.1.0
 * @category layout
 */
export const streamLines = (prepared: PreparedText, request: LayoutRequestType): Stream.Stream<LayoutLineType> =>
  Stream.fromIterable(layoutLines(prepared, request))
