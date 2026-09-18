/**
 * Pure prepared-table walker for line fitting, visual materialization, and cursor ranges.
 *
 * @since 0.1.0
 */
import {
  Boolean,
  Chunk,
  Data,
  Equivalence,
  Match,
  Number,
  Option,
  Order,
  RedBlackTree,
  Schema,
  String,
  Tuple
} from "effect"
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

type BreakCandidates = Chunk.Chunk<BreakCandidate>

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

type InternalLineRecords = Chunk.Chunk<InternalLineRecord>

class LineScanState extends Data.Class<{
  readonly breakCandidates: BreakCandidates
  readonly end: Text.Cursor
  readonly fitWidth: number
  readonly paintWidth: number
  readonly pendingEnd: Text.Cursor
  readonly pendingFitWidth: number
  readonly pendingPaintWidth: number
  readonly pendingStart: Option.Option<Text.Cursor>
  readonly start: Text.Cursor
}> {}

class LineWalkFrame extends Data.Class<{
  readonly cursor: Text.Cursor
  readonly maxWidth: number
  readonly record: Option.Option<InternalLineRecord>
  readonly scan: LineScanState
  readonly segmentLimit: number
}> {}

class VisualUnitCursorState extends Data.Class<{
  readonly cursor: Text.Cursor
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

const zeroCursor = cursorAt(0)

const emptyState = new LineScanState({
  breakCandidates: Chunk.empty(),
  end: zeroCursor,
  fitWidth: 0,
  paintWidth: 0,
  pendingEnd: zeroCursor,
  pendingFitWidth: 0,
  pendingPaintWidth: 0,
  pendingStart: Option.none(),
  start: zeroCursor
})

const segmentCount = (kernel: Prepared.Kernel): number => kernel.runtime.segments.length

const cursorEquals = Equivalence.struct({ segmentIndex: Number.Equivalence, graphemeIndex: Number.Equivalence })
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
  Chunk.get(compilation.surface.segments, segmentIndex)

const runtimeSegmentAt = (kernel: Prepared.Kernel, segmentIndex: number): Option.Option<Prepared.RuntimeSegment> =>
  Chunk.get(kernel.runtime.segments, segmentIndex)

type WidthValues = Chunk.Chunk<number>
type StringValues = Chunk.Chunk<string>

const breakableGraphemeWidthsAt = (kernel: Prepared.Kernel, segmentIndex: number): WidthValues =>
  Option.match(runtimeSegmentAt(kernel, segmentIndex), {
    onSome: (segment) => segment.breakableGraphemeWidths,
    onNone: Chunk.empty<number>
  })

const graphemeBidiLevelsAt = (kernel: Prepared.Kernel, segmentIndex: number): WidthValues =>
  runtimeSegmentAt(kernel, segmentIndex).pipe(
    Option.map((segment) => segment.graphemeBidiLevels),
    Option.getOrElse(Chunk.empty<number>)
  )

const mirroredGraphemesAt = (kernel: Prepared.Kernel, segmentIndex: number): StringValues =>
  runtimeSegmentAt(kernel, segmentIndex).pipe(
    Option.map((segment) => segment.mirroredGraphemes),
    Option.getOrElse(Chunk.empty<string>)
  )

const advanceFromPrefixWidths = (
  prefixWidths: WidthValues,
  graphemeIndex: number,
  fallback: number
): number =>
  Boolean.match(Number.Equivalence(graphemeIndex, 0), {
    onFalse: () =>
      Number.subtract(
        Chunk.get(prefixWidths, graphemeIndex).pipe(Option.getOrElse(() => fallback)),
        Chunk.get(prefixWidths, Number.decrement(graphemeIndex)).pipe(Option.getOrElse(() => 0))
      ),
    onTrue: () => Chunk.head(prefixWidths).pipe(Option.getOrElse(() => fallback))
  })

const advanceCursor = (kernel: Prepared.Kernel, cursor: Text.Cursor): Text.Cursor => {
  const widths = breakableGraphemeWidthsAt(kernel, cursor.segmentIndex)
  const remainsInSegment = Number.lessThan(Number.increment(cursor.graphemeIndex), Chunk.size(widths))

  return Boolean.match(remainsInSegment, {
    onFalse: () => cursorAt(Number.increment(cursor.segmentIndex)),
    onTrue: () => cursorAt(cursor.segmentIndex, Number.increment(cursor.graphemeIndex))
  })
}

const breakKindAtCursor = (kernel: Prepared.Kernel, cursor: Text.Cursor): Prepared.BreakKind => {
  return Option.match(runtimeSegmentAt(kernel, cursor.segmentIndex), {
    onNone: () => "text",
    onSome: (segment) =>
      Boolean.match(
        Number.lessThan(cursor.graphemeIndex, Number.decrement(Chunk.size(segment.breakableGraphemeWidths))),
        {
          onFalse: () => segment.breakKind,
          onTrue: () => "text"
        }
      )
  })
}

const resolveFitAdvanceAtCursor = (
  kernel: Prepared.Kernel,
  cursor: Text.Cursor,
  currentFitWidth: number
): number =>
  Option.match(runtimeSegmentAt(kernel, cursor.segmentIndex), {
    onNone: () => 0,
    onSome: (segment) =>
      Boolean.match(String.Equivalence(segment.breakKind, "tab"), {
        onTrue: () => resolveTabAdvance(currentFitWidth, kernel.runtime.tabStopAdvance),
        onFalse: () =>
          Boolean.match(Chunk.isNonEmpty(segment.breakablePrefixWidths), {
            onFalse: () => segment.fitAdvance,
            onTrue: () =>
              advanceFromPrefixWidths(segment.breakablePrefixWidths, cursor.graphemeIndex, segment.fitAdvance)
          })
      })
  })

const resolvePaintAdvanceAtCursor = (
  kernel: Prepared.Kernel,
  cursor: Text.Cursor,
  currentPaintWidth: number
): number =>
  Option.match(runtimeSegmentAt(kernel, cursor.segmentIndex), {
    onNone: () => 0,
    onSome: (segment) =>
      Boolean.match(String.Equivalence(segment.breakKind, "tab"), {
        onTrue: () => resolveTabAdvance(currentPaintWidth, kernel.runtime.tabStopAdvance),
        onFalse: () =>
          Option.getOrElse(Chunk.get(segment.breakableGraphemeWidths, cursor.graphemeIndex), () => segment.paintAdvance)
      })
  })

const appendDiscretionaryBreakCandidate = (
  candidates: BreakCandidates,
  kernel: Prepared.Kernel,
  cursor: Text.Cursor,
  end: Text.Cursor,
  fitWidth: number,
  paintWidth: number
): BreakCandidates => {
  const kind = breakKindAtCursor(kernel, cursor)
  return Boolean.match(isDiscretionaryBreak(kind), {
    onFalse: () => candidates,
    onTrue: () =>
      Chunk.append(
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
  })
}

const isDiscretionaryBreak = Match.type<Prepared.BreakKind>().pipe(
  Match.whenOr("soft-hyphen", "dictionary-hyphen", () => true),
  Match.whenOr("text", "space", "preserved-space", "hard-break", "tab", "glue", "zero-width-break", () => false),
  Match.exhaustive
)

const explicitBreakCandidate = (
  state: LineScanState,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): BreakCandidate =>
  new BreakCandidate({
    end: currentCursor,
    fitWidth: state.fitWidth,
    insertedText: "",
    insertedWidth: 0,
    kind: "explicit",
    nextCursor,
    paintWidth: state.paintWidth
  })

const breakCandidatesBeforeCommittedSegment = (
  kernel: Prepared.Kernel,
  state: LineScanState,
  currentCursor: Text.Cursor
): BreakCandidates =>
  Boolean.match(hasPendingWhitespace(state), {
    onFalse: () => state.breakCandidates,
    onTrue: () =>
      Chunk.of(
        Boolean.match(String.Equivalence(kernel.whiteSpace, "normal"), {
          onTrue: () => explicitBreakCandidate(state, state.end, currentCursor),
          onFalse: () =>
            new BreakCandidate({
              end: state.pendingEnd,
              fitWidth: Number.sum(state.fitWidth, state.pendingFitWidth),
              insertedText: String.empty,
              insertedWidth: 0,
              kind: "explicit",
              nextCursor: currentCursor,
              paintWidth: Number.sum(state.paintWidth, state.pendingPaintWidth)
            })
        })
      )
  })

const chooseBreakCandidate = (
  candidates: BreakCandidates,
  maxWidth: number,
  lineFitEpsilon: number,
  preferEarlySoftHyphenBreak: boolean
): Option.Option<BreakCandidate> => {
  const fittingCandidates = Chunk.filter(
    candidates,
    (candidate) =>
      Number.lessThanOrEqualTo(
        Number.sum(candidate.fitWidth, candidate.insertedWidth),
        Number.sum(maxWidth, lineFitEpsilon)
      )
  )

  const softHyphenCandidates = Chunk.filter(
    fittingCandidates,
    (candidate) => String.Equivalence(candidate.kind, "soft-hyphen")
  )
  const dictionaryHyphenCandidates = Chunk.filter(
    fittingCandidates,
    (candidate) => String.Equivalence(candidate.kind, "dictionary-hyphen")
  )
  const explicitBreakCandidates = Chunk.filter(
    fittingCandidates,
    (candidate) => String.Equivalence(candidate.kind, "explicit")
  )

  return Boolean.match(Chunk.isEmpty(fittingCandidates), {
    onFalse: () =>
      Boolean.match(Chunk.isNonEmpty(softHyphenCandidates), {
        onFalse: () =>
          Boolean.match(Chunk.isNonEmpty(dictionaryHyphenCandidates), {
            onFalse: () => Chunk.last(explicitBreakCandidates),
            onTrue: () => Chunk.last(dictionaryHyphenCandidates)
          }),
        onTrue: () =>
          Boolean.match(preferEarlySoftHyphenBreak, {
            onFalse: () => Chunk.last(softHyphenCandidates),
            onTrue: () => Chunk.head(softHyphenCandidates)
          })
      }),
    onTrue: Option.none
  })
}

const lineHasCommittedContent = (state: LineScanState): boolean =>
  Boolean.or(Number.greaterThan(state.paintWidth, 0), Boolean.not(cursorEquals(state.start, state.end)))

const hasPendingWhitespace = (state: LineScanState): boolean => Option.isSome(state.pendingStart)

const initialLineScanState = (cursor: Text.Cursor): LineScanState =>
  new LineScanState({
    ...emptyState,
    end: cursor,
    pendingEnd: cursor,
    start: cursor
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
        onFalse: () => new ResolvedPendingState({ end: state.start, fitWidth: 0, paintWidth: 0 }),
        onTrue: () =>
          new ResolvedPendingState({
            end: state.pendingEnd,
            fitWidth: state.pendingFitWidth,
            paintWidth: state.pendingPaintWidth
          })
      }),
    onTrue: () =>
      Boolean.match(preservePending, {
        onFalse: () =>
          new ResolvedPendingState({ end: state.end, fitWidth: state.fitWidth, paintWidth: state.paintWidth }),
        onTrue: () =>
          new ResolvedPendingState({
            end: state.pendingEnd,
            fitWidth: Number.sum(state.fitWidth, state.pendingFitWidth),
            paintWidth: Number.sum(state.paintWidth, state.pendingPaintWidth)
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
          state.start,
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

  return emitInternalLineRecord(kernel, state.start, resolved.end, nextCursor, resolved.fitWidth, resolved.paintWidth)
}

const finalizeBeforeCurrent = (
  kernel: Prepared.Kernel,
  state: LineScanState,
  nextCursor: Text.Cursor
): InternalLineRecord =>
  emitInternalLineRecord(kernel, state.start, state.end, nextCursor, state.fitWidth, state.paintWidth)

const finalizeBeforePending = (
  kernel: Prepared.Kernel,
  state: LineScanState,
  currentCursor: Text.Cursor
): InternalLineRecord =>
  emitInternalLineRecord(
    kernel,
    state.start,
    state.end,
    Boolean.match(String.Equivalence(kernel.whiteSpace, "normal"), {
      onTrue: () => currentCursor,
      onFalse: () => Option.getOrElse(state.pendingStart, () => currentCursor)
    }),
    state.fitWidth,
    state.paintWidth
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
  state: LineScanState,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): LineScanState => {
  const fitAdvance = resolveFitAdvanceAtCursor(kernel, currentCursor, Number.sum(state.fitWidth, state.pendingFitWidth))
  const paintAdvance = resolvePaintAdvanceAtCursor(
    kernel,
    currentCursor,
    Number.sum(state.paintWidth, state.pendingPaintWidth)
  )

  return new LineScanState({
    ...state,
    breakCandidates: Chunk.empty(),
    pendingEnd: nextCursor,
    pendingFitWidth: Number.sum(state.pendingFitWidth, fitAdvance),
    pendingPaintWidth: Number.sum(state.pendingPaintWidth, paintAdvance),
    pendingStart: Option.orElse(state.pendingStart, () => Option.some(currentCursor))
  })
}

const startLineWithSegment = (
  kernel: Prepared.Kernel,
  state: LineScanState,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): LineScanState => {
  const normal = String.Equivalence(kernel.whiteSpace, "normal")
  const leadingFitWidth = Boolean.match(normal, { onTrue: () => 0, onFalse: () => state.pendingFitWidth })
  const leadingPaintWidth = Boolean.match(normal, { onTrue: () => 0, onFalse: () => state.pendingPaintWidth })
  const fitWidth = Number.sum(leadingFitWidth, resolveFitAdvanceAtCursor(kernel, currentCursor, leadingFitWidth))
  const paintWidth = Number.sum(
    leadingPaintWidth,
    resolvePaintAdvanceAtCursor(kernel, currentCursor, leadingPaintWidth)
  )

  return new LineScanState({
    ...state,
    breakCandidates: appendDiscretionaryBreakCandidate(
      Chunk.empty(),
      kernel,
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
    pendingStart: Option.none()
  })
}

const appendCommittedSegment = (
  kernel: Prepared.Kernel,
  state: LineScanState,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor,
  fitWidth: number
): LineScanState => {
  const pendingPaintWidth = Number.sum(state.paintWidth, state.pendingPaintWidth)
  const paintWidth = Number.sum(
    pendingPaintWidth,
    resolvePaintAdvanceAtCursor(kernel, currentCursor, pendingPaintWidth)
  )

  return new LineScanState({
    ...state,
    breakCandidates: appendDiscretionaryBreakCandidate(
      breakCandidatesBeforeCommittedSegment(kernel, state, currentCursor),
      kernel,
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
    pendingStart: Option.none()
  })
}

const segmentLimitForCursor = (kernel: Prepared.Kernel, cursor: Text.Cursor): number =>
  Iterable.head(RedBlackTree.greaterThan(kernel.runtime.chunksByEnd, cursor.segmentIndex)).pipe(
    Option.map(Tuple.getFirst),
    Option.getOrElse(() => segmentCount(kernel))
  )

const lineFrameIsComplete = (kernel: Prepared.Kernel, frame: LineWalkFrame): boolean =>
  Boolean.or(
    Option.isSome(frame.record),
    Boolean.or(
      Number.greaterThanOrEqualTo(frame.cursor.segmentIndex, segmentCount(kernel)),
      Number.greaterThanOrEqualTo(frame.cursor.segmentIndex, frame.segmentLimit)
    )
  )

const advanceWhitespaceFrame = (
  kernel: Prepared.Kernel,
  frame: LineWalkFrame,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): LineWalkFrame => {
  const ignoreLeading = Boolean.and(
    String.Equivalence(kernel.whiteSpace, "normal"),
    Boolean.not(lineHasCommittedContent(frame.scan))
  )

  return Boolean.match(ignoreLeading, {
    onFalse: () =>
      new LineWalkFrame({
        ...frame,
        cursor: nextCursor,
        scan: appendPendingWhitespace(kernel, frame.scan, currentCursor, nextCursor)
      }),
    onTrue: () =>
      new LineWalkFrame({
        ...frame,
        cursor: nextCursor,
        scan: new LineScanState({
          ...frame.scan,
          end: nextCursor,
          pendingEnd: nextCursor,
          start: nextCursor
        })
      })
  })
}

const advanceZeroWidthBreakFrame = (
  frame: LineWalkFrame,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): LineWalkFrame =>
  Boolean.match(lineHasCommittedContent(frame.scan), {
    onFalse: () =>
      new LineWalkFrame({
        ...frame,
        cursor: nextCursor,
        scan: new LineScanState({
          ...frame.scan,
          end: nextCursor,
          pendingEnd: nextCursor,
          start: nextCursor
        })
      }),
    onTrue: () =>
      new LineWalkFrame({
        ...frame,
        cursor: nextCursor,
        scan: new LineScanState({
          ...frame.scan,
          breakCandidates: Chunk.append(
            frame.scan.breakCandidates,
            explicitBreakCandidate(frame.scan, currentCursor, nextCursor)
          )
        })
      })
  })

const advanceContentFrame = (
  kernel: Prepared.Kernel,
  frame: LineWalkFrame,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): LineWalkFrame => {
  const pendingFitWidth = Number.sum(frame.scan.fitWidth, frame.scan.pendingFitWidth)
  const candidateFitWidth = Number.sum(
    pendingFitWidth,
    resolveFitAdvanceAtCursor(kernel, currentCursor, pendingFitWidth)
  )
  const candidateFits = Number.lessThanOrEqualTo(
    candidateFitWidth,
    Number.sum(frame.maxWidth, kernel.lineFitEpsilon)
  )

  return Boolean.match(lineHasCommittedContent(frame.scan), {
    onFalse: () =>
      new LineWalkFrame({
        ...frame,
        cursor: nextCursor,
        scan: startLineWithSegment(kernel, frame.scan, currentCursor, nextCursor)
      }),
    onTrue: () =>
      Boolean.match(candidateFits, {
        onFalse: () =>
          Boolean.match(hasPendingWhitespace(frame.scan), {
            onFalse: () => {
              const breakCandidate = chooseBreakCandidate(
                frame.scan.breakCandidates,
                frame.maxWidth,
                kernel.lineFitEpsilon,
                kernel.preferEarlySoftHyphenBreak
              )

              return new LineWalkFrame({
                ...frame,
                record: Option.match(breakCandidate, {
                  onNone: () => Option.some(finalizeBeforeCurrent(kernel, frame.scan, currentCursor)),
                  onSome: (candidate) => Option.some(finalizeBreakCandidate(kernel, candidate, frame.scan.start))
                })
              })
            },
            onTrue: () =>
              new LineWalkFrame({
                ...frame,
                record: Option.some(finalizeBeforePending(kernel, frame.scan, currentCursor))
              })
          }),
        onTrue: () =>
          new LineWalkFrame({
            ...frame,
            cursor: nextCursor,
            scan: appendCommittedSegment(kernel, frame.scan, currentCursor, nextCursor, candidateFitWidth)
          })
      })
  })
}

const advanceByBreakKind = Match.type<Prepared.BreakKind>().pipe(
  Match.when(
    "hard-break",
    () => (kernel: Prepared.Kernel, frame: LineWalkFrame, _current: Text.Cursor, next: Text.Cursor) =>
      new LineWalkFrame({ ...frame, cursor: next, record: Option.some(finalizeAtHardBreak(kernel, frame.scan, next)) })
  ),
  Match.whenOr("space", "preserved-space", "tab", () => advanceWhitespaceFrame),
  Match.when(
    "zero-width-break",
    () => (_kernel: Prepared.Kernel, frame: LineWalkFrame, current: Text.Cursor, next: Text.Cursor) =>
      advanceZeroWidthBreakFrame(frame, current, next)
  ),
  Match.whenOr("text", "soft-hyphen", "dictionary-hyphen", "glue", () => advanceContentFrame),
  Match.exhaustive
)

const advanceLineFrame = (kernel: Prepared.Kernel, frame: LineWalkFrame): LineWalkFrame =>
  advanceByBreakKind(breakKindAtCursor(kernel, frame.cursor))(
    kernel,
    frame,
    frame.cursor,
    advanceCursor(kernel, frame.cursor)
  )

const walkNextLineRecord = (
  kernel: Prepared.Kernel,
  maxWidth: number,
  cursor: Text.Cursor
): Option.Option<InternalLineRecord> => {
  const initial = new LineWalkFrame({
    cursor,
    maxWidth,
    record: Option.none(),
    scan: initialLineScanState(cursor),
    segmentLimit: segmentLimitForCursor(kernel, cursor)
  })
  const terminalFrame = Iterable.reduce(
    Iterable.unfold(initial, (frame) =>
      Boolean.match(lineFrameIsComplete(kernel, frame), {
        onFalse: () => {
          const next = advanceLineFrame(kernel, frame)
          return Option.some(Tuple.make(next, next))
        },
        onTrue: Option.none
      })),
    initial,
    (_previous, current) => current
  )

  return Boolean.match(Number.greaterThanOrEqualTo(cursor.segmentIndex, segmentCount(kernel)), {
    onFalse: () => Option.orElse(terminalFrame.record, () => finalizeAtEnd(kernel, terminalFrame.scan)),
    onTrue: Option.none
  })
}

const walkLineRecords = (
  kernel: Prepared.Kernel,
  maxWidthAtLine: (lineIndex: number) => number,
  lineIndex: number = 0,
  cursor: Text.Cursor = cursorAt(0)
): InternalLineRecords =>
  Chunk.fromIterable(Iterable.unfold(
    new LineRecordWalkState({ cursor, lineIndex }),
    (state) =>
      Boolean.match(Number.greaterThanOrEqualTo(state.cursor.segmentIndex, segmentCount(kernel)), {
        onFalse: () =>
          walkNextLineRecord(kernel, maxWidthAtLine(state.lineIndex), state.cursor).pipe(
            Option.map((record) =>
              Tuple.make(
                record,
                new LineRecordWalkState({
                  cursor: record.nextCursor,
                  lineIndex: Number.increment(state.lineIndex)
                })
              )
            )
          ),
        onTrue: Option.none
      })
  ))

const visualOrderUnitAtCursor = (
  compilation: Prepared.Compilation,
  cursor: Text.Cursor
): VisualOrderUnit => {
  const segment = segmentAt(compilation, cursor.segmentIndex)
  const fallbackLevel = Match.value(compilation.kernel.baseDirection).pipe(
    Match.when("ltr", () => 0),
    Match.when("rtl", () => 1),
    Match.exhaustive
  )
  const graphemeBidiLevels = graphemeBidiLevelsAt(compilation.kernel, cursor.segmentIndex)
  const mirroredGraphemes = mirroredGraphemesAt(compilation.kernel, cursor.segmentIndex)

  return Option.match(segment, {
    onNone: () =>
      new VisualOrderUnit({
        level: fallbackLevel,
        mirroredText: "",
        text: ""
      }),
    onSome: (value) =>
      Match.value(value.kind).pipe(
        Match.when("text", () => {
          const text = Chunk.get(value.graphemes, cursor.graphemeIndex).pipe(Option.getOrElse(() => String.empty))
          return new VisualOrderUnit({
            level: Chunk.get(graphemeBidiLevels, cursor.graphemeIndex).pipe(
              Option.getOrElse(() => value.bidiLevel)
            ),
            mirroredText: Chunk.get(mirroredGraphemes, cursor.graphemeIndex).pipe(Option.getOrElse(() => text)),
            text
          })
        }),
        Match.when("space", () =>
          new VisualOrderUnit({
            level: value.bidiLevel,
            mirroredText: value.text,
            text: value.text
          })),
        Match.when("tab", () =>
          new VisualOrderUnit({
            level: value.bidiLevel,
            mirroredText: value.text,
            text: value.text
          })),
        Match.when("hard-break", () =>
          new VisualOrderUnit({
            level: value.bidiLevel,
            mirroredText: value.text,
            text: value.text
          })),
        Match.exhaustive
      )
  })
}

const visualUnitsForRecord = (
  compilation: Prepared.Compilation,
  record: InternalLineRecord
) =>
  Chunk.fromIterable(Iterable.unfold(
    new VisualUnitCursorState({ cursor: record.start }),
    (state: VisualUnitCursorState) =>
      Boolean.match(cursorEquals(state.cursor, record.end), {
        onFalse: () =>
          Option.some(
            Tuple.make(
              visualOrderUnitAtCursor(compilation, state.cursor),
              new VisualUnitCursorState({
                cursor: advanceCursor(compilation.kernel, state.cursor)
              })
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
  Chunk.reduce(
    Chunk.drop(Chunk.take(kernel.runtime.segments, segmentLimit), startSegmentIndex),
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
  Chunk.reduce(
    walkLineRecords(kernel, () => request.maxWidth),
    {
      height: 0,
      lineCount: 0,
      maxLineWidth: 0
    },
    (summary, record) => ({
      height: Number.sum(summary.height, request.lineHeight),
      lineCount: Number.increment(summary.lineCount),
      maxLineWidth: Number.max(summary.maxLineWidth, record.width)
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
  Chunk.map(
    walkLineRecords(compilation.kernel, maxWidthAtLine),
    (record, lineIndex) => materializeLine(compilation, lineIndex, record)
  ).pipe(Chunk.toReadonlyArray)

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
  const records = walkLineRecords(compilation.kernel, () => request.maxWidth)
  const lines = Chunk.map(records, (record, lineIndex) => materializeLine(compilation, lineIndex, record)).pipe(
    Chunk.toReadonlyArray
  )

  return {
    summary: {
      height: Number.multiply(records.length, request.lineHeight),
      lineCount: records.length,
      maxLineWidth: Chunk.reduce(records, 0, (maxWidth, record) => Number.max(maxWidth, record.width))
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
  Chunk.map(walkLineRecords(compilation.kernel, maxWidthAtLine), (record) => ({
    baseDirection: record.baseDirection,
    end: record.end,
    order: record.order,
    start: record.start,
    width: record.width
  })).pipe(Chunk.toReadonlyArray)

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
