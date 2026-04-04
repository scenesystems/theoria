/**
 * Internal pure layout helpers.
 *
 * @since 0.1.0
 */
import { Data, Match, Option } from "effect"
import * as Arr from "effect/Array"
import * as HashMap from "effect/HashMap"
import * as Iterable from "effect/Iterable"
import * as MutableRef from "effect/MutableRef"

import type {
  PreparedBreakKindType,
  PreparedTextCore,
  PreparedTextWithSegments,
  PreparedTextWithSegmentsCore
} from "../model.js"
import { preparedTextWithSegmentsCore, preparedTextWithSegmentsCursorHints } from "../model.js"
import type {
  LayoutCursorType,
  LayoutLineRangeType,
  LayoutLineType,
  LayoutRequestType,
  LayoutSummaryType
} from "../schema.js"
import { projectVisualText, type VisualOrderUnit } from "./bidi.js"

type BreakCandidate = Readonly<{
  kind: "dictionary-hyphen" | "explicit" | "soft-hyphen"
  end: LayoutCursorType
  nextCursor: LayoutCursorType
  fitWidth: number
  insertedText: string
  insertedWidth: number
  paintWidth: number
}>

type InternalLineRecord = Readonly<{
  baseDirection: LayoutLineRangeType["baseDirection"]
  end: LayoutCursorType
  fitWidth: number
  insertedBreakText: string
  nextCursor: LayoutCursorType
  order: LayoutLineRangeType["order"]
  paintWidth: number
  start: LayoutCursorType
  width: number
}>

type LineScanState = Readonly<{
  breakCandidates: ReadonlyArray<BreakCandidate>
  end: LayoutCursorType
  fitWidth: number
  paintWidth: number
  pendingEnd: LayoutCursorType
  pendingFitWidth: number
  pendingPaintWidth: number
  pendingStart: LayoutCursorType | null
  start: LayoutCursorType
}>

type LineWalkFrame = Readonly<{
  cursor: LayoutCursorType
  maxWidth: number
  record: InternalLineRecord | null
  scan: LineScanState
  segmentLimit: number
}>

type VisualUnitCursorState = Readonly<{
  cursor: LayoutCursorType
  logicalIndex: number
}>

type CursorHintKey = readonly [number, number, number]

const unfoldStep = <A, B>(value: A, state: B): readonly [A, B] => [value, state]

const cursorHintKey = (maxWidth: number, cursor: LayoutCursorType): CursorHintKey =>
  Data.tuple(maxWidth, cursor.segmentIndex, cursor.graphemeIndex)

const cursorAt = (segmentIndex: number, graphemeIndex: number = 0): LayoutCursorType => ({
  segmentIndex,
  graphemeIndex
})

const zeroCursor = cursorAt(0)

const emptyState: LineScanState = {
  breakCandidates: [],
  end: zeroCursor,
  fitWidth: 0,
  paintWidth: 0,
  pendingEnd: zeroCursor,
  pendingFitWidth: 0,
  pendingPaintWidth: 0,
  pendingStart: null,
  start: zeroCursor
}

const segmentCount = (core: PreparedTextCore): number => core.kernel.runtime.breakKinds.length

const cursorEquals = (left: LayoutCursorType, right: LayoutCursorType): boolean =>
  left.segmentIndex === right.segmentIndex && left.graphemeIndex === right.graphemeIndex

const endCursorFor = (core: PreparedTextCore): LayoutCursorType => cursorAt(segmentCount(core))

const resolveTabAdvance = (currentWidth: number, tabStopAdvance: number): number => {
  if (tabStopAdvance <= 0) {
    return 0
  }

  const remainder = currentWidth % tabStopAdvance
  return remainder === 0 ? tabStopAdvance : tabStopAdvance - remainder
}

const segmentAt = (
  core: PreparedTextWithSegmentsCore,
  segmentIndex: number
) => core.logicalSurface.segments[segmentIndex] ?? null

const breakKindAt = (core: PreparedTextCore, segmentIndex: number): PreparedBreakKindType =>
  core.kernel.runtime.breakKinds[segmentIndex] ?? "text"

