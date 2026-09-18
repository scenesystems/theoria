/**
 * Pure prepared-table walker for line fitting, visual materialization, and cursor ranges.
 *
 * @since 0.1.0
 */
import { Boolean, Chunk, Data, Match, Number, Option, Order, RedBlackTree, Schema, String, Tuple } from "effect"
import * as Arr from "effect/Array"
import * as HashMap from "effect/HashMap"
import * as Iterable from "effect/Iterable"
import * as MutableRef from "effect/MutableRef"

import type * as Text from "../Text.js"
import { projectVisualText, VisualOrderUnit } from "./bidi.js"
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
  readonly baseDirection: Text.Direction
  readonly end: Text.Cursor
  readonly fitWidth: number
  readonly insertedBreakText: string
  readonly nextCursor: Text.Cursor
  readonly order: Text.Line["order"]
  readonly paintWidth: number
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
  readonly fitLimit: number
  readonly record: MutableRef.MutableRef<Option.Option<InternalLineRecord>>
  readonly scan: LineScanState
  readonly segmentLimit: number
}> {}

class LineRecordWalkState extends Data.Class<{
  readonly cursor: Text.Cursor
  readonly lineIndex: number
}> {}

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
      const remainder = Number.remainder(currentWidth, tabStopAdvance)

      return Boolean.match(Number.Equivalence(remainder, 0), {
        onFalse: () => Number.subtract(tabStopAdvance, remainder),
        onTrue: () => tabStopAdvance
      })
    },
    onTrue: () => 0
  })
}

const segmentAt = (compilation: Prepared.Compilation, segmentIndex: number) =>
  Arr.unsafeGet(compilation.surface.segments, segmentIndex)

const runtimeSegmentAt = (kernel: Prepared.Kernel, segmentIndex: number): Prepared.RuntimeSegment =>
  Arr.unsafeGet(kernel.runtime.segments, segmentIndex)

type IndexedWidthValues = ReadonlyArray<number>

const advanceCursorForSegment = (segment: Prepared.RuntimeSegment, cursor: Text.Cursor): Text.Cursor => {
  const remainsInSegment = Number.lessThan(
    Number.increment(cursor.graphemeIndex),
    segment.breakableGraphemeCount
  )

  return Boolean.match(remainsInSegment, {
    onFalse: () => cursorAt(Number.increment(cursor.segmentIndex)),
    onTrue: () => cursorAt(cursor.segmentIndex, Number.increment(cursor.graphemeIndex))
  })
}

const advanceCursor = (kernel: Prepared.Kernel, cursor: Text.Cursor): Text.Cursor =>
  advanceCursorForSegment(runtimeSegmentAt(kernel, cursor.segmentIndex), cursor)

const breakKindAtCursor = (segment: Prepared.RuntimeSegment, cursor: Text.Cursor): Prepared.BreakKind => {
  return Boolean.match(
    Number.lessThan(cursor.graphemeIndex, Number.decrement(segment.breakableGraphemeCount)),
    {
      onFalse: () => segment.breakKind,
      onTrue: () => "text"
    }
  )
}

const widthAtCursorOrElse = (
  widths: IndexedWidthValues,
  widthCount: number,
  cursor: Text.Cursor,
  fallback: number
): number =>
  Boolean.match(Number.lessThan(cursor.graphemeIndex, widthCount), {
    onFalse: () => fallback,
    onTrue: () => Arr.unsafeGet(widths, cursor.graphemeIndex)
  })

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

const emitInternalLineRecord = (
  kernel: Prepared.Kernel,
  start: Text.Cursor,
  end: Text.Cursor,
  nextCursor: Text.Cursor,
  fitWidth: number,
  paintWidth: number,
  insertedBreakText: string = ""
): InternalLineRecord =>
  new InternalLineRecord({
    baseDirection: kernel.baseDirection,
    end,
    fitWidth,
    insertedBreakText,
    nextCursor,
    order: "visual",
    paintWidth,
    start,
    width: paintWidth
  })

class ResolvedPendingState extends Data.Class<{
  readonly end: Text.Cursor
  readonly fitWidth: number
  readonly paintWidth: number
}> {}

