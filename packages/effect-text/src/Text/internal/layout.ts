/**
 * Internal pure layout helpers.
 *
 * @since 0.1.0
 */
import { Option } from "effect"

import type { PreparedBreakKindType, PreparedTextCore } from "../model.js"
import type {
  LayoutCursorType,
  LayoutLineRangeType,
  LayoutLineType,
  LayoutRequestType,
  LayoutSummaryType
} from "../schema.js"

// Decomposition note: WP1 keeps the cursor walker, summary projection, and materialization bridge together
// while the canonical kernel settles. Split plan: extract walker records and text materialization once WP2-WP4
// extend the same runtime tables for grapheme fallback, bidi ordering, and browser-fit heuristics.

type SoftBreakCandidate = readonly [
  end: LayoutCursorType,
  fitWidth: number,
  paintWidth: number,
  breakWidth: number
]

type WalkedLineRecord = LayoutLineRangeType & {
  readonly breakText: string
  readonly nextCursor: LayoutCursorType
}

const emptySoftBreakCandidates: ReadonlyArray<SoftBreakCandidate> = []
const cursorLineIndexSymbol = Symbol.for("effect-text/LayoutCursorLineIndex")

const cursorAt = (segmentIndex: number, graphemeIndex: number = 0): LayoutCursorType => ({
  segmentIndex,
  graphemeIndex
})

const zeroCursor = cursorAt(0)

const emptyState = {
  end: zeroCursor,
  fitWidth: 0,
  paintWidth: 0,
  pendingEnd: zeroCursor,
  pendingFitWidth: 0,
  pendingPaintWidth: 0,
  pendingStart: Option.none<LayoutCursorType>(),
  start: zeroCursor,
  softBreakCandidates: emptySoftBreakCandidates
}

type LineScanState = typeof emptyState

const rememberCursorLineIndex = (cursor: LayoutCursorType, lineIndex: number): LayoutCursorType => {
  Object.defineProperty(cursor, cursorLineIndexSymbol, {
    configurable: true,
    enumerable: false,
    value: lineIndex,
    writable: false
  })

  return cursor
}

const rememberedCursorLineIndex = (cursor: LayoutCursorType): Option.Option<number> =>
  Option.fromNullable(Object.getOwnPropertyDescriptor(cursor, cursorLineIndexSymbol)).pipe(
    Option.flatMap((descriptor) => typeof descriptor.value === "number" ? Option.some(descriptor.value) : Option.none())
  )

const cursorEquals = (left: LayoutCursorType, right: LayoutCursorType): boolean =>
  left.segmentIndex === right.segmentIndex && left.graphemeIndex === right.graphemeIndex

const endCursorFor = (core: PreparedTextCore): LayoutCursorType => cursorAt(core.manualSurface.segments.length)

const resolveTabAdvance = (currentWidth: number, tabStopWidth: number): number => {
  if (tabStopWidth <= 0) {
    return 0
  }

  const remainder = currentWidth % tabStopWidth
  return remainder === 0 ? tabStopWidth : tabStopWidth - remainder
}

const segmentAt = (core: PreparedTextCore, segmentIndex: number) => core.manualSurface.segments[segmentIndex]

const breakKindAt = (core: PreparedTextCore, segmentIndex: number): PreparedBreakKindType =>
  core.runtime.breakKinds[segmentIndex] ?? "text"

const textGraphemeCountAt = (core: PreparedTextCore, segmentIndex: number): number =>
  segmentAt(core, segmentIndex)?.kind === "text"
    ? Math.max(segmentAt(core, segmentIndex)?.graphemes.length ?? 0, 1)
    : 1

const advanceCursor = (core: PreparedTextCore, cursor: LayoutCursorType): LayoutCursorType =>
  segmentAt(core, cursor.segmentIndex)?.kind === "text" &&
    cursor.graphemeIndex + 1 < textGraphemeCountAt(core, cursor.segmentIndex)
    ? cursorAt(cursor.segmentIndex, cursor.graphemeIndex + 1)
    : cursorAt(cursor.segmentIndex + 1)