const breakableGraphemeWidthsAt = (core: PreparedTextCore, segmentIndex: number): ReadonlyArray<number> =>
  core.kernel.runtime.breakableGraphemeWidths[segmentIndex] ?? []

const breakablePrefixWidthsAt = (core: PreparedTextCore, segmentIndex: number): ReadonlyArray<number> =>
  core.kernel.runtime.breakablePrefixWidths[segmentIndex] ?? []

const graphemeBidiLevelsAt = (core: PreparedTextCore, segmentIndex: number): ReadonlyArray<number> =>
  core.kernel.runtime.graphemeBidiLevels[segmentIndex] ?? []

const mirroredGraphemesAt = (core: PreparedTextCore, segmentIndex: number): ReadonlyArray<string> =>
  core.kernel.runtime.mirroredGraphemes[segmentIndex] ?? []

const advanceFromPrefixWidths = (
  prefixWidths: ReadonlyArray<number>,
  graphemeIndex: number,
  fallback: number
): number =>
  graphemeIndex === 0
    ? prefixWidths[0] ?? fallback
    : (prefixWidths[graphemeIndex] ?? fallback) - (prefixWidths[graphemeIndex - 1] ?? 0)

const textGraphemeCountAt = (core: PreparedTextCore, segmentIndex: number): number => {
  const graphemeWidths = breakableGraphemeWidthsAt(core, segmentIndex)

  return graphemeWidths.length === 0 ? 1 : graphemeWidths.length
}

const advanceCursor = (core: PreparedTextCore, cursor: LayoutCursorType): LayoutCursorType => {
  return (
      breakableGraphemeWidthsAt(core, cursor.segmentIndex).length > 0 &&
      cursor.graphemeIndex + 1 < textGraphemeCountAt(core, cursor.segmentIndex)
    )
    ? cursorAt(cursor.segmentIndex, cursor.graphemeIndex + 1)
    : cursorAt(cursor.segmentIndex + 1)
}

const breakKindAtCursor = (core: PreparedTextCore, cursor: LayoutCursorType): PreparedBreakKindType => {
  return (
      breakableGraphemeWidthsAt(core, cursor.segmentIndex).length > 0 &&
      cursor.graphemeIndex < textGraphemeCountAt(core, cursor.segmentIndex) - 1
    )
    ? "text"
    : breakKindAt(core, cursor.segmentIndex)
}

const resolveFitAdvance = (core: PreparedTextCore, segmentIndex: number, currentFitWidth: number): number =>
  breakKindAt(core, segmentIndex) === "tab"
    ? resolveTabAdvance(currentFitWidth, core.kernel.runtime.tabStopAdvance)
    : core.kernel.runtime.fitAdvances[segmentIndex] ?? 0

const resolvePaintAdvance = (core: PreparedTextCore, segmentIndex: number, currentPaintWidth: number): number =>
  breakKindAt(core, segmentIndex) === "tab"
    ? resolveTabAdvance(currentPaintWidth, core.kernel.runtime.tabStopAdvance)
    : core.kernel.runtime.paintAdvances[segmentIndex] ?? 0

const isTabAtCursor = (core: PreparedTextCore, cursor: LayoutCursorType): boolean =>
  breakKindAtCursor(core, cursor) === "tab"

const resolveFitAdvanceAtCursor = (
  core: PreparedTextCore,
  cursor: LayoutCursorType,
  currentFitWidth: number
): number => {
  if (isTabAtCursor(core, cursor)) {
    return resolveTabAdvance(currentFitWidth, core.kernel.runtime.tabStopAdvance)
  }

  const prefixWidths = breakablePrefixWidthsAt(core, cursor.segmentIndex)
  const fallbackWidth = core.kernel.runtime.fitAdvances[cursor.segmentIndex] ?? 0

  return prefixWidths.length > 0
    ? advanceFromPrefixWidths(prefixWidths, cursor.graphemeIndex, fallbackWidth)
    : fallbackWidth
}