const resolvePendingState = (
  kernel: Prepared.Kernel,
  state: LineScanState
): ResolvedPendingState => {
  const preservePending = Boolean.and(
    String.Equivalence(kernel.whiteSpace, "pre-wrap"),
    hasPendingWhitespace(state)
  )

  return Boolean.match(lineHasCommittedContent(state), {
    onFalse: () =>
      Boolean.match(preservePending, {
        onFalse: () => new ResolvedPendingState({ end: MutableRef.get(state.start), fitWidth: 0, paintWidth: 0 }),
        onTrue: () =>
          new ResolvedPendingState({
            end: MutableRef.get(state.pendingEnd),
            fitWidth: MutableRef.get(state.pendingFitWidth),
            paintWidth: MutableRef.get(state.pendingPaintWidth)
          })
      }),
    onTrue: () =>
      Boolean.match(preservePending, {
        onFalse: () =>
          new ResolvedPendingState({
            end: MutableRef.get(state.end),
            fitWidth: MutableRef.get(state.fitWidth),
            paintWidth: MutableRef.get(state.paintWidth)
          }),
        onTrue: () =>
          new ResolvedPendingState({
            end: MutableRef.get(state.pendingEnd),
            fitWidth: Number.sum(MutableRef.get(state.fitWidth), MutableRef.get(state.pendingFitWidth)),
            paintWidth: Number.sum(MutableRef.get(state.paintWidth), MutableRef.get(state.pendingPaintWidth))
          })
      })
  })
}