const breakKindAtCursor = (core: PreparedTextCore, cursor: LayoutCursorType): PreparedBreakKindType =>
  segmentAt(core, cursor.segmentIndex)?.kind === "text" &&
    cursor.graphemeIndex < textGraphemeCountAt(core, cursor.segmentIndex) - 1
    ? "text"
    : breakKindAt(core, cursor.segmentIndex)

const resolveFitAdvance = (core: PreparedTextCore, segmentIndex: number, currentFitWidth: number): number =>
  breakKindAt(core, segmentIndex) === "tab"
    ? resolveTabAdvance(currentFitWidth, core.runtime.tabStopAdvance)
    : core.runtime.fitAdvances[segmentIndex] ?? 0

const resolvePaintAdvance = (core: PreparedTextCore, segmentIndex: number, currentPaintWidth: number): number =>
  breakKindAt(core, segmentIndex) === "tab"
    ? resolveTabAdvance(currentPaintWidth, core.runtime.tabStopAdvance)
    : core.runtime.paintAdvances[segmentIndex] ?? 0

const resolveFitAdvanceAtCursor = (
  core: PreparedTextCore,
  cursor: LayoutCursorType,
  currentFitWidth: number
): number =>
  breakKindAtCursor(core, cursor) === "tab"
    ? resolveTabAdvance(currentFitWidth, core.runtime.tabStopAdvance)
    : segmentAt(core, cursor.segmentIndex)?.kind === "text"
    ? core.runtime.breakableGraphemeWidths[cursor.segmentIndex]?.[cursor.graphemeIndex] ??
      core.runtime.fitAdvances[cursor.segmentIndex] ?? 0
    : core.runtime.fitAdvances[cursor.segmentIndex] ?? 0

const resolvePaintAdvanceAtCursor = (
  core: PreparedTextCore,
  cursor: LayoutCursorType,
  currentPaintWidth: number
): number =>
  breakKindAtCursor(core, cursor) === "tab"
    ? resolveTabAdvance(currentPaintWidth, core.runtime.tabStopAdvance)
    : segmentAt(core, cursor.segmentIndex)?.kind === "text"
    ? core.runtime.breakableGraphemeWidths[cursor.segmentIndex]?.[cursor.graphemeIndex] ??
      core.runtime.paintAdvances[cursor.segmentIndex] ?? 0
    : core.runtime.paintAdvances[cursor.segmentIndex] ?? 0

const appendSoftBreakCandidate = (
  candidates: ReadonlyArray<SoftBreakCandidate>,
  core: PreparedTextCore,
  cursor: LayoutCursorType,
  end: LayoutCursorType,
  fitWidth: number,
  paintWidth: number
): ReadonlyArray<SoftBreakCandidate> =>
  breakKindAtCursor(core, cursor) === "soft-hyphen"
    ? [...candidates, [end, fitWidth, paintWidth, core.runtime.discretionaryHyphenWidth]]
    : candidates

const chooseSoftBreakCandidate = (
  candidates: ReadonlyArray<SoftBreakCandidate>,
  maxWidth: number,
  lineFitEpsilon: number,
  preferEarlySoftHyphenBreak: boolean
): Option.Option<SoftBreakCandidate> => {
  const fittingCandidates = candidates.filter(
    (candidate) => candidate[1] + candidate[3] <= maxWidth + lineFitEpsilon
  )

  return Option.fromNullable(
    preferEarlySoftHyphenBreak ? fittingCandidates[0] : fittingCandidates[fittingCandidates.length - 1]
  )
}

const lineHasCommittedContent = (state: LineScanState): boolean =>
  state.paintWidth > 0 || !cursorEquals(state.start, state.end)

const hasPendingWhitespace = (state: LineScanState): boolean => Option.isSome(state.pendingStart)

const initialLineScanState = (cursor: LayoutCursorType): LineScanState => ({
  ...emptyState,
  end: cursor,
  pendingEnd: cursor,
  start: cursor
})