const resolvePaintAdvanceAtCursor = (
  core: PreparedTextCore,
  cursor: LayoutCursorType,
  currentPaintWidth: number
): number => {
  if (isTabAtCursor(core, cursor)) {
    return resolveTabAdvance(currentPaintWidth, core.kernel.runtime.tabStopAdvance)
  }

  const graphemeWidths = breakableGraphemeWidthsAt(core, cursor.segmentIndex)

  return graphemeWidths.length > 0
    ? graphemeWidths[cursor.graphemeIndex] ?? core.kernel.runtime.paintAdvances[cursor.segmentIndex] ?? 0
    : core.kernel.runtime.paintAdvances[cursor.segmentIndex] ?? 0
}

const appendBreakCandidate = (
  candidates: ReadonlyArray<BreakCandidate>,
  candidate: BreakCandidate
): ReadonlyArray<BreakCandidate> => Arr.append(candidates, candidate)

const appendDiscretionaryBreakCandidate = (
  candidates: ReadonlyArray<BreakCandidate>,
  core: PreparedTextCore,
  cursor: LayoutCursorType,
  end: LayoutCursorType,
  fitWidth: number,
  paintWidth: number
): ReadonlyArray<BreakCandidate> =>
  Match.value(breakKindAtCursor(core, cursor)).pipe(
    Match.when("soft-hyphen", () =>
      appendBreakCandidate(candidates, {
        end,
        fitWidth,
        insertedText: "-",
        insertedWidth: core.kernel.runtime.discretionaryHyphenWidth,
        kind: "soft-hyphen",
        nextCursor: end,
        paintWidth
      })),
    Match.when("dictionary-hyphen", () =>
      appendBreakCandidate(candidates, {
        end,
        fitWidth,
        insertedText: "-",
        insertedWidth: core.kernel.runtime.discretionaryHyphenWidth,
        kind: "dictionary-hyphen",
        nextCursor: end,
        paintWidth
      })),
    Match.orElse(() => candidates)
  )

const explicitBreakCandidate = (
  state: LineScanState,
  currentCursor: LayoutCursorType,
  nextCursor: LayoutCursorType
): BreakCandidate => ({
  end: currentCursor,
  fitWidth: state.fitWidth,
  insertedText: "",
  insertedWidth: 0,
  kind: "explicit",
  nextCursor,
  paintWidth: state.paintWidth
})

const breakCandidatesBeforeCommittedSegment = (
  core: PreparedTextCore,
  state: LineScanState,
  currentCursor: LayoutCursorType
): ReadonlyArray<BreakCandidate> =>
  hasPendingWhitespace(state)
    ? Arr.append(
      Arr.empty<BreakCandidate>(),
      core.kernel.whiteSpace === "pre-wrap"
        ? {
          end: state.pendingEnd,
          fitWidth: state.fitWidth + state.pendingFitWidth,
          insertedText: "",
          insertedWidth: 0,
          kind: "explicit",
          nextCursor: currentCursor,
          paintWidth: state.paintWidth + state.pendingPaintWidth
        }
        : explicitBreakCandidate(state, state.end, currentCursor)
    )
    : state.breakCandidates

const chooseBreakCandidate = (
  candidates: ReadonlyArray<BreakCandidate>,
  maxWidth: number,
  lineFitEpsilon: number,
  preferEarlySoftHyphenBreak: boolean
): BreakCandidate | null => {
  const fittingCandidates = Arr.filter(
    candidates,
    (candidate) => candidate.fitWidth + candidate.insertedWidth <= maxWidth + lineFitEpsilon
  )

  if (fittingCandidates.length === 0) {
    return null
  }

  const softHyphenCandidates = Arr.filter(fittingCandidates, (candidate) => candidate.kind === "soft-hyphen")

  if (softHyphenCandidates.length > 0) {
    return preferEarlySoftHyphenBreak
      ? softHyphenCandidates[0] ?? null
      : softHyphenCandidates[softHyphenCandidates.length - 1] ?? null
  }

  const dictionaryHyphenCandidates = Arr.filter(
    fittingCandidates,
    (candidate) => candidate.kind === "dictionary-hyphen"
  )

  if (dictionaryHyphenCandidates.length > 0) {
    return dictionaryHyphenCandidates[dictionaryHyphenCandidates.length - 1] ?? null
  }

  const explicitBreakCandidates = Arr.filter(fittingCandidates, (candidate) => candidate.kind === "explicit")

  return explicitBreakCandidates[explicitBreakCandidates.length - 1] ?? null
}

