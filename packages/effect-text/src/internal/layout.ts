/**
 * Pure prepared-table walker for line fitting, visual materialization, and cursor ranges.
 *
 * @since 0.1.0
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Boolean, Data, Match, Number, Option, Order, Schema, String, Tuple } from "effect"
import * as Arr from "effect/Array"
import * as HashMap from "effect/HashMap"
import * as Iterable from "effect/Iterable"
import * as MutableRef from "effect/MutableRef"

import type * as Text from "../Text.js"
import { projectVisualText, visualOrderUnitLevel } from "./bidi.js"
import type * as Prepared from "./prepared.js"
import { CursorHintKey } from "./prepared.js"

const BreakCandidateKind = Schema.Literal("dictionary-hyphen", "explicit", "soft-hyphen")
type BreakCandidateKind = typeof BreakCandidateKind.Type

class BreakCandidate extends Data.Class<{
  readonly end: Text.Cursor
  readonly fitWidth: number
  readonly insertedText: string
  readonly insertedWidth: number
  readonly kind: BreakCandidateKind
  readonly nextCursor: Text.Cursor
  readonly paintWidth: number
}> {}

type BreakCandidates = ReadonlyArray<BreakCandidate>

class InternalLineRecord extends Data.Class<{
  readonly end: Text.Cursor
  readonly insertedBreakText: string
  readonly nextCursor: Text.Cursor
  readonly start: Text.Cursor
  readonly width: number
}> {}

class LineScanState extends Data.Class<{
  readonly breakCandidates: MutableRef.MutableRef<BreakCandidates>
  readonly end: MutableRef.MutableRef<Text.Cursor>
  readonly fitWidth: MutableRef.MutableRef<number>
  readonly paintWidth: MutableRef.MutableRef<number>
  readonly pendingEnd: MutableRef.MutableRef<Text.Cursor>
  readonly pendingFitWidth: MutableRef.MutableRef<number>
  readonly pendingPaintWidth: MutableRef.MutableRef<number>
  readonly pendingStart: MutableRef.MutableRef<Option.Option<Text.Cursor>>
  readonly start: MutableRef.MutableRef<Text.Cursor>
}> {}

class LineWalkFrame extends Data.Class<{
  readonly cursor: MutableRef.MutableRef<Text.Cursor>
  readonly fitLimit: MutableRef.MutableRef<number>
  readonly record: MutableRef.MutableRef<Option.Option<InternalLineRecord>>
  readonly scan: LineScanState
  readonly segmentLimit: MutableRef.MutableRef<number>
}> {}

const lineWalkBatch = Arr.range(0, 63)

const cursorHintKey = (maxWidth: number, cursor: Text.Cursor): CursorHintKey =>
  new CursorHintKey({
    graphemeIndex: cursor.graphemeIndex,
    maxWidth,
    segmentIndex: cursor.segmentIndex
  })

const cursorAt = (segmentIndex: number, graphemeIndex: number = 0): Text.Cursor => ({
  segmentIndex,
  graphemeIndex
})

const segmentCount = (kernel: Prepared.Kernel): number => Arr.length(kernel.runtime.segments)

const cursorEquals = (left: Text.Cursor, right: Text.Cursor): boolean =>
  Boolean.and(
    Number.Equivalence(left.segmentIndex, right.segmentIndex),
    Number.Equivalence(left.graphemeIndex, right.graphemeIndex)
  )
const cursorOrder = Order.struct({ segmentIndex: Order.number, graphemeIndex: Order.number })

const endCursorFor = (kernel: Prepared.Kernel): Text.Cursor => cursorAt(segmentCount(kernel))

const resolveTabAdvance = (currentWidth: number, tabStopAdvance: number): number => {
  return Boolean.match(Number.lessThanOrEqualTo(tabStopAdvance, 0), {
    onFalse: () => {
      const quotient = Number.unsafeDivide(currentWidth, tabStopAdvance)
      const stopIndex = Numeric.floor(quotient)
      const adjacentBelowStop = Boolean.and(
        Number.Equivalence(quotient, stopIndex),
        Number.lessThan(currentWidth, Number.multiply(tabStopAdvance, stopIndex))
      )
      const nextStopIndex = Boolean.match(adjacentBelowStop, {
        onFalse: () => Number.increment(stopIndex),
        onTrue: () => stopIndex
      })

      return Number.subtract(Number.multiply(tabStopAdvance, nextStopIndex), currentWidth)
    },
    onTrue: () => 0
  })
}

const runtimeSegmentAt = (kernel: Prepared.Kernel, segmentIndex: number): Prepared.RuntimeSegment =>
  Arr.unsafeGet(kernel.runtime.segments, segmentIndex)

type IndexedWidthValues = ReadonlyArray<number>

const advanceCursorForSegment = (segment: Prepared.RuntimeSegment, cursor: Text.Cursor): Text.Cursor => {
  const remainsInSegment = Number.lessThan(
    Number.increment(cursor.graphemeIndex),
    segment.breakableGraphemeCount
  )

  if (remainsInSegment) {
    return cursorAt(cursor.segmentIndex, Number.increment(cursor.graphemeIndex))
  }
  return segment.nextSegmentCursor
}

const breakKindAtCursor = (segment: Prepared.RuntimeSegment, cursor: Text.Cursor): Prepared.BreakKind => {
  if (Number.lessThan(cursor.graphemeIndex, Number.decrement(segment.breakableGraphemeCount))) {
    return "text"
  }
  return segment.breakKind
}

const widthAtCursorOrElse = (
  widths: IndexedWidthValues,
  widthCount: number,
  cursor: Text.Cursor,
  fallback: number
): number => {
  if (Number.lessThan(cursor.graphemeIndex, widthCount)) {
    return Arr.unsafeGet(widths, cursor.graphemeIndex)
  }
  return fallback
}

const resolveFitAdvanceAtCursor = (
  segment: Prepared.RuntimeSegment,
  cursor: Text.Cursor
): number =>
  widthAtCursorOrElse(
    segment.breakableFitAdvances,
    segment.breakableGraphemeCount,
    cursor,
    segment.fitAdvance
  )

const resolvePaintAdvanceAtCursor = (
  segment: Prepared.RuntimeSegment,
  cursor: Text.Cursor
): number =>
  widthAtCursorOrElse(
    segment.breakableGraphemeWidths,
    segment.breakableGraphemeCount,
    cursor,
    segment.paintAdvance
  )

const appendDiscretionaryBreakCandidate = (
  candidates: BreakCandidates,
  kernel: Prepared.Kernel,
  kind: Prepared.BreakKind,
  end: Text.Cursor,
  fitWidth: number,
  paintWidth: number
): BreakCandidates => {
  return Boolean.match(String.Equivalence(kind, "text"), {
    onFalse: () =>
      Boolean.match(isDiscretionaryBreak(kind), {
        onFalse: () => candidates,
        onTrue: () =>
          Arr.append(
            candidates,
            new BreakCandidate({
              end,
              fitWidth,
              insertedText: "-",
              insertedWidth: kernel.runtime.discretionaryHyphenWidth,
              kind: Boolean.match(String.Equivalence(kind, "soft-hyphen"), {
                onTrue: () => "soft-hyphen",
                onFalse: () => "dictionary-hyphen"
              }),
              nextCursor: end,
              paintWidth
            })
          )
      }),
    onTrue: () => candidates
  })
}

const isDiscretionaryBreak = (kind: Prepared.BreakKind): boolean =>
  Boolean.match(String.Equivalence(kind, "soft-hyphen"), {
    onFalse: () => String.Equivalence(kind, "dictionary-hyphen"),
    onTrue: () => true
  })

const explicitBreakCandidate = (
  state: LineScanState,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): BreakCandidate =>
  new BreakCandidate({
    end: currentCursor,
    fitWidth: MutableRef.get(state.fitWidth),
    insertedText: "",
    insertedWidth: 0,
    kind: "explicit",
    nextCursor,
    paintWidth: MutableRef.get(state.paintWidth)
  })

const breakCandidatesBeforeCommittedSegment = (
  kernel: Prepared.Kernel,
  state: LineScanState,
  currentCursor: Text.Cursor
): BreakCandidates =>
  Boolean.match(hasPendingWhitespace(state), {
    onFalse: () => MutableRef.get(state.breakCandidates),
    onTrue: () =>
      Arr.of(
        Boolean.match(String.Equivalence(kernel.whiteSpace, "normal"), {
          onTrue: () => explicitBreakCandidate(state, MutableRef.get(state.end), currentCursor),
          onFalse: () =>
            new BreakCandidate({
              end: MutableRef.get(state.pendingEnd),
              fitWidth: Number.sum(MutableRef.get(state.fitWidth), MutableRef.get(state.pendingFitWidth)),
              insertedText: String.empty,
              insertedWidth: 0,
              kind: "explicit",
              nextCursor: currentCursor,
              paintWidth: Number.sum(MutableRef.get(state.paintWidth), MutableRef.get(state.pendingPaintWidth))
            })
        })
      )
  })

const chooseBreakCandidate = (
  candidates: BreakCandidates,
  fitLimit: number,
  preferEarlySoftHyphenBreak: boolean
): Option.Option<BreakCandidate> => {
  return Arr.reduce(
    candidates,
    Option.none<BreakCandidate>(),
    (current, candidate) =>
      Boolean.match(
        Number.lessThanOrEqualTo(Number.sum(candidate.fitWidth, candidate.insertedWidth), fitLimit),
        {
          onFalse: () => current,
          onTrue: () =>
            Option.match(current, {
              onNone: () => Option.some(candidate),
              onSome: (selected) => {
                const selectedPriority = breakCandidatePriority(selected)
                const candidatePriority = breakCandidatePriority(candidate)
                return Boolean.match(Number.greaterThan(candidatePriority, selectedPriority), {
                  onFalse: () =>
                    Boolean.match(Number.Equivalence(candidatePriority, selectedPriority), {
                      onFalse: () => current,
                      onTrue: () =>
                        Boolean.match(
                          Boolean.and(
                            preferEarlySoftHyphenBreak,
                            String.Equivalence(candidate.kind, "soft-hyphen")
                          ),
                          {
                            onFalse: () => Option.some(candidate),
                            onTrue: () => current
                          }
                        )
                    }),
                  onTrue: () => Option.some(candidate)
                })
              }
            })
        }
      )
  )
}

const breakCandidatePriority = (candidate: BreakCandidate): number =>
  Boolean.match(String.Equivalence(candidate.kind, "soft-hyphen"), {
    onFalse: () =>
      Boolean.match(String.Equivalence(candidate.kind, "dictionary-hyphen"), {
        onFalse: () => 0,
        onTrue: () => 1
      }),
    onTrue: () => 2
  })

const lineHasCommittedContent = (state: LineScanState): boolean =>
  Boolean.or(
    Number.greaterThan(MutableRef.get(state.paintWidth), 0),
    Boolean.not(cursorEquals(MutableRef.get(state.start), MutableRef.get(state.end)))
  )

const hasPendingWhitespace = (state: LineScanState): boolean => Option.isSome(MutableRef.get(state.pendingStart))

const initialLineScanState = (cursor: Text.Cursor): LineScanState =>
  new LineScanState({
    breakCandidates: MutableRef.make(Arr.empty()),
    end: MutableRef.make(cursor),
    fitWidth: MutableRef.make(0),
    paintWidth: MutableRef.make(0),
    pendingEnd: MutableRef.make(cursor),
    pendingFitWidth: MutableRef.make(0),
    pendingPaintWidth: MutableRef.make(0),
    pendingStart: MutableRef.make(Option.none()),
    start: MutableRef.make(cursor)
  })

const resetLineScanState = (state: LineScanState, cursor: Text.Cursor): void => {
  MutableRef.set(state.breakCandidates, Arr.empty())
  MutableRef.set(state.end, cursor)
  MutableRef.set(state.fitWidth, 0)
  MutableRef.set(state.paintWidth, 0)
  MutableRef.set(state.pendingEnd, cursor)
  MutableRef.set(state.pendingFitWidth, 0)
  MutableRef.set(state.pendingPaintWidth, 0)
  MutableRef.set(state.pendingStart, Option.none())
  MutableRef.set(state.start, cursor)
}

const initialLineWalkFrame = (cursor: Text.Cursor): LineWalkFrame =>
  new LineWalkFrame({
    cursor: MutableRef.make(cursor),
    fitLimit: MutableRef.make(0),
    record: MutableRef.make(Option.none()),
    scan: initialLineScanState(cursor),
    segmentLimit: MutableRef.make(0)
  })

const emitInternalLineRecord = (
  start: Text.Cursor,
  end: Text.Cursor,
  nextCursor: Text.Cursor,
  paintWidth: number,
  insertedBreakText: string = ""
): InternalLineRecord =>
  new InternalLineRecord({
    end,
    insertedBreakText,
    nextCursor,
    start,
    width: paintWidth
  })

const resolvePendingEnd = (
  state: LineScanState,
  hasCommittedContent: boolean,
  preservePending: boolean
): Text.Cursor =>
  Boolean.match(hasCommittedContent, {
    onFalse: () =>
      Boolean.match(preservePending, {
        onFalse: () => MutableRef.get(state.start),
        onTrue: () => MutableRef.get(state.pendingEnd)
      }),
    onTrue: () =>
      Boolean.match(preservePending, {
        onFalse: () => MutableRef.get(state.end),
        onTrue: () => MutableRef.get(state.pendingEnd)
      })
  })

const resolvePendingWidth = (
  committedWidth: number,
  pendingWidth: number,
  hasCommittedContent: boolean,
  preservePending: boolean
): number =>
  Boolean.match(hasCommittedContent, {
    onFalse: () =>
      Boolean.match(preservePending, {
        onFalse: () => 0,
        onTrue: () => pendingWidth
      }),
    onTrue: () =>
      Boolean.match(preservePending, {
        onFalse: () => committedWidth,
        onTrue: () => Number.sum(committedWidth, pendingWidth)
      })
  })

const finalizeAtEnd = (kernel: Prepared.Kernel, state: LineScanState): Option.Option<InternalLineRecord> => {
  const hasCommittedContent = lineHasCommittedContent(state)
  const preservePending = Boolean.and(
    String.Equivalence(kernel.whiteSpace, "pre-wrap"),
    hasPendingWhitespace(state)
  )
  const fitWidth = resolvePendingWidth(
    MutableRef.get(state.fitWidth),
    MutableRef.get(state.pendingFitWidth),
    hasCommittedContent,
    preservePending
  )
  const paintWidth = resolvePendingWidth(
    MutableRef.get(state.paintWidth),
    MutableRef.get(state.pendingPaintWidth),
    hasCommittedContent,
    preservePending
  )

  const empty = Boolean.and(
    Boolean.not(hasCommittedContent),
    Boolean.and(Number.Equivalence(fitWidth, 0), Number.Equivalence(paintWidth, 0))
  )

  return Boolean.match(empty, {
    onFalse: () =>
      Option.some(
        emitInternalLineRecord(
          MutableRef.get(state.start),
          resolvePendingEnd(state, hasCommittedContent, preservePending),
          endCursorFor(kernel),
          paintWidth
        )
      ),
    onTrue: Option.none
  })
}

const finalizeAtHardBreak = (
  kernel: Prepared.Kernel,
  state: LineScanState,
  nextCursor: Text.Cursor
): InternalLineRecord => {
  const hasCommittedContent = lineHasCommittedContent(state)
  const preservePending = Boolean.and(
    String.Equivalence(kernel.whiteSpace, "pre-wrap"),
    hasPendingWhitespace(state)
  )

  return emitInternalLineRecord(
    MutableRef.get(state.start),
    resolvePendingEnd(state, hasCommittedContent, preservePending),
    nextCursor,
    resolvePendingWidth(
      MutableRef.get(state.paintWidth),
      MutableRef.get(state.pendingPaintWidth),
      hasCommittedContent,
      preservePending
    )
  )
}

const finalizeBeforeCurrent = (
  state: LineScanState,
  nextCursor: Text.Cursor
): InternalLineRecord =>
  emitInternalLineRecord(
    MutableRef.get(state.start),
    MutableRef.get(state.end),
    nextCursor,
    MutableRef.get(state.paintWidth)
  )

const finalizeBeforePending = (
  kernel: Prepared.Kernel,
  state: LineScanState,
  currentCursor: Text.Cursor
): InternalLineRecord =>
  emitInternalLineRecord(
    MutableRef.get(state.start),
    MutableRef.get(state.end),
    Boolean.match(String.Equivalence(kernel.whiteSpace, "normal"), {
      onTrue: () => currentCursor,
      onFalse: () => Option.getOrElse(MutableRef.get(state.pendingStart), () => currentCursor)
    }),
    MutableRef.get(state.paintWidth)
  )

const finalizeBreakCandidate = (
  candidate: BreakCandidate,
  start: Text.Cursor
): InternalLineRecord =>
  emitInternalLineRecord(
    start,
    candidate.end,
    candidate.nextCursor,
    Number.sum(candidate.paintWidth, candidate.insertedWidth),
    candidate.insertedText
  )

const appendPendingWhitespace = (
  kernel: Prepared.Kernel,
  segment: Prepared.RuntimeSegment,
  kind: Prepared.BreakKind,
  state: LineScanState,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): void => {
  const pendingFitWidth = MutableRef.get(state.pendingFitWidth)
  const pendingPaintWidth = MutableRef.get(state.pendingPaintWidth)

  MutableRef.set(state.breakCandidates, Arr.empty())
  MutableRef.set(state.pendingEnd, nextCursor)
  Boolean.match(String.Equivalence(kind, "tab"), {
    onFalse: () => {
      MutableRef.set(state.pendingFitWidth, Number.sum(pendingFitWidth, segment.fitAdvance))
      MutableRef.set(state.pendingPaintWidth, Number.sum(pendingPaintWidth, segment.paintAdvance))
    },
    onTrue: () => {
      const currentFitWidth = Number.sum(MutableRef.get(state.fitWidth), pendingFitWidth)
      const currentPaintWidth = Number.sum(MutableRef.get(state.paintWidth), pendingPaintWidth)
      const fitAdvance = resolveTabAdvance(currentFitWidth, kernel.runtime.tabStopAdvance)
      const paintAdvance = Boolean.match(Number.Equivalence(currentFitWidth, currentPaintWidth), {
        onFalse: () => resolveTabAdvance(currentPaintWidth, kernel.runtime.tabStopAdvance),
        onTrue: () => fitAdvance
      })

      MutableRef.set(state.pendingFitWidth, Number.sum(pendingFitWidth, fitAdvance))
      MutableRef.set(state.pendingPaintWidth, Number.sum(pendingPaintWidth, paintAdvance))
    }
  })
  MutableRef.update(state.pendingStart, Option.orElse(() => Option.some(currentCursor)))
}

const startLineWithSegment = (
  kernel: Prepared.Kernel,
  segment: Prepared.RuntimeSegment,
  kind: Prepared.BreakKind,
  state: LineScanState,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): void => {
  const normal = String.Equivalence(kernel.whiteSpace, "normal")
  const leadingFitWidth = Boolean.match(normal, {
    onTrue: () => 0,
    onFalse: () => MutableRef.get(state.pendingFitWidth)
  })
  const leadingPaintWidth = Boolean.match(normal, {
    onTrue: () => 0,
    onFalse: () => MutableRef.get(state.pendingPaintWidth)
  })
  const fitWidth = Number.sum(
    leadingFitWidth,
    resolveFitAdvanceAtCursor(segment, currentCursor)
  )
  const paintWidth = Number.sum(
    leadingPaintWidth,
    resolvePaintAdvanceAtCursor(segment, currentCursor)
  )

  const breakCandidates = appendDiscretionaryBreakCandidate(
    Arr.empty(),
    kernel,
    kind,
    nextCursor,
    fitWidth,
    paintWidth
  )
  MutableRef.set(state.breakCandidates, breakCandidates)
  MutableRef.set(state.end, nextCursor)
  MutableRef.set(state.fitWidth, fitWidth)
  MutableRef.set(state.paintWidth, paintWidth)
  MutableRef.set(state.pendingEnd, nextCursor)
  MutableRef.set(state.pendingFitWidth, 0)
  MutableRef.set(state.pendingPaintWidth, 0)
  MutableRef.set(state.pendingStart, Option.none())
}

const appendCommittedSegment = (
  kernel: Prepared.Kernel,
  segment: Prepared.RuntimeSegment,
  kind: Prepared.BreakKind,
  state: LineScanState,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor,
  fitWidth: number
): void => {
  const pendingPaintWidth = Number.sum(MutableRef.get(state.paintWidth), MutableRef.get(state.pendingPaintWidth))
  const paintWidth = Number.sum(
    pendingPaintWidth,
    resolvePaintAdvanceAtCursor(segment, currentCursor)
  )

  const breakCandidates = appendDiscretionaryBreakCandidate(
    breakCandidatesBeforeCommittedSegment(kernel, state, currentCursor),
    kernel,
    kind,
    nextCursor,
    fitWidth,
    paintWidth
  )
  MutableRef.set(state.breakCandidates, breakCandidates)
  MutableRef.set(state.end, nextCursor)
  MutableRef.set(state.fitWidth, fitWidth)
  MutableRef.set(state.paintWidth, paintWidth)
  MutableRef.set(state.pendingEnd, nextCursor)
  MutableRef.set(state.pendingFitWidth, 0)
  MutableRef.set(state.pendingPaintWidth, 0)
  MutableRef.set(state.pendingStart, Option.none())
}

const segmentLimitForCursor = (kernel: Prepared.Kernel, cursor: Text.Cursor): number =>
  runtimeSegmentAt(kernel, cursor.segmentIndex).chunkEndSegmentIndex

const lineFrameIsComplete = (frame: LineWalkFrame, cursor: Text.Cursor): boolean => {
  return Boolean.or(
    Option.isSome(MutableRef.get(frame.record)),
    Number.greaterThanOrEqualTo(cursor.segmentIndex, MutableRef.get(frame.segmentLimit))
  )
}

const advanceWhitespaceFrame = (
  kernel: Prepared.Kernel,
  segment: Prepared.RuntimeSegment,
  kind: Prepared.BreakKind,
  frame: LineWalkFrame,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): void => {
  const scan = frame.scan
  const ignoreLeading = Boolean.and(
    String.Equivalence(kernel.whiteSpace, "normal"),
    Boolean.not(lineHasCommittedContent(scan))
  )

  MutableRef.set(frame.cursor, nextCursor)
  Boolean.match(ignoreLeading, {
    onFalse: () => {
      appendPendingWhitespace(kernel, segment, kind, scan, currentCursor, nextCursor)
    },
    onTrue: () => {
      MutableRef.set(scan.end, nextCursor)
      MutableRef.set(scan.pendingEnd, nextCursor)
      MutableRef.set(scan.start, nextCursor)
    }
  })
}

const advanceHardBreakFrame = (
  kernel: Prepared.Kernel,
  _segment: Prepared.RuntimeSegment,
  _kind: Prepared.BreakKind,
  frame: LineWalkFrame,
  _currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): void => {
  MutableRef.set(frame.cursor, nextCursor)
  MutableRef.set(
    frame.record,
    Option.some(finalizeAtHardBreak(kernel, frame.scan, nextCursor))
  )
}

const advanceZeroWidthBreakFrame = (
  _kernel: Prepared.Kernel,
  _segment: Prepared.RuntimeSegment,
  _kind: Prepared.BreakKind,
  frame: LineWalkFrame,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): void => {
  const scan = frame.scan
  MutableRef.set(frame.cursor, nextCursor)
  Boolean.match(lineHasCommittedContent(scan), {
    onFalse: () => {
      MutableRef.set(scan.end, nextCursor)
      MutableRef.set(scan.pendingEnd, nextCursor)
      MutableRef.set(scan.start, nextCursor)
    },
    onTrue: () => {
      MutableRef.update(
        scan.breakCandidates,
        Arr.append(explicitBreakCandidate(scan, currentCursor, nextCursor))
      )
    }
  })
}

const advanceContentFrame = (
  kernel: Prepared.Kernel,
  segment: Prepared.RuntimeSegment,
  kind: Prepared.BreakKind,
  frame: LineWalkFrame,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): void => {
  const scan = frame.scan
  const interiorLimit = Boolean.match(String.Equivalence(segment.breakKind, "text"), {
    onTrue: () => segment.breakableGraphemeCount,
    onFalse: () => Number.decrement(segment.breakableGraphemeCount)
  })
  Boolean.match(lineHasCommittedContent(scan), {
    onFalse: () => {
      MutableRef.set(frame.cursor, nextCursor)
      startLineWithSegment(kernel, segment, kind, scan, currentCursor, nextCursor)
      Boolean.match(Number.lessThan(Number.increment(currentCursor.graphemeIndex), interiorLimit), {
        onFalse: () => {},
        onTrue: () => advanceTextInterior(segment, frame, nextCursor, interiorLimit)
      })
    },
    onTrue: () => {
      const pendingFitWidth = Number.sum(MutableRef.get(scan.fitWidth), MutableRef.get(scan.pendingFitWidth))
      const candidateFitWidth = Number.sum(
        pendingFitWidth,
        resolveFitAdvanceAtCursor(segment, currentCursor)
      )
      return Boolean.match(Number.lessThanOrEqualTo(candidateFitWidth, MutableRef.get(frame.fitLimit)), {
        onFalse: () =>
          Boolean.match(hasPendingWhitespace(scan), {
            onFalse: () => {
              const breakCandidate = chooseBreakCandidate(
                MutableRef.get(scan.breakCandidates),
                MutableRef.get(frame.fitLimit),
                kernel.preferEarlySoftHyphenBreak
              )

              MutableRef.set(
                frame.record,
                Option.match(breakCandidate, {
                  onNone: () => Option.some(finalizeBeforeCurrent(scan, currentCursor)),
                  onSome: (candidate) => Option.some(finalizeBreakCandidate(candidate, MutableRef.get(scan.start)))
                })
              )
            },
            onTrue: () => {
              MutableRef.set(frame.record, Option.some(finalizeBeforePending(kernel, scan, currentCursor)))
            }
          }),
        onTrue: () => {
          MutableRef.set(frame.cursor, nextCursor)
          appendCommittedSegment(kernel, segment, kind, scan, currentCursor, nextCursor, candidateFitWidth)
          Boolean.match(
            Number.lessThan(Number.increment(currentCursor.graphemeIndex), interiorLimit),
            {
              onFalse: () => {},
              onTrue: () => advanceTextInterior(segment, frame, nextCursor, interiorLimit)
            }
          )
        }
      })
    }
  })
}

type AdvanceLineRule = (
  kernel: Prepared.Kernel,
  segment: Prepared.RuntimeSegment,
  kind: Prepared.BreakKind,
  frame: LineWalkFrame,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
) => void

const advanceRuleFor: (kind: Prepared.BreakKind) => AdvanceLineRule = Match.type<Prepared.BreakKind>().pipe(
  Match.when("text", () => advanceContentFrame),
  Match.when("hard-break", () => advanceHardBreakFrame),
  Match.when(Match.is("space", "preserved-space", "tab"), () => advanceWhitespaceFrame),
  Match.when("zero-width-break", () => advanceZeroWidthBreakFrame),
  Match.when(Match.is("soft-hyphen", "dictionary-hyphen", "glue"), () => advanceContentFrame),
  Match.exhaustive
)

// After the first grapheme commits pending whitespace, interior graphemes
// cannot introduce a break opportunity. Accumulate them in the same order,
// publishing one cursor instead of rebuilding the whole scan state each time.
// Include ordinary text endings, but leave special endings and any overflow
// to the ordinary break rules.
const advanceTextInterior = (
  segment: Prepared.RuntimeSegment,
  frame: LineWalkFrame,
  cursor: Text.Cursor,
  limit: number
): void => {
  const index = MutableRef.make(cursor.graphemeIndex)
  const scan = frame.scan
  const visit = () => {
    const current = MutableRef.get(index)
    return Boolean.match(Number.lessThan(current, limit), {
      onFalse: () => true,
      onTrue: () => {
        const width = Number.sum(
          MutableRef.get(scan.fitWidth),
          Arr.unsafeGet(segment.breakableFitAdvances, current)
        )
        return Boolean.match(Number.lessThanOrEqualTo(width, MutableRef.get(frame.fitLimit)), {
          onFalse: () => true,
          onTrue: () => {
            MutableRef.set(scan.fitWidth, width)
            MutableRef.set(
              scan.paintWidth,
              Number.sum(
                MutableRef.get(scan.paintWidth),
                Arr.unsafeGet(segment.breakableGraphemeWidths, current)
              )
            )
            MutableRef.set(index, Number.increment(current))
            return false
          }
        })
      }
    })
  }
  Boolean.match(Arr.some(lineWalkBatch, visit), {
    onTrue: () => true,
    onFalse: () => Iterable.some(Iterable.range(0), () => Arr.some(lineWalkBatch, visit))
  })
  const end = Boolean.match(Number.Equivalence(MutableRef.get(index), segment.breakableGraphemeCount), {
    onTrue: () => segment.nextSegmentCursor,
    onFalse: () => cursorAt(cursor.segmentIndex, MutableRef.get(index))
  })
  MutableRef.set(frame.cursor, end)
  MutableRef.set(scan.end, end)
  MutableRef.set(scan.pendingEnd, end)
}

const advanceLineFrame = (
  kernel: Prepared.Kernel,
  frame: LineWalkFrame,
  cursor: Text.Cursor
): void => {
  const segment = runtimeSegmentAt(kernel, cursor.segmentIndex)
  const kind = breakKindAtCursor(segment, cursor)
  const nextCursor = advanceCursorForSegment(segment, cursor)

  advanceRuleFor(kind)(kernel, segment, kind, frame, cursor, nextCursor)
}

const scanLineRecord = (
  kernel: Prepared.Kernel,
  frame: LineWalkFrame
): Option.Option<InternalLineRecord> => {
  const visit = () => {
    advanceLineFrame(kernel, frame, MutableRef.get(frame.cursor))
    return lineFrameIsComplete(frame, MutableRef.get(frame.cursor))
  }
  Boolean.match(Arr.some(lineWalkBatch, visit), {
    onTrue: () => true,
    onFalse: () => Iterable.some(Iterable.range(0), () => Arr.some(lineWalkBatch, visit))
  })

  return Option.orElse(
    MutableRef.get(frame.record),
    () => finalizeAtEnd(kernel, frame.scan)
  )
}

const walkNextLineRecord = (
  kernel: Prepared.Kernel,
  maxWidth: number,
  cursor: Text.Cursor
): Option.Option<InternalLineRecord> =>
  Boolean.match(Number.greaterThanOrEqualTo(cursor.segmentIndex, segmentCount(kernel)), {
    onFalse: () => {
      const initial = new LineWalkFrame({
        cursor: MutableRef.make(cursor),
        fitLimit: MutableRef.make(Number.sum(maxWidth, kernel.lineFitEpsilon)),
        record: MutableRef.make(Option.none()),
        scan: initialLineScanState(cursor),
        segmentLimit: MutableRef.make(segmentLimitForCursor(kernel, cursor))
      })
      return scanLineRecord(kernel, initial)
    },
    onTrue: () => Option.none()
  })

const forEachLineRecord = (
  kernel: Prepared.Kernel,
  maxWidthAtLine: (lineIndex: number) => number,
  visitRecord: (record: InternalLineRecord, lineIndex: number) => void,
  lineIndex: number = 0,
  cursor: Text.Cursor = cursorAt(0)
): number => {
  const walkFrame = initialLineWalkFrame(cursor)
  const currentCursor = walkFrame.cursor
  const currentLineIndex = MutableRef.make(lineIndex)
  const visitLine = () =>
    Boolean.match(Number.greaterThanOrEqualTo(MutableRef.get(currentCursor).segmentIndex, segmentCount(kernel)), {
      onFalse: () => {
        const cursor = MutableRef.get(currentCursor)
        resetLineScanState(walkFrame.scan, cursor)
        MutableRef.set(walkFrame.record, Option.none())
        MutableRef.set(
          walkFrame.fitLimit,
          Number.sum(maxWidthAtLine(MutableRef.get(currentLineIndex)), kernel.lineFitEpsilon)
        )
        MutableRef.set(walkFrame.segmentLimit, segmentLimitForCursor(kernel, cursor))
        return Option.match(
          scanLineRecord(kernel, walkFrame),
          {
            onNone: () => true,
            onSome: (record) => {
              visitRecord(record, MutableRef.get(currentLineIndex))
              MutableRef.set(currentCursor, record.nextCursor)
              MutableRef.increment(currentLineIndex)
              return false
            }
          }
        )
      },
      onTrue: () => true
    })

  Boolean.match(Arr.some(lineWalkBatch, visitLine), {
    onFalse: () => Iterable.some(Iterable.range(0), () => Arr.some(lineWalkBatch, visitLine)),
    onTrue: () => true
  })

  return Number.subtract(MutableRef.get(currentLineIndex), lineIndex)
}

const walkLineValues = <A>(
  kernel: Prepared.Kernel,
  maxWidthAtLine: (lineIndex: number) => number,
  project: (record: InternalLineRecord, lineIndex: number) => A,
  lineIndex: number = 0,
  cursor: Text.Cursor = cursorAt(0)
): ReadonlyArray<A> => {
  const walkFrame = initialLineWalkFrame(cursor)

  return Arr.unfold(
    lineIndex,
    (currentLineIndex) =>
      Boolean.match(Number.greaterThanOrEqualTo(MutableRef.get(walkFrame.cursor).segmentIndex, segmentCount(kernel)), {
        onFalse: () => {
          const currentCursor = MutableRef.get(walkFrame.cursor)
          resetLineScanState(walkFrame.scan, currentCursor)
          MutableRef.set(walkFrame.record, Option.none())
          MutableRef.set(
            walkFrame.fitLimit,
            Number.sum(maxWidthAtLine(currentLineIndex), kernel.lineFitEpsilon)
          )
          MutableRef.set(walkFrame.segmentLimit, segmentLimitForCursor(kernel, currentCursor))

          return scanLineRecord(kernel, walkFrame).pipe(
            Option.map((record) => {
              MutableRef.set(walkFrame.cursor, record.nextCursor)
              return Tuple.make(project(record, currentLineIndex), Number.increment(currentLineIndex))
            })
          )
        },
        onTrue: () => Option.none()
      })
  )
}

const fallbackLevelForDirection: (direction: Text.Direction) => number = Match.type<Text.Direction>().pipe(
  Match.when("ltr", () => 0),
  Match.when("rtl", () => 1),
  Match.exhaustive
)

const visualUnitsForRecord = (
  compilation: Prepared.Compilation,
  record: InternalLineRecord
) =>
  Boolean.match(cursorEquals(record.start, record.end), {
    onTrue: Arr.empty,
    onFalse: () => {
      const lastSegment = Boolean.match(Number.Equivalence(record.end.graphemeIndex, 0), {
        onTrue: () => Number.decrement(record.end.segmentIndex),
        onFalse: () => record.end.segmentIndex
      })
      return Arr.flatMap(
        Arr.range(record.start.segmentIndex, lastSegment),
        (segmentIndex) => {
          const units = runtimeSegmentAt(compilation.kernel, segmentIndex).visualOrderUnits
          const start = Boolean.match(Number.Equivalence(segmentIndex, record.start.segmentIndex), {
            onTrue: () => record.start.graphemeIndex,
            onFalse: () => 0
          })
          const end = Boolean.match(Number.Equivalence(segmentIndex, record.end.segmentIndex), {
            onTrue: () => record.end.graphemeIndex,
            onFalse: () => Arr.length(units)
          })
          return Boolean.match(Boolean.and(Number.Equivalence(start, 0), Number.Equivalence(end, Arr.length(units))), {
            onTrue: () => units,
            onFalse: () => Arr.map(Arr.range(start, Number.decrement(end)), (index) => Arr.unsafeGet(units, index))
          })
        }
      )
    }
  })

const visualTextForRecord = (compilation: Prepared.Compilation, record: InternalLineRecord): string => {
  const units = visualUnitsForRecord(compilation, record)
  const fallbackLevel = Arr.last(units).pipe(
    Option.map(visualOrderUnitLevel),
    Option.getOrElse(() => fallbackLevelForDirection(compilation.kernel.baseDirection))
  )

  return projectVisualText(units, record.insertedBreakText, fallbackLevel)
}

const materializeLine = (
  compilation: Prepared.Compilation,
  lineIndex: number,
  record: InternalLineRecord
): Text.Line => ({
  baseDirection: compilation.kernel.baseDirection,
  index: lineIndex,
  order: "visual",
  text: visualTextForRecord(compilation, record),
  width: record.width
})

/**
 * Summarizes layout from the canonical walker without materializing line text.
 *
 * @since 0.2.0
 * @category internals
 */