const emitLineRecord = (
  start: LayoutCursorType,
  end: LayoutCursorType,
  nextCursor: LayoutCursorType,
  width: number,
  breakText: string = ""
): WalkedLineRecord => ({
  breakText,
  end,
  nextCursor,
  start,
  width
})

const finalizeAtEnd = (core: PreparedTextCore, state: LineScanState): Option.Option<WalkedLineRecord> => {
  const preservePending = core.whiteSpace === "pre-wrap" && hasPendingWhitespace(state)

  if (lineHasCommittedContent(state)) {
    return Option.some(
      emitLineRecord(
        state.start,
        preservePending ? state.pendingEnd : state.end,
        endCursorFor(core),
        state.paintWidth + (preservePending ? state.pendingPaintWidth : 0)
      )
    )
  }

  return preservePending
    ? Option.some(emitLineRecord(state.start, state.pendingEnd, endCursorFor(core), state.pendingPaintWidth))
    : Option.none()
}

const finalizeAtHardBreak = (
  core: PreparedTextCore,
  state: LineScanState,
  nextCursor: LayoutCursorType
): WalkedLineRecord => {
  const preservePending = core.whiteSpace === "pre-wrap" && hasPendingWhitespace(state)

  if (lineHasCommittedContent(state)) {
    return emitLineRecord(
      state.start,
      preservePending ? state.pendingEnd : state.end,
      nextCursor,
      state.paintWidth + (preservePending ? state.pendingPaintWidth : 0)
    )
  }

  return preservePending
    ? emitLineRecord(state.start, state.pendingEnd, nextCursor, state.pendingPaintWidth)
    : emitLineRecord(state.start, state.start, nextCursor, 0)
}

const finalizeBeforeCurrent = (
  state: LineScanState,
  nextCursor: LayoutCursorType
): WalkedLineRecord => emitLineRecord(state.start, state.end, nextCursor, state.paintWidth)

const finalizeBeforePending = (
  core: PreparedTextCore,
  state: LineScanState,
  currentCursor: LayoutCursorType
): WalkedLineRecord =>
  emitLineRecord(
    state.start,
    state.end,
    Option.match(state.pendingStart, {
      onNone: () => currentCursor,
      onSome: (pendingStart) => (core.whiteSpace === "pre-wrap" ? pendingStart : currentCursor)
    }),
    state.paintWidth
  )

const finalizeSoftBreak = (state: LineScanState, candidate: SoftBreakCandidate): WalkedLineRecord =>
  emitLineRecord(
    state.start,
    candidate[0],
    candidate[0],
    candidate[2] + candidate[3],
    "-"
  )

const appendPendingWhitespace = (
  core: PreparedTextCore,
  state: LineScanState,
  currentCursor: LayoutCursorType,
  nextCursor: LayoutCursorType
): LineScanState => {
  const fitAdvance = resolveFitAdvanceAtCursor(core, currentCursor, state.fitWidth + state.pendingFitWidth)
  const paintAdvance = resolvePaintAdvanceAtCursor(core, currentCursor, state.paintWidth + state.pendingPaintWidth)

  return {
    ...state,
    pendingEnd: nextCursor,
    pendingFitWidth: state.pendingFitWidth + fitAdvance,
    pendingPaintWidth: state.pendingPaintWidth + paintAdvance,
    pendingStart: Option.match(state.pendingStart, {
      onNone: () => Option.some(currentCursor),
      onSome: () => state.pendingStart
    }),
    softBreakCandidates: []
  }
}

const startLineWithSegment = (
  core: PreparedTextCore,
  state: LineScanState,
  currentCursor: LayoutCursorType,
  nextCursor: LayoutCursorType
): LineScanState => {
  const leadingFitWidth = core.whiteSpace === "pre-wrap" ? state.pendingFitWidth : 0
  const leadingPaintWidth = core.whiteSpace === "pre-wrap" ? state.pendingPaintWidth : 0
  const fitWidth = leadingFitWidth + resolveFitAdvanceAtCursor(core, currentCursor, leadingFitWidth)
  const paintWidth = leadingPaintWidth + resolvePaintAdvanceAtCursor(core, currentCursor, leadingPaintWidth)

  return {
    ...state,
    end: nextCursor,
    fitWidth,
    paintWidth,
    pendingEnd: nextCursor,
    pendingFitWidth: 0,
    pendingPaintWidth: 0,
    pendingStart: Option.none(),
    softBreakCandidates: appendSoftBreakCandidate([], core, currentCursor, nextCursor, fitWidth, paintWidth)
  }
}