const lineHasCommittedContent = (state: LineScanState): boolean =>
  state.paintWidth > 0 || !cursorEquals(state.start, state.end)

const hasPendingWhitespace = (state: LineScanState): boolean => state.pendingStart !== null

const initialLineScanState = (cursor: LayoutCursorType): LineScanState => ({
  ...emptyState,
  end: cursor,
  pendingEnd: cursor,
  start: cursor
})

const emitInternalLineRecord = (
  core: PreparedTextCore,
  start: LayoutCursorType,
  end: LayoutCursorType,
  nextCursor: LayoutCursorType,
  fitWidth: number,
  paintWidth: number,
  insertedBreakText: string = ""
): InternalLineRecord => ({
  baseDirection: core.kernel.baseDirection,
  end,
  fitWidth,
  insertedBreakText,
  nextCursor,
  order: "visual",
  paintWidth,
  start,
  width: paintWidth
})

type ResolvedPendingState = Readonly<{
  end: LayoutCursorType
  fitWidth: number
  paintWidth: number
}>

const resolvePendingState = (
  core: PreparedTextCore,
  state: LineScanState
): ResolvedPendingState => {
  const preservePending = core.kernel.whiteSpace === "pre-wrap" && hasPendingWhitespace(state)

  if (lineHasCommittedContent(state)) {
    return {
      end: preservePending ? state.pendingEnd : state.end,
      fitWidth: state.fitWidth + (preservePending ? state.pendingFitWidth : 0),
      paintWidth: state.paintWidth + (preservePending ? state.pendingPaintWidth : 0)
    }
  }

  return preservePending
    ? { end: state.pendingEnd, fitWidth: state.pendingFitWidth, paintWidth: state.pendingPaintWidth }
    : { end: state.start, fitWidth: 0, paintWidth: 0 }
}

const finalizeAtEnd = (core: PreparedTextCore, state: LineScanState): Option.Option<InternalLineRecord> => {
  const resolved = resolvePendingState(core, state)

  if (!lineHasCommittedContent(state) && resolved.fitWidth === 0 && resolved.paintWidth === 0) {
    return Option.none()
  }

  return Option.some(
    emitInternalLineRecord(core, state.start, resolved.end, endCursorFor(core), resolved.fitWidth, resolved.paintWidth)
  )
}

const finalizeAtHardBreak = (
  core: PreparedTextCore,
  state: LineScanState,
  nextCursor: LayoutCursorType
): InternalLineRecord => {
  const resolved = resolvePendingState(core, state)

  return emitInternalLineRecord(core, state.start, resolved.end, nextCursor, resolved.fitWidth, resolved.paintWidth)
}

const finalizeBeforeCurrent = (
  core: PreparedTextCore,
  state: LineScanState,
  nextCursor: LayoutCursorType
): InternalLineRecord =>
  emitInternalLineRecord(core, state.start, state.end, nextCursor, state.fitWidth, state.paintWidth)

const finalizeBeforePending = (
  core: PreparedTextCore,
  state: LineScanState,
  currentCursor: LayoutCursorType
): InternalLineRecord =>
  emitInternalLineRecord(
    core,
    state.start,
    state.end,
    state.pendingStart === null
      ? currentCursor
      : core.kernel.whiteSpace === "pre-wrap"
      ? state.pendingStart
      : currentCursor,
    state.fitWidth,
    state.paintWidth
  )

const finalizeBreakCandidate = (
  core: PreparedTextCore,
  candidate: BreakCandidate,
  start: LayoutCursorType
): InternalLineRecord =>
  emitInternalLineRecord(
    core,
    start,
    candidate.end,
    candidate.nextCursor,
    candidate.fitWidth + candidate.insertedWidth,
    candidate.paintWidth + candidate.insertedWidth,
    candidate.insertedText
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
    breakCandidates: [],
    pendingEnd: nextCursor,
    pendingFitWidth: state.pendingFitWidth + fitAdvance,
    pendingPaintWidth: state.pendingPaintWidth + paintAdvance,
    pendingStart: state.pendingStart ?? currentCursor
  }
}

