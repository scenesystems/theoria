/**
 * Internal pure layout helpers.
 *
 * @since 0.1.0
 */
import { Option } from "effect"

import type { PreparedSegmentType, PreparedTextCore } from "../model.js"
import type { LayoutCursorType, LayoutLineRangeType, LayoutLineType, LayoutRequestType } from "../schema.js"

// Decomposition note: WP1 is temporarily keeping line materialization and source-position cursor plumbing together.
// Split plan: extract cursor-aware line records once the canonical walker replaces this transitional materialization path.

type SoftBreakCandidate = readonly [
  prefixText: string,
  prefixWidth: number,
  breakText: string,
  breakWidth: number,
  endSegmentIndex: number
]

type MaterializedLineRecord = LayoutLineType & LayoutLineRangeType

const emptyLines: ReadonlyArray<MaterializedLineRecord> = []
const emptyPendingWhitespace: ReadonlyArray<PreparedSegmentType> = []
const emptySoftBreakCandidates: ReadonlyArray<SoftBreakCandidate> = []

const emptyState = {
  currentText: "",
  currentWidth: 0,
  lines: emptyLines,
  lineStartSegmentIndex: 0,
  lineEndSegmentIndex: 0,
  pendingWidth: 0,
  pendingWhitespace: emptyPendingWhitespace,
  pendingStartSegmentIndex: Option.none<number>(),
  softBreakCandidates: emptySoftBreakCandidates
}

type LayoutState = typeof emptyState

const makeCursor = (segmentIndex: number): LayoutCursorType => ({ segmentIndex, graphemeIndex: 0 })

const appendLine = (
  state: LayoutState,
  text: string,
  width: number,
  endSegmentIndex: number,
  nextLineStartSegmentIndex: number
): LayoutState => ({
  currentText: "",
  currentWidth: 0,
  lines: [
    ...state.lines,
    {
      index: state.lines.length,
      text,
      width,
      start: makeCursor(state.lineStartSegmentIndex),
      end: makeCursor(endSegmentIndex)
    }
  ],
  lineStartSegmentIndex: nextLineStartSegmentIndex,
  lineEndSegmentIndex: nextLineStartSegmentIndex,
  pendingWidth: 0,
  pendingWhitespace: [],
  pendingStartSegmentIndex: Option.none(),
  softBreakCandidates: []
})

const pendingText = (pendingWhitespace: ReadonlyArray<PreparedSegmentType>): string =>
  pendingWhitespace.reduce((text, segment) => text + segment.text, "")

const resolveTabAdvance = (currentWidth: number, tabStopWidth: number): number => {
  if (tabStopWidth <= 0) {
    return 0
  }

  const remainder = currentWidth % tabStopWidth
  return remainder === 0 ? tabStopWidth : tabStopWidth - remainder
}

const resolveSegmentAdvance = (currentWidth: number, segment: PreparedSegmentType): number =>
  segment.kind === "tab" ? resolveTabAdvance(currentWidth, segment.width) : segment.width

const resolveWhitespaceWidth = (pendingWhitespace: ReadonlyArray<PreparedSegmentType>, startWidth: number): number =>
  pendingWhitespace.reduce(
    (width, segment) => width + resolveSegmentAdvance(startWidth + width, segment),
    0
  )

const appendSoftBreakCandidate = (
  candidates: ReadonlyArray<SoftBreakCandidate>,
  text: string,
  width: number,
  segment: PreparedSegmentType,
  endSegmentIndex: number
): ReadonlyArray<SoftBreakCandidate> =>
  segment.breakOpportunity === "soft-hyphen"
    ? [...candidates, [text, width, segment.breakText, segment.breakWidth, endSegmentIndex]]
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

const rebaseSoftBreakCandidates = (
  candidates: ReadonlyArray<SoftBreakCandidate>,
  chosen: SoftBreakCandidate
): ReadonlyArray<SoftBreakCandidate> =>
  candidates
    .filter((candidate) => candidate[1] > chosen[1])
    .map((
      candidate
    ) => [candidate[0].slice(chosen[0].length), candidate[1] - chosen[1], candidate[2], candidate[3], candidate[4]])