export const summarizeLines = (kernel: Prepared.Kernel, request: Text.Request): Text.Summary => {
  const maxLineWidth = MutableRef.make(0)
  const lineCount = forEachLineRecord(kernel, () => request.maxWidth, (record) => {
    MutableRef.set(maxLineWidth, Number.max(MutableRef.get(maxLineWidth), record.width))
  })

  return {
    height: Number.multiply(lineCount, request.lineHeight),
    lineCount,
    maxLineWidth: MutableRef.get(maxLineWidth)
  }
}

const rememberCursorHint = (
  cursor: Text.Cursor,
  cursorHints: MutableRef.MutableRef<HashMap.HashMap<CursorHintKey, number>>,
  maxWidth: number,
  lineIndex: number
): Text.Cursor => {
  MutableRef.update(cursorHints, HashMap.set(cursorHintKey(maxWidth, cursor), lineIndex))

  return cursor
}

const rememberedCursorLineIndex = (
  cursor: Text.Cursor,
  cursorHints: MutableRef.MutableRef<HashMap.HashMap<CursorHintKey, number>>,
  maxWidth: number
): Option.Option<number> => HashMap.get(MutableRef.get(cursorHints), cursorHintKey(maxWidth, cursor))

const cursorIsBefore = Order.lessThan(cursorOrder)