const appendCommittedSegment = (
  core: PreparedTextCore,
  state: LineScanState,
  currentCursor: LayoutCursorType,
  nextCursor: LayoutCursorType
): LineScanState => {
  const fitWidth = state.fitWidth + state.pendingFitWidth +
    resolveFitAdvanceAtCursor(core, currentCursor, state.fitWidth + state.pendingFitWidth)
  const paintWidth = state.paintWidth + state.pendingPaintWidth +
    resolvePaintAdvanceAtCursor(core, currentCursor, state.paintWidth + state.pendingPaintWidth)

  return {
    ...state,
    end: nextCursor,
    fitWidth,
    paintWidth,
    pendingEnd: nextCursor,
    pendingFitWidth: 0,
    pendingPaintWidth: 0,
    pendingStart: Option.none(),
    softBreakCandidates: appendSoftBreakCandidate(
      hasPendingWhitespace(state) ? [] : state.softBreakCandidates,
      core,
      currentCursor,
      nextCursor,
      fitWidth,
      paintWidth
    )
  }
}

const chunkIndexForCursor = (
  core: PreparedTextCore,
  cursor: LayoutCursorType,
  chunkIndex: number = 0
): number => {
  const chunkCount = core.runtime.chunkStartIndices.length

  if (chunkCount <= 1 || chunkIndex >= chunkCount - 1) {
    return chunkCount === 0 ? 0 : chunkCount - 1
  }

  return cursor.segmentIndex < (core.runtime.chunkConsumedEndIndices[chunkIndex] ?? core.manualSurface.segments.length)
    ? chunkIndex
    : chunkIndexForCursor(core, cursor, chunkIndex + 1)
}

const chunkConsumedEndForCursor = (core: PreparedTextCore, cursor: LayoutCursorType): number =>
  core.runtime.chunkConsumedEndIndices[chunkIndexForCursor(core, cursor)] ?? core.manualSurface.segments.length

const walkNextLineRecord = (
  core: PreparedTextCore,
  maxWidth: number,
  cursor: LayoutCursorType
): Option.Option<WalkedLineRecord> => {
  const scan = (
    currentCursor: LayoutCursorType,
    segmentLimit: number,
    state: LineScanState
  ): Option.Option<WalkedLineRecord> => {
    if (
      currentCursor.segmentIndex >= core.manualSurface.segments.length || currentCursor.segmentIndex >= segmentLimit
    ) {
      return finalizeAtEnd(core, state)
    }

    const breakKind = breakKindAtCursor(core, currentCursor)
    const nextCursor = advanceCursor(core, currentCursor)

    if (breakKind === "hard-break") {
      return Option.some(finalizeAtHardBreak(core, state, nextCursor))
    }

    if (
      breakKind === "space" ||
      breakKind === "preserved-space" ||
      breakKind === "tab" ||
      breakKind === "zero-width-break"
    ) {
      return !lineHasCommittedContent(state) && core.whiteSpace === "normal"
        ? scan(nextCursor, segmentLimit, {
          ...state,
          end: nextCursor,
          pendingEnd: nextCursor,
          start: nextCursor
        })
        : scan(
          nextCursor,
          segmentLimit,
          appendPendingWhitespace(core, state, currentCursor, nextCursor)
        )
    }

    if (!lineHasCommittedContent(state)) {
      return scan(nextCursor, segmentLimit, startLineWithSegment(core, state, currentCursor, nextCursor))
    }

    const candidateFitWidth = state.fitWidth + state.pendingFitWidth +
      resolveFitAdvanceAtCursor(core, currentCursor, state.fitWidth + state.pendingFitWidth)

    if (candidateFitWidth <= maxWidth + core.lineFitEpsilon) {
      return scan(nextCursor, segmentLimit, appendCommittedSegment(core, state, currentCursor, nextCursor))
    }

    if (hasPendingWhitespace(state)) {
      return Option.some(finalizeBeforePending(core, state, currentCursor))
    }

    return Option.match(
      chooseSoftBreakCandidate(
        state.softBreakCandidates,
        maxWidth,
        core.lineFitEpsilon,
        core.preferEarlySoftHyphenBreak
      ),
      {
        onNone: () => Option.some(finalizeBeforeCurrent(state, currentCursor)),
        onSome: (softBreak) => Option.some(finalizeSoftBreak(state, softBreak))
      }
    )
  }

  return cursor.segmentIndex >= core.manualSurface.segments.length
    ? Option.none()
    : scan(cursor, chunkConsumedEndForCursor(core, cursor), initialLineScanState(cursor))
}