const flushLine = (
  state: LayoutState,
  preservePending: boolean,
  endSegmentIndex: number,
  nextLineStartSegmentIndex: number = endSegmentIndex
): LayoutState => {
  const trailingWhitespaceText = pendingText(state.pendingWhitespace)
  const leadingWhitespaceWidth = resolveWhitespaceWidth(state.pendingWhitespace, 0)

  if (state.currentText.length > 0) {
    return preservePending && state.pendingWhitespace.length > 0
      ? appendLine(
        state,
        state.currentText + trailingWhitespaceText,
        state.currentWidth + state.pendingWidth,
        endSegmentIndex,
        nextLineStartSegmentIndex
      )
      : appendLine(state, state.currentText, state.currentWidth, endSegmentIndex, nextLineStartSegmentIndex)
  }

  return preservePending && trailingWhitespaceText.length > 0
    ? appendLine(state, trailingWhitespaceText, leadingWhitespaceWidth, endSegmentIndex, nextLineStartSegmentIndex)
    : appendLine(state, "", 0, endSegmentIndex, nextLineStartSegmentIndex)
}

const startLineWithSegment = (
  state: LayoutState,
  text: string,
  width: number,
  segment: PreparedSegmentType,
  startSegmentIndex: number,
  endSegmentIndex: number
): LayoutState => ({
  ...state,
  currentText: text,
  currentWidth: width,
  lineStartSegmentIndex: startSegmentIndex,
  lineEndSegmentIndex: endSegmentIndex,
  pendingWidth: 0,
  pendingWhitespace: [],
  pendingStartSegmentIndex: Option.none(),
  softBreakCandidates: appendSoftBreakCandidate([], text, width, segment, endSegmentIndex)
})

const cursorEquals = (left: LayoutCursorType, right: LayoutCursorType): boolean =>
  left.segmentIndex === right.segmentIndex && left.graphemeIndex === right.graphemeIndex

const nextPendingStartIndex = (
  pendingStartSegmentIndex: Option.Option<number>,
  segmentIndex: number
): Option.Option<number> =>
  Option.match(pendingStartSegmentIndex, {
    onNone: () => Option.some(segmentIndex),
    onSome: () => pendingStartSegmentIndex
  })

const currentLineStartIndex = (
  pendingStartSegmentIndex: Option.Option<number>,
  segmentIndex: number
): number => Option.getOrElse(pendingStartSegmentIndex, () => segmentIndex)