const startLineWithSegment = (
  core: PreparedTextCore,
  state: LineScanState,
  currentCursor: LayoutCursorType,
  nextCursor: LayoutCursorType
): LineScanState => {
  const leadingFitWidth = core.kernel.whiteSpace === "pre-wrap" ? state.pendingFitWidth : 0
  const leadingPaintWidth = core.kernel.whiteSpace === "pre-wrap" ? state.pendingPaintWidth : 0
  const fitWidth = leadingFitWidth + resolveFitAdvanceAtCursor(core, currentCursor, leadingFitWidth)
  const paintWidth = leadingPaintWidth + resolvePaintAdvanceAtCursor(core, currentCursor, leadingPaintWidth)

  return {
    ...state,
    breakCandidates: appendDiscretionaryBreakCandidate([], core, currentCursor, nextCursor, fitWidth, paintWidth),
    end: nextCursor,
    fitWidth,
    paintWidth,
    pendingEnd: nextCursor,
    pendingFitWidth: 0,
    pendingPaintWidth: 0,
    pendingStart: null
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
    breakCandidates: appendDiscretionaryBreakCandidate(
      breakCandidatesBeforeCommittedSegment(core, state, currentCursor),
      core,
      currentCursor,
      nextCursor,
      fitWidth,
      paintWidth
    ),
    end: nextCursor,
    fitWidth,
    paintWidth,
    pendingEnd: nextCursor,
    pendingFitWidth: 0,
    pendingPaintWidth: 0,
    pendingStart: null
  }
}

const chunkIndexForCursor = (core: PreparedTextCore, cursor: LayoutCursorType): number => {
  const chunkCount = core.kernel.runtime.chunkConsumedEndIndices.length

  if (chunkCount <= 1) {
    return 0
  }

  return Iterable.reduce(
    Iterable.unfold({ lower: 0, upper: chunkCount - 1 }, (state) => {
      if (state.lower >= state.upper) {
        return Option.none()
      }

      const midpoint = (state.lower + state.upper) >> 1
      const midpointEnd = core.kernel.runtime.chunkConsumedEndIndices[midpoint] ?? segmentCount(core)
      const next = cursor.segmentIndex < midpointEnd
        ? { lower: state.lower, upper: midpoint }
        : { lower: midpoint + 1, upper: state.upper }

      return Option.some(unfoldStep(next, next))
    }),
    { lower: 0, upper: chunkCount - 1 },
    (_previous, current) => current
  ).lower
}

const segmentLimitForCursor = (core: PreparedTextCore, cursor: LayoutCursorType): number =>
  core.kernel.runtime.chunkConsumedEndIndices[chunkIndexForCursor(core, cursor)] ?? segmentCount(core)

const lineFrameIsComplete = (core: PreparedTextCore, frame: LineWalkFrame): boolean =>
  frame.record !== null || frame.cursor.segmentIndex >= segmentCount(core) ||
  frame.cursor.segmentIndex >= frame.segmentLimit