const walkLineRecordArray = (
  core: PreparedTextCore,
  maxWidthAtLine: (lineIndex: number) => number,
  lineIndex: number = 0,
  cursor: LayoutCursorType = cursorAt(0)
): ReadonlyArray<WalkedLineRecord> =>
  Option.match(walkNextLineRecord(core, maxWidthAtLine(lineIndex), cursor), {
    onNone: () => [],
    onSome: (record) => [record, ...walkLineRecordArray(core, maxWidthAtLine, lineIndex + 1, record.nextCursor)]
  })

const materializeSegmentText = (core: PreparedTextCore, segmentIndex: number): string => {
  const segment = segmentAt(core, segmentIndex)

  return Option.fromNullable(segment).pipe(
    Option.match({
      onNone: () => "",
      onSome: (value) => value.kind === "text" ? value.graphemes.join("") : value.text
    })
  )
}

const materializeTextSlice = (
  core: PreparedTextCore,
  segmentIndex: number,
  startGraphemeIndex: number,
  endGraphemeIndex: number
): string => {
  const segment = segmentAt(core, segmentIndex)

  return Option.fromNullable(segment).pipe(
    Option.match({
      onNone: () => "",
      onSome: (value) =>
        value.kind === "text"
          ? value.graphemes.slice(startGraphemeIndex, endGraphemeIndex).join("")
          : value.text
    })
  )
}

const materializeRangeText = (
  core: PreparedTextCore,
  start: LayoutCursorType,
  end: LayoutCursorType
): string => {
  if (cursorEquals(start, end)) {
    return ""
  }

  if (start.segmentIndex === end.segmentIndex) {
    return materializeTextSlice(core, start.segmentIndex, start.graphemeIndex, end.graphemeIndex)
  }

  const leadingText = materializeTextSlice(
    core,
    start.segmentIndex,
    start.graphemeIndex,
    textGraphemeCountAt(core, start.segmentIndex)
  )
  const middleText = core.manualSurface.segments
    .slice(start.segmentIndex + 1, end.segmentIndex)
    .map((_, index) => materializeSegmentText(core, start.segmentIndex + 1 + index))
    .join("")
  const trailingText = end.graphemeIndex === 0 ? "" : materializeTextSlice(core, end.segmentIndex, 0, end.graphemeIndex)

  return leadingText + middleText + trailingText
}

const materializeLine = (
  core: PreparedTextCore,
  lineIndex: number,
  record: WalkedLineRecord
): LayoutLineType => ({
  index: lineIndex,
  text: materializeRangeText(core, record.start, record.end) + record.breakText,
  width: record.width
})

