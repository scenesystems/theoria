/**
 * Internal pure layout helpers.
 *
 * @since 0.1.0
 */
import { Option } from "effect"

import type { PreparedSegmentType, PreparedTextCore } from "../model.js"
import type { LayoutLineType, LayoutRequestType } from "../schema.js"

type SoftBreakCandidate = readonly [prefixText: string, prefixWidth: number, breakText: string, breakWidth: number]

const emptyLines: ReadonlyArray<LayoutLineType> = []
const emptyPendingWhitespace: ReadonlyArray<PreparedSegmentType> = []
const emptySoftBreakCandidates: ReadonlyArray<SoftBreakCandidate> = []

const emptyState = {
  currentText: "",
  currentWidth: 0,
  lines: emptyLines,
  pendingWidth: 0,
  pendingWhitespace: emptyPendingWhitespace,
  softBreakCandidates: emptySoftBreakCandidates
}

type LayoutState = typeof emptyState

const appendLine = (state: LayoutState, text: string, width: number): LayoutState => ({
  currentText: "",
  currentWidth: 0,
  lines: [...state.lines, { index: state.lines.length, text, width }],
  pendingWidth: 0,
  pendingWhitespace: [],
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
  segment: PreparedSegmentType
): ReadonlyArray<SoftBreakCandidate> =>
  segment.breakOpportunity === "soft-hyphen"
    ? [...candidates, [text, width, segment.breakText, segment.breakWidth]]
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
    .map((candidate) => [candidate[0].slice(chosen[0].length), candidate[1] - chosen[1], candidate[2], candidate[3]])

const flushLine = (state: LayoutState, preservePending: boolean): LayoutState => {
  const trailingWhitespaceText = pendingText(state.pendingWhitespace)
  const leadingWhitespaceWidth = resolveWhitespaceWidth(state.pendingWhitespace, 0)

  if (state.currentText.length > 0) {
    return preservePending && state.pendingWhitespace.length > 0
      ? appendLine(state, state.currentText + trailingWhitespaceText, state.currentWidth + state.pendingWidth)
      : appendLine(state, state.currentText, state.currentWidth)
  }

  return preservePending && trailingWhitespaceText.length > 0
    ? appendLine(state, trailingWhitespaceText, leadingWhitespaceWidth)
    : appendLine(state, "", 0)
}

const startLineWithSegment = (
  state: LayoutState,
  text: string,
  width: number,
  segment: PreparedSegmentType
): LayoutState => ({
  ...state,
  currentText: text,
  currentWidth: width,
  pendingWidth: 0,
  pendingWhitespace: [],
  softBreakCandidates: appendSoftBreakCandidate([], text, width, segment)
})

export const materializeLines = (
  core: PreparedTextCore,
  request: LayoutRequestType,
  maxWidthAtLine: (lineIndex: number) => number = () => request.maxWidth
): ReadonlyArray<LayoutLineType> => {
  const finalState = core.segments.reduce((state, segment) => {
    const maxWidth = maxWidthAtLine(state.lines.length)

    if (segment.kind === "hard-break") {
      return flushLine(state, core.whiteSpace === "pre-wrap")
    }

    if (segment.kind === "space" || segment.kind === "tab") {
      return state.currentText.length === 0 && core.whiteSpace === "normal"
        ? state
        : {
          ...state,
          pendingWidth: state.pendingWidth +
            resolveSegmentAdvance(state.currentWidth + state.pendingWidth, segment),
          pendingWhitespace: [...state.pendingWhitespace, segment],
          softBreakCandidates: []
        }
    }

    const leadingWhitespaceText = core.whiteSpace === "pre-wrap" ? pendingText(state.pendingWhitespace) : ""
    const leadingWhitespaceWidth = core.whiteSpace === "pre-wrap"
      ? resolveWhitespaceWidth(state.pendingWhitespace, 0)
      : 0
    const candidateWidth = state.currentWidth + state.pendingWidth + segment.width

    if (state.currentText.length === 0) {
      return startLineWithSegment(
        state,
        leadingWhitespaceText + segment.text,
        leadingWhitespaceWidth + segment.width,
        segment
      )
    }

    if (candidateWidth <= maxWidth + core.lineFitEpsilon) {
      const nextText = state.currentText + pendingText(state.pendingWhitespace) + segment.text
      const nextWidth = candidateWidth

      return {
        ...state,
        currentText: nextText,
        currentWidth: nextWidth,
        pendingWidth: 0,
        pendingWhitespace: [],
        softBreakCandidates: appendSoftBreakCandidate(
          state.pendingWhitespace.length > 0 ? [] : state.softBreakCandidates,
          nextText,
          nextWidth,
          segment
        )
      }
    }

    if (state.pendingWhitespace.length > 0) {
      return startLineWithSegment(
        appendLine(state, state.currentText, state.currentWidth),
        leadingWhitespaceText + segment.text,
        leadingWhitespaceWidth + segment.width,
        segment
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
          appendLine(state, state.currentText, state.currentWidth),
          segment.text,
          segment.width,
          segment
        ),
      onSome: (softBreak) => {
        const remainderText = state.currentText.slice(softBreak[0].length)
        const remainderWidth = state.currentWidth - softBreak[1]
        const rebasedCandidates = rebaseSoftBreakCandidates(state.softBreakCandidates, softBreak)
        const nextText = remainderText + segment.text
        const nextWidth = remainderWidth + segment.width

        return {
          ...appendLine(state, softBreak[0] + softBreak[2], softBreak[1] + softBreak[3]),
          currentText: nextText,
          currentWidth: nextWidth,
          softBreakCandidates: appendSoftBreakCandidate(rebasedCandidates, nextText, nextWidth, segment)
        }
      }
    })
  }, emptyState)

  return finalState.currentText.length > 0 ||
      (core.whiteSpace === "pre-wrap" && finalState.pendingWhitespace.length > 0)
    ? flushLine(finalState, core.whiteSpace === "pre-wrap").lines
    : finalState.lines
}