const advanceLineFrame = (core: PreparedTextCore, frame: LineWalkFrame): LineWalkFrame => {
  const currentCursor = frame.cursor
  const nextCursor = advanceCursor(core, currentCursor)
  const breakKind = breakKindAtCursor(core, currentCursor)

  if (breakKind === "hard-break") {
    return {
      ...frame,
      cursor: nextCursor,
      record: finalizeAtHardBreak(core, frame.scan, nextCursor)
    }
  }

  if (breakKind === "space" || breakKind === "preserved-space" || breakKind === "tab") {
    return !lineHasCommittedContent(frame.scan) && core.kernel.whiteSpace === "normal"
      ? {
        ...frame,
        cursor: nextCursor,
        scan: {
          ...frame.scan,
          end: nextCursor,
          pendingEnd: nextCursor,
          start: nextCursor
        }
      }
      : {
        ...frame,
        cursor: nextCursor,
        scan: appendPendingWhitespace(core, frame.scan, currentCursor, nextCursor)
      }
  }

  if (breakKind === "zero-width-break") {
    return !lineHasCommittedContent(frame.scan)
      ? {
        ...frame,
        cursor: nextCursor,
        scan: {
          ...frame.scan,
          end: nextCursor,
          pendingEnd: nextCursor,
          start: nextCursor
        }
      }
      : {
        ...frame,
        cursor: nextCursor,
        scan: {
          ...frame.scan,
          breakCandidates: appendBreakCandidate(
            frame.scan.breakCandidates,
            explicitBreakCandidate(frame.scan, currentCursor, nextCursor)
          )
        }
      }
  }

  if (!lineHasCommittedContent(frame.scan)) {
    return {
      ...frame,
      cursor: nextCursor,
      scan: startLineWithSegment(core, frame.scan, currentCursor, nextCursor)
    }
  }

  const candidateFitWidth = frame.scan.fitWidth + frame.scan.pendingFitWidth +
    resolveFitAdvanceAtCursor(core, currentCursor, frame.scan.fitWidth + frame.scan.pendingFitWidth)

  if (candidateFitWidth <= frame.maxWidth + core.kernel.lineFitEpsilon) {
    return {
      ...frame,
      cursor: nextCursor,
      scan: appendCommittedSegment(core, frame.scan, currentCursor, nextCursor)
    }
  }

  if (hasPendingWhitespace(frame.scan)) {
    return {
      ...frame,
      record: finalizeBeforePending(core, frame.scan, currentCursor)
    }
  }

  const breakCandidate = chooseBreakCandidate(
    frame.scan.breakCandidates,
    frame.maxWidth,
    core.kernel.lineFitEpsilon,
    core.kernel.preferEarlySoftHyphenBreak
  )

  return {
    ...frame,
    record: breakCandidate === null
      ? finalizeBeforeCurrent(core, frame.scan, currentCursor)
      : finalizeBreakCandidate(core, breakCandidate, frame.scan.start)
  }
}

const walkNextLineRecord = (
  core: PreparedTextCore,
  maxWidth: number,
  cursor: LayoutCursorType
): Option.Option<InternalLineRecord> => {
  if (cursor.segmentIndex >= segmentCount(core)) {
    return Option.none()
  }

  const initial: LineWalkFrame = {
    cursor,
    maxWidth,
    record: null,
    scan: initialLineScanState(cursor),
    segmentLimit: segmentLimitForCursor(core, cursor)
  }
  const terminalFrame = Iterable.reduce(
    Iterable.unfold(initial, (frame) => {
      if (lineFrameIsComplete(core, frame)) {
        return Option.none()
      }

      const next = advanceLineFrame(core, frame)

      return Option.some(unfoldStep(next, next))
    }),
    initial,
    (_previous, current) => current
  )

  return terminalFrame.record !== null ? Option.some(terminalFrame.record) : finalizeAtEnd(core, terminalFrame.scan)
}

const walkLineRecordArray = (
  core: PreparedTextCore,
  maxWidthAtLine: (lineIndex: number) => number,
  lineIndex: number = 0,
  cursor: LayoutCursorType = cursorAt(0)
): ReadonlyArray<InternalLineRecord> =>
  Arr.unfold(
    { cursor, lineIndex },
    (state) =>
      walkNextLineRecord(core, maxWidthAtLine(state.lineIndex), state.cursor).pipe(
        Option.map((record) =>
          unfoldStep(record, {
            cursor: record.nextCursor,
            lineIndex: state.lineIndex + 1
          })
        )
      )
  )

const visualOrderUnitAtCursor = (
  core: PreparedTextWithSegmentsCore,
  cursor: LayoutCursorType,
  logicalIndex: number
): VisualOrderUnit => {
  const segment = segmentAt(core, cursor.segmentIndex)
  const fallbackLevel = core.kernel.baseDirection === "rtl" ? 1 : 0
  const graphemeBidiLevels = graphemeBidiLevelsAt(core, cursor.segmentIndex)
  const mirroredGraphemes = mirroredGraphemesAt(core, cursor.segmentIndex)

  return segment === null
    ? {
      level: fallbackLevel,
      logicalIndex,
      mirroredText: "",
      text: ""
    }
    : segment.kind === "text"
    ? {
      level: graphemeBidiLevels[cursor.graphemeIndex] ?? segment.bidiLevel,
      logicalIndex,
      mirroredText: mirroredGraphemes[cursor.graphemeIndex] ?? segment.graphemes[cursor.graphemeIndex] ?? "",
      text: segment.graphemes[cursor.graphemeIndex] ?? ""
    }
    : {
      level: segment.bidiLevel,
      logicalIndex,
      mirroredText: segment.text,
      text: segment.text
    }
}