const materializeLineRecords = (
  core: PreparedTextCore,
  request: LayoutRequestType,
  maxWidthAtLine: (lineIndex: number) => number = () => request.maxWidth
): ReadonlyArray<MaterializedLineRecord> => {
  const finalState = core.manualSurface.segments.reduce((state, segment, segmentIndex) => {
    const nextSegmentIndex = segmentIndex + 1
    const maxWidth = maxWidthAtLine(state.lines.length)

    if (segment.kind === "hard-break") {
      return flushLine(state, core.whiteSpace === "pre-wrap", nextSegmentIndex)
    }

    if (segment.kind === "space" || segment.kind === "tab") {
      return state.currentText.length === 0 && core.whiteSpace === "normal"
        ? {
          ...state,
          lineStartSegmentIndex: nextSegmentIndex,
          lineEndSegmentIndex: nextSegmentIndex
        }
        : {
          ...state,
          lineEndSegmentIndex: nextSegmentIndex,
          pendingWidth: state.pendingWidth +
            resolveSegmentAdvance(state.currentWidth + state.pendingWidth, segment),
          pendingWhitespace: [...state.pendingWhitespace, segment],
          pendingStartSegmentIndex: nextPendingStartIndex(state.pendingStartSegmentIndex, segmentIndex),
          softBreakCandidates: []
        }
    }

    const leadingWhitespaceText = core.whiteSpace === "pre-wrap" ? pendingText(state.pendingWhitespace) : ""
    const leadingWhitespaceWidth = core.whiteSpace === "pre-wrap"
      ? resolveWhitespaceWidth(state.pendingWhitespace, 0)
      : 0
    const candidateWidth = state.currentWidth + state.pendingWidth + segment.width

    if (state.currentText.length === 0) {
      const startSegmentIndex = core.whiteSpace === "pre-wrap"
        ? currentLineStartIndex(state.pendingStartSegmentIndex, segmentIndex)
        : segmentIndex

      return startLineWithSegment(
        state,
        leadingWhitespaceText + segment.text,
        leadingWhitespaceWidth + segment.width,
        segment,
        startSegmentIndex,
        nextSegmentIndex
      )
    }

    if (candidateWidth <= maxWidth + core.lineFitEpsilon) {
      const nextText = state.currentText + pendingText(state.pendingWhitespace) + segment.text
      const nextWidth = candidateWidth

      return {
        ...state,
        currentText: nextText,
        currentWidth: nextWidth,
        lineEndSegmentIndex: nextSegmentIndex,
        pendingWidth: 0,
        pendingWhitespace: [],
        pendingStartSegmentIndex: Option.none(),
        softBreakCandidates: appendSoftBreakCandidate(
          state.pendingWhitespace.length > 0 ? [] : state.softBreakCandidates,
          nextText,
          nextWidth,
          segment,
          nextSegmentIndex
        )
      }
    }

    if (state.pendingWhitespace.length > 0) {
      const nextLineStartSegmentIndex = core.whiteSpace === "pre-wrap"
        ? currentLineStartIndex(state.pendingStartSegmentIndex, segmentIndex)
        : segmentIndex

      return startLineWithSegment(
        flushLine(state, false, state.lineEndSegmentIndex, nextLineStartSegmentIndex),
        leadingWhitespaceText + segment.text,
        leadingWhitespaceWidth + segment.width,
        segment,
        nextLineStartSegmentIndex,
        nextSegmentIndex
      )
    }

    const chosenSoftBreak = chooseSoftBreakCandidate(
      state.softBreakCandidates,
      maxWidth,
      core.lineFitEpsilon,
      core.preferEarlySoftHyphenBreak
    )

    return Option.match(chosenSoftBreak, {
      onNone: () =>
        startLineWithSegment(
          flushLine(state, false, state.lineEndSegmentIndex, segmentIndex),
          segment.text,
          segment.width,
          segment,
          segmentIndex,
          nextSegmentIndex
        ),
      onSome: (softBreak) => {
        const remainderText = state.currentText.slice(softBreak[0].length)
        const remainderWidth = state.currentWidth - softBreak[1]
        const rebasedCandidates = rebaseSoftBreakCandidates(state.softBreakCandidates, softBreak)
        const nextText = remainderText + segment.text
        const nextWidth = remainderWidth + segment.width

        return {
          ...appendLine(state, softBreak[0] + softBreak[2], softBreak[1] + softBreak[3], softBreak[4], softBreak[4]),
          currentText: nextText,
          currentWidth: nextWidth,
          lineStartSegmentIndex: softBreak[4],
          lineEndSegmentIndex: nextSegmentIndex,
          softBreakCandidates: appendSoftBreakCandidate(
            rebasedCandidates,
            nextText,
            nextWidth,
            segment,
            nextSegmentIndex
          )
        }
      }
    })
  }, emptyState)

  return finalState.currentText.length > 0 ||
      (core.whiteSpace === "pre-wrap" && finalState.pendingWhitespace.length > 0)
    ? flushLine(finalState, core.whiteSpace === "pre-wrap", finalState.lineEndSegmentIndex).lines
    : finalState.lines
}

export const materializeLines = (
  core: PreparedTextCore,
  request: LayoutRequestType,
  maxWidthAtLine: (lineIndex: number) => number = () => request.maxWidth
): ReadonlyArray<LayoutLineType> =>
  materializeLineRecords(core, request, maxWidthAtLine).map(({ index, text, width }) => ({ index, text, width }))

export const materializeLineAtCursor = (
  core: PreparedTextCore,
  request: LayoutRequestType,
  cursor: LayoutCursorType
): Option.Option<readonly [LayoutLineType, LayoutCursorType]> =>
  Option.fromNullable(materializeLineRecords(core, request).find((line) => cursorEquals(line.start, cursor))).pipe(
    Option.map(
      (line): readonly [LayoutLineType, LayoutCursorType] => [
        { index: line.index, text: line.text, width: line.width },
        line.end
      ]
    )
  )