const measureChunkWidth = (
  core: PreparedTextCore,
  segmentIndex: number,
  segmentLimit: number,
  fitWidth: number = 0,
  paintWidth: number = 0
): number => {
  if (segmentIndex >= core.manualSurface.segments.length || segmentIndex >= segmentLimit) {
    return paintWidth
  }

  return breakKindAt(core, segmentIndex) === "hard-break"
    ? paintWidth
    : measureChunkWidth(
      core,
      segmentIndex + 1,
      segmentLimit,
      fitWidth + resolveFitAdvance(core, segmentIndex, fitWidth),
      paintWidth + resolvePaintAdvance(core, segmentIndex, paintWidth)
    )
}

const measureNaturalWidthFromChunk = (
  core: PreparedTextCore,
  chunkIndex: number = 0,
  maxWidth: number = 0
): number => {
  if (chunkIndex >= core.runtime.chunkStartIndices.length) {
    return maxWidth
  }

  const startSegmentIndex = core.runtime.chunkStartIndices[chunkIndex] ?? core.manualSurface.segments.length
  const consumedEndIndex = core.runtime.chunkConsumedEndIndices[chunkIndex] ?? core.manualSurface.segments.length
  const chunkWidth = measureChunkWidth(core, startSegmentIndex, consumedEndIndex)

  return measureNaturalWidthFromChunk(core, chunkIndex + 1, Math.max(maxWidth, chunkWidth))
}

export const summarizeLines = (core: PreparedTextCore, request: LayoutRequestType): LayoutSummaryType => {
  const summarizeFromCursor = (
    cursor: LayoutCursorType,
    lineCount: number,
    maxLineWidth: number
  ): LayoutSummaryType =>
    Option.match(walkNextLineRecord(core, request.maxWidth, cursor), {
      onNone: () => ({
        height: lineCount * request.lineHeight,
        lineCount,
        maxLineWidth
      }),
      onSome: (record) => summarizeFromCursor(record.nextCursor, lineCount + 1, Math.max(maxLineWidth, record.width))
    })

  return summarizeFromCursor(cursorAt(0), 0, 0)
}

export const makeInitialCursor = (cursor: LayoutCursorType): LayoutCursorType => rememberCursorLineIndex(cursor, 0)

const countLinesBeforeCursor = (
  core: PreparedTextCore,
  request: LayoutRequestType,
  targetCursor: LayoutCursorType,
  cursor: LayoutCursorType = cursorAt(0),
  lineCount: number = 0
): number =>
  cursorEquals(cursor, targetCursor)
    ? lineCount
    : Option.match(walkNextLineRecord(core, request.maxWidth, cursor), {
      onNone: () => lineCount,
      onSome: (record) => countLinesBeforeCursor(core, request, targetCursor, record.nextCursor, lineCount + 1)
    })

export const materializeLines = (
  core: PreparedTextCore,
  request: LayoutRequestType,
  maxWidthAtLine: (lineIndex: number) => number = () => request.maxWidth
): ReadonlyArray<LayoutLineType> =>
  walkLineRecordArray(core, maxWidthAtLine).map((record, lineIndex) => materializeLine(core, lineIndex, record))

export const materializeLineAtCursor = (
  core: PreparedTextCore,
  request: LayoutRequestType,
  cursor: LayoutCursorType
): Option.Option<readonly [LayoutLineType, LayoutCursorType]> =>
  walkNextLineRecord(core, request.maxWidth, cursor).pipe(
    Option.map(
      (record): readonly [LayoutLineType, LayoutCursorType] => {
        const lineIndex = Option.getOrElse(
          rememberedCursorLineIndex(cursor),
          () => countLinesBeforeCursor(core, request, cursor)
        )

        return [
          materializeLine(core, lineIndex, record),
          rememberCursorLineIndex(record.nextCursor, lineIndex + 1)
        ]
      }
    )
  )

export const walkLineRanges = (
  core: PreparedTextCore,
  request: LayoutRequestType,
  maxWidthAtLine: (lineIndex: number) => number = () => request.maxWidth
): ReadonlyArray<LayoutLineRangeType> =>
  walkLineRecordArray(core, maxWidthAtLine).map(({ end, start, width }) => ({ end, start, width }))

export const measureNaturalWidth = (core: PreparedTextCore): number => measureNaturalWidthFromChunk(core)