const visualUnitsForRecord = (
  core: PreparedTextWithSegmentsCore,
  record: InternalLineRecord
): ReadonlyArray<VisualOrderUnit> =>
  Arr.unfold(
    { cursor: record.start, logicalIndex: 0 },
    (state: VisualUnitCursorState) =>
      cursorEquals(state.cursor, record.end)
        ? Option.none()
        : Option.some(
          unfoldStep(
            visualOrderUnitAtCursor(core, state.cursor, state.logicalIndex),
            {
              cursor: advanceCursor(core, state.cursor),
              logicalIndex: state.logicalIndex + 1
            }
          )
        )
  )

const visualTextForRecord = (core: PreparedTextWithSegmentsCore, record: InternalLineRecord): string => {
  const units = visualUnitsForRecord(core, record)
  const fallbackLevel = units.length === 0
    ? core.kernel.baseDirection === "rtl"
      ? 1
      : 0
    : units[units.length - 1]?.level ?? 0

  return projectVisualText(units, record.insertedBreakText, fallbackLevel)
}

const materializeLine = (
  core: PreparedTextWithSegmentsCore,
  lineIndex: number,
  record: InternalLineRecord
): LayoutLineType => ({
  baseDirection: core.kernel.baseDirection,
  index: lineIndex,
  order: "visual",
  text: visualTextForRecord(core, record),
  width: record.width
})

const measureChunkWidth = (
  core: PreparedTextCore,
  startSegmentIndex: number,
  segmentLimit: number
): number =>
  Iterable.reduce(
    Iterable.unfold(startSegmentIndex, (index) =>
      index < segmentLimit ? Option.some(unfoldStep(index, index + 1)) : Option.none()),
    { fitWidth: 0, paintWidth: 0 },
    (state, segmentIndex) => ({
      fitWidth: state.fitWidth + resolveFitAdvance(core, segmentIndex, state.fitWidth),
      paintWidth: state.paintWidth + resolvePaintAdvance(core, segmentIndex, state.paintWidth)
    })
  ).paintWidth

/**
 * Summarizes layout from the canonical walker without materializing line text.
 *
 * @since 0.2.0
 * @category internals
 */
export const summarizeLines = (core: PreparedTextCore, request: LayoutRequestType): LayoutSummaryType =>
  Arr.reduce(
    walkLineRecordArray(core, () => request.maxWidth),
    {
      height: 0,
      lineCount: 0,
      maxLineWidth: 0
    },
    (summary, record) => ({
      height: summary.height + request.lineHeight,
      lineCount: summary.lineCount + 1,
      maxLineWidth: Math.max(summary.maxLineWidth, record.width)
    })
  )

/**
 * Clones a public cursor into the canonical walker-owned cursor shape.
 *
 * @since 0.2.0
 * @category internals
 */
export const makeInitialCursor = (cursor: LayoutCursorType): LayoutCursorType => ({
  graphemeIndex: cursor.graphemeIndex,
  segmentIndex: cursor.segmentIndex
})

const rememberCursorHint = (
  cursor: LayoutCursorType,
  cursorHints: MutableRef.MutableRef<HashMap.HashMap<CursorHintKey, number>>,
  maxWidth: number,
  lineIndex: number
): LayoutCursorType => {
  MutableRef.update(cursorHints, HashMap.set(cursorHintKey(maxWidth, cursor), lineIndex))

  return cursor
}

const rememberedCursorLineIndex = (
  cursor: LayoutCursorType,
  cursorHints: MutableRef.MutableRef<HashMap.HashMap<CursorHintKey, number>>,
  maxWidth: number
): number => HashMap.get(MutableRef.get(cursorHints), cursorHintKey(maxWidth, cursor)).pipe(Option.getOrElse(() => -1))