const finalizeAtEnd = (kernel: Prepared.Kernel, state: LineScanState): Option.Option<InternalLineRecord> => {
  const resolved = resolvePendingState(kernel, state)

  const empty = Boolean.and(
    Boolean.not(lineHasCommittedContent(state)),
    Boolean.and(Number.Equivalence(resolved.fitWidth, 0), Number.Equivalence(resolved.paintWidth, 0))
  )

  return Boolean.match(empty, {
    onFalse: () =>
      Option.some(
        emitInternalLineRecord(
          kernel,
          MutableRef.get(state.start),
          resolved.end,
          endCursorFor(kernel),
          resolved.fitWidth,
          resolved.paintWidth
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
  const resolved = resolvePendingState(kernel, state)

  return emitInternalLineRecord(
    kernel,
    MutableRef.get(state.start),
    resolved.end,
    nextCursor,
    resolved.fitWidth,
    resolved.paintWidth
  )
}

const finalizeBeforeCurrent = (
  kernel: Prepared.Kernel,
  state: LineScanState,
  nextCursor: Text.Cursor
): InternalLineRecord =>
  emitInternalLineRecord(
    kernel,
    MutableRef.get(state.start),
    MutableRef.get(state.end),
    nextCursor,
    MutableRef.get(state.fitWidth),
    MutableRef.get(state.paintWidth)
  )

const finalizeBeforePending = (
  kernel: Prepared.Kernel,
  state: LineScanState,
  currentCursor: Text.Cursor
): InternalLineRecord =>
  emitInternalLineRecord(
    kernel,
    MutableRef.get(state.start),
    MutableRef.get(state.end),
    Boolean.match(String.Equivalence(kernel.whiteSpace, "normal"), {
      onTrue: () => currentCursor,
      onFalse: () => Option.getOrElse(MutableRef.get(state.pendingStart), () => currentCursor)
    }),
    MutableRef.get(state.fitWidth),
    MutableRef.get(state.paintWidth)
  )

const finalizeBreakCandidate = (
  kernel: Prepared.Kernel,
  candidate: BreakCandidate,
  start: Text.Cursor
): InternalLineRecord =>
  emitInternalLineRecord(
    kernel,
    start,
    candidate.end,
    candidate.nextCursor,
    Number.sum(candidate.fitWidth, candidate.insertedWidth),
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
      MutableRef.set(
        state.pendingFitWidth,
        Number.sum(
          pendingFitWidth,
          resolveTabAdvance(
            Number.sum(MutableRef.get(state.fitWidth), pendingFitWidth),
            kernel.runtime.tabStopAdvance
          )
        )
      )
      MutableRef.set(
        state.pendingPaintWidth,
        Number.sum(
          pendingPaintWidth,
          resolveTabAdvance(
            Number.sum(MutableRef.get(state.paintWidth), pendingPaintWidth),
            kernel.runtime.tabStopAdvance
          )
        )
      )
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
  Iterable.head(RedBlackTree.greaterThan(kernel.runtime.chunksByEnd, cursor.segmentIndex)).pipe(
    Option.map(Tuple.getFirst),
    Option.getOrElse(() => segmentCount(kernel))
  )

const lineFrameIsComplete = (frame: LineWalkFrame, cursor: Text.Cursor): boolean => {
  return Boolean.or(
    Option.isSome(MutableRef.get(frame.record)),
    Number.greaterThanOrEqualTo(cursor.segmentIndex, frame.segmentLimit)
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
  Boolean.match(lineHasCommittedContent(scan), {
    onFalse: () => {
      MutableRef.set(frame.cursor, nextCursor)
      startLineWithSegment(kernel, segment, kind, scan, currentCursor, nextCursor)
    },
    onTrue: () => {
      const pendingFitWidth = Number.sum(MutableRef.get(scan.fitWidth), MutableRef.get(scan.pendingFitWidth))
      const candidateFitWidth = Number.sum(
        pendingFitWidth,
        resolveFitAdvanceAtCursor(segment, currentCursor)
      )
      return Boolean.match(Number.lessThanOrEqualTo(candidateFitWidth, frame.fitLimit), {
        onFalse: () =>
          Boolean.match(hasPendingWhitespace(scan), {
            onFalse: () => {
              const breakCandidate = chooseBreakCandidate(
                MutableRef.get(scan.breakCandidates),
                frame.fitLimit,
                kernel.preferEarlySoftHyphenBreak
              )

              MutableRef.set(
                frame.record,
                Option.match(breakCandidate, {
                  onNone: () => Option.some(finalizeBeforeCurrent(kernel, scan, currentCursor)),
                  onSome: (candidate) =>
                    Option.some(finalizeBreakCandidate(kernel, candidate, MutableRef.get(scan.start)))
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
        }
      })
    }
  })
}

const isWhitespaceBreak = (kind: Prepared.BreakKind): boolean =>
  Boolean.match(String.Equivalence(kind, "space"), {
    onFalse: () =>
      Boolean.match(String.Equivalence(kind, "preserved-space"), {
        onFalse: () => String.Equivalence(kind, "tab"),
        onTrue: () => true
      }),
    onTrue: () => true
  })

const advanceLineFrame = (
  kernel: Prepared.Kernel,
  frame: LineWalkFrame,
  cursor: Text.Cursor
): void => {
  const segment = runtimeSegmentAt(kernel, cursor.segmentIndex)
  const kind = breakKindAtCursor(segment, cursor)
  const nextCursor = advanceCursorForSegment(segment, cursor)

  Boolean.match(String.Equivalence(kind, "text"), {
    onFalse: () =>
      Boolean.match(String.Equivalence(kind, "hard-break"), {
        onFalse: () =>
          Boolean.match(isWhitespaceBreak(kind), {
            onFalse: () =>
              Boolean.match(String.Equivalence(kind, "zero-width-break"), {
                onFalse: () => advanceContentFrame(kernel, segment, kind, frame, cursor, nextCursor),
                onTrue: () => advanceZeroWidthBreakFrame(kernel, segment, frame, cursor, nextCursor)
              }),
            onTrue: () => advanceWhitespaceFrame(kernel, segment, kind, frame, cursor, nextCursor)
          }),
        onTrue: () => advanceHardBreakFrame(kernel, segment, frame, cursor, nextCursor)
      }),
    onTrue: () => advanceContentFrame(kernel, segment, kind, frame, cursor, nextCursor)
  })
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
        fitLimit: Number.sum(maxWidth, kernel.lineFitEpsilon),
        record: MutableRef.make(Option.none()),
        scan: initialLineScanState(cursor),
        segmentLimit: segmentLimitForCursor(kernel, cursor)
      })
      Iterable.some(Iterable.range(0), () => {
        const currentCursor = MutableRef.get(initial.cursor)
        return Boolean.match(lineFrameIsComplete(initial, currentCursor), {
          onFalse: () => {
            advanceLineFrame(kernel, initial, currentCursor)
            return false
          },
          onTrue: () => true
        })
      })

      return Option.orElse(
        MutableRef.get(initial.record),
        () => finalizeAtEnd(kernel, initial.scan)
      )
    },
    onTrue: () => Option.none()
  })

const walkLineValues = <A>(
  kernel: Prepared.Kernel,
  maxWidthAtLine: (lineIndex: number) => number,
  project: (record: InternalLineRecord, lineIndex: number) => A,
  lineIndex: number = 0,
  cursor: Text.Cursor = cursorAt(0)
): ReadonlyArray<A> =>
  Arr.unfold(
    new LineRecordWalkState({ cursor, lineIndex }),
    (state) =>
      Boolean.match(Number.greaterThanOrEqualTo(state.cursor.segmentIndex, segmentCount(kernel)), {
        onFalse: () =>
          walkNextLineRecord(kernel, maxWidthAtLine(state.lineIndex), state.cursor).pipe(
            Option.map((record) =>
              Tuple.make(
                project(record, state.lineIndex),
                new LineRecordWalkState({
                  cursor: record.nextCursor,
                  lineIndex: Number.increment(state.lineIndex)
                })
              )
            )
          ),
        onTrue: Option.none
      })
  )

const visualOrderUnitAtCursor = (
  compilation: Prepared.Compilation,
  cursor: Text.Cursor
): VisualOrderUnit => {
  const segment = segmentAt(compilation, cursor.segmentIndex)
  const runtimeSegment = runtimeSegmentAt(compilation.kernel, cursor.segmentIndex)

  return Match.value(segment.kind).pipe(
    Match.when("text", () => {
      const text = Chunk.unsafeGet(segment.graphemes, cursor.graphemeIndex)
      return new VisualOrderUnit({
        level: Arr.unsafeGet(runtimeSegment.graphemeBidiLevels, cursor.graphemeIndex),
        mirroredText: Arr.unsafeGet(runtimeSegment.mirroredGraphemes, cursor.graphemeIndex),
        text
      })
    }),
    Match.when("space", () =>
      new VisualOrderUnit({
        level: segment.bidiLevel,
        mirroredText: segment.text,
        text: segment.text
      })),
    Match.when("tab", () =>
      new VisualOrderUnit({
        level: segment.bidiLevel,
        mirroredText: segment.text,
        text: segment.text
      })),
    Match.when("hard-break", () =>
      new VisualOrderUnit({
        level: segment.bidiLevel,
        mirroredText: segment.text,
        text: segment.text
      })),
    Match.exhaustive
  )
}

const visualUnitsForRecord = (
  compilation: Prepared.Compilation,
  record: InternalLineRecord
) =>
  Chunk.unsafeFromArray(Arr.unfold(
    record.start,
    (cursor) =>
      Boolean.match(cursorEquals(cursor, record.end), {
        onFalse: () =>
          Option.some(
            Tuple.make(
              visualOrderUnitAtCursor(compilation, cursor),
              advanceCursor(compilation.kernel, cursor)
            )
          ),
        onTrue: Option.none
      })
  ))

const visualTextForRecord = (compilation: Prepared.Compilation, record: InternalLineRecord): string => {
  const units = visualUnitsForRecord(compilation, record)
  const fallbackLevel = Chunk.last(units).pipe(
    Option.map((unit) => unit.level),
    Option.getOrElse(() =>
      Match.value(compilation.kernel.baseDirection).pipe(
        Match.when("ltr", () => 0),
        Match.when("rtl", () => 1),
        Match.exhaustive
      )
    )
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

const measureChunkWidth = (
  kernel: Prepared.Kernel,
  startSegmentIndex: number,
  segmentLimit: number
): number =>
  Arr.reduce(
    Arr.drop(Arr.take(kernel.runtime.segments, segmentLimit), startSegmentIndex),
    0,
    (paintWidth, segment) =>
      Number.sum(
        paintWidth,
        Boolean.match(String.Equivalence(segment.breakKind, "tab"), {
          onTrue: () => resolveTabAdvance(paintWidth, kernel.runtime.tabStopAdvance),
          onFalse: () => segment.paintAdvance
        })
      )
  )

/**
 * Summarizes layout from the canonical walker without materializing line text.
 *
 * @since 0.2.0
 * @category internals
 */
export const summarizeLines = (kernel: Prepared.Kernel, request: Text.Request): Text.Summary =>
  Arr.reduce(
    walkLineValues(kernel, () => request.maxWidth, (record) => record.width),
    {
      height: 0,
      lineCount: 0,
      maxLineWidth: 0
    },
    (summary, width) => ({
      height: Number.sum(summary.height, request.lineHeight),
      lineCount: Number.increment(summary.lineCount),
      maxLineWidth: Number.max(summary.maxLineWidth, width)
    })
  )

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
  const lines = walkLineValues(
    compilation.kernel,
    () => request.maxWidth,
    (record, lineIndex) => materializeLine(compilation, lineIndex, record)
  )

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
      baseDirection: record.baseDirection,
      end: record.end,
      order: record.order,
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
export const measureNaturalWidth = (kernel: Prepared.Kernel): number =>
  Chunk.reduce(kernel.runtime.chunks, 0, (maxWidth, chunk) => {
    const chunkWidth = measureChunkWidth(kernel, chunk.startSegmentIndex, chunk.consumedEndSegmentIndex)

    return Number.max(maxWidth, chunkWidth)
  })