const countLinesBeforeCursor = (
  kernel: Prepared.Kernel,
  request: Text.Request,
  targetCursor: Text.Cursor
): number =>
  Iterable.size(
    Iterable.unfold(cursorAt(0), (cursor) =>
      Boolean.match(cursorIsBefore(cursor, targetCursor), {
        onFalse: () => Option.none(),
        onTrue: () =>
          walkNextLineRecord(kernel, request.maxWidth, cursor).pipe(
            Option.filter((record) => Boolean.not(cursorIsBefore(targetCursor, record.nextCursor))),
            Option.map((record) => Tuple.make(record.nextCursor, record.nextCursor))
          )
      }))
  )

/**
 * Materializes visual line text from walked line records.
 *
 * @since 0.2.0
 * @category internals
 */
export const materializeLines = (
  compilation: Prepared.Compilation,
  request: Text.Request,
  maxWidthAtLine: (lineIndex: number) => number = () => request.maxWidth
): Text.Lines =>
  walkLineValues(
    compilation.kernel,
    maxWidthAtLine,
    (record, lineIndex) => materializeLine(compilation, lineIndex, record)
  )

/**
 * Materializes lines and derives summary from one walk pass.
 *
 * @since 0.2.0
 * @category internals
 */
export const materializeLinesWithSummary = (
  compilation: Prepared.Compilation,
  request: Text.Request
): Text.Layout => {
  const lines = materializeLines(compilation, request)

  return {
    summary: {
      height: Number.multiply(Arr.length(lines), request.lineHeight),
      lineCount: Arr.length(lines),
      maxLineWidth: Arr.reduce(lines, 0, (maxWidth, line) => Number.max(maxWidth, line.width))
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
  compilation: Prepared.Compilation,
  request: Text.Request,
  cursor: Text.Cursor,
  lineIndexHint: Option.Option<number> = Option.none()
): Option.Option<Text.LineStep> => {
  const cursorHints = compilation.surface.cursorHints

  return walkNextLineRecord(compilation.kernel, request.maxWidth, cursor).pipe(
    Option.map((record): Text.LineStep => {
      const lineIndex = Option.orElse(
        lineIndexHint,
        () => rememberedCursorLineIndex(cursor, cursorHints, request.maxWidth)
      ).pipe(Option.getOrElse(() => countLinesBeforeCursor(compilation.kernel, request, cursor)))

      return Tuple.make(
        materializeLine(compilation, lineIndex, record),
        rememberCursorHint(record.nextCursor, cursorHints, request.maxWidth, Number.increment(lineIndex))
      )
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
  compilation: Prepared.Compilation,
  request: Text.Request,
  maxWidthAtLine: (lineIndex: number) => number = () => request.maxWidth
): Text.LineRanges =>
  walkLineValues(
    compilation.kernel,
    maxWidthAtLine,
    (record) => ({
      baseDirection: compilation.kernel.baseDirection,
      end: record.end,
      order: "visual",
      start: record.start,
      width: record.width
    })
  )

/**
 * Measures the widest hard-break chunk in prepared text without re-walking line breaks.
 *
 * @since 0.2.0
 * @category internals
 */
export const measureNaturalWidth = (kernel: Prepared.Kernel): number => {
  const paintWidth = MutableRef.make(0)
  return Arr.reduce(kernel.runtime.segments, 0, (maxWidth, segment, index) => {
    const currentWidth = MutableRef.get(paintWidth)
    const width = Number.sum(
      currentWidth,
      Boolean.match(String.Equivalence(segment.breakKind, "tab"), {
        onTrue: () => resolveTabAdvance(currentWidth, kernel.runtime.tabStopAdvance),
        onFalse: () => segment.paintAdvance
      })
    )
    return Boolean.match(Number.Equivalence(Number.increment(index), segment.chunkEndSegmentIndex), {
      onFalse: () => {
        MutableRef.set(paintWidth, width)
        return maxWidth
      },
      onTrue: () => {
        MutableRef.set(paintWidth, 0)
        return Number.max(maxWidth, width)
      }
    })
  })
}