const countLinesBeforeCursor = (
  core: PreparedTextWithSegmentsCore,
  request: LayoutRequestType,
  targetCursor: LayoutCursorType
): number =>
  Arr.unfold(cursorAt(0), (cursor) =>
    cursorEquals(cursor, targetCursor)
      ? Option.none()
      : walkNextLineRecord(core, request.maxWidth, cursor).pipe(
        Option.map((record) => unfoldStep(record.nextCursor, record.nextCursor))
      )).length

/**
 * Materializes visual line text from walked line records.
 *
 * @since 0.2.0
 * @category internals
 */
export const materializeLines = (
  core: PreparedTextWithSegmentsCore,
  request: LayoutRequestType,
  maxWidthAtLine: (lineIndex: number) => number = () => request.maxWidth
): ReadonlyArray<LayoutLineType> =>
  Arr.map(walkLineRecordArray(core, maxWidthAtLine), (record, lineIndex) => materializeLine(core, lineIndex, record))

/**
 * Materializes lines and derives summary from one walk pass.
 *
 * @since 0.2.0
 * @category internals
 */
export const materializeLinesWithSummary = (
  core: PreparedTextWithSegmentsCore,
  request: LayoutRequestType
): { readonly summary: LayoutSummaryType; readonly lines: ReadonlyArray<LayoutLineType> } => {
  const records = walkLineRecordArray(core, () => request.maxWidth)
  const lines = Arr.map(records, (record, lineIndex) => materializeLine(core, lineIndex, record))

  return {
    summary: {
      height: records.length * request.lineHeight,
      lineCount: records.length,
      maxLineWidth: Arr.reduce(records, 0, (maxWidth, record) => Math.max(maxWidth, record.width))
    },
    lines
  }
}

/**
 * Materializes one walked line and records the next cursor hint for streaming callers.
 *
 * @since 0.2.0
 * @category internals
 */
export const materializeLineAtCursor = (
  prepared: PreparedTextWithSegments,
  request: LayoutRequestType,
  cursor: LayoutCursorType,
  lineIndexHint: number = -1
): Option.Option<readonly [LayoutLineType, LayoutCursorType]> => {
  const core = preparedTextWithSegmentsCore(prepared)
  const cursorHints = preparedTextWithSegmentsCursorHints(prepared)

  return walkNextLineRecord(core, request.maxWidth, cursor).pipe(
    Option.map((record): readonly [LayoutLineType, LayoutCursorType] => {
      const hintedLineIndex = lineIndexHint >= 0
        ? lineIndexHint
        : rememberedCursorLineIndex(cursor, cursorHints, request.maxWidth)
      const lineIndex = hintedLineIndex >= 0 ? hintedLineIndex : countLinesBeforeCursor(core, request, cursor)

      return [
        materializeLine(core, lineIndex, record),
        rememberCursorHint(record.nextCursor, cursorHints, request.maxWidth, lineIndex + 1)
      ]
    })
  )
}

/**
 * Projects non-materialized line bounds from the canonical walker.
 *
 * @since 0.2.0
 * @category internals
 */
export const walkLineRanges = (
  core: PreparedTextWithSegmentsCore,
  request: LayoutRequestType,
  maxWidthAtLine: (lineIndex: number) => number = () => request.maxWidth
): ReadonlyArray<LayoutLineRangeType> =>
  Arr.map(walkLineRecordArray(core, maxWidthAtLine), (record) => ({
    baseDirection: record.baseDirection,
    end: record.end,
    order: record.order,
    start: record.start,
    width: record.width
  }))

/**
 * Measures the widest hard-break chunk in prepared text without re-walking line breaks.
 *
 * @since 0.2.0
 * @category internals
 */
export const measureNaturalWidth = (core: PreparedTextCore): number =>
  Arr.reduce(core.kernel.runtime.chunkStartIndices, 0, (maxWidth, startSegmentIndex, chunkIndex) => {
    const consumedEndIndex = core.kernel.runtime.chunkConsumedEndIndices[chunkIndex] ?? segmentCount(core)
    const chunkWidth = measureChunkWidth(core, startSegmentIndex, consumedEndIndex)

    return Math.max(maxWidth, chunkWidth)
  })
