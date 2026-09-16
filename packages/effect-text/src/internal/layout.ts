/**
 * Pure prepared-table walker for line fitting, visual materialization, and cursor ranges.
 *
 * @since 0.1.0
 */
import { Boolean, Data, Equivalence, Match, Number, Option, Order, RedBlackTree, Schema, String, Tuple } from "effect"
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

const BreakCandidates = Schema.Array(Schema.instanceOf(BreakCandidate))
type BreakCandidates = typeof BreakCandidates.Type

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

const InternalLineRecords = Schema.Array(Schema.instanceOf(InternalLineRecord))
type InternalLineRecords = typeof InternalLineRecords.Type

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
  readonly logicalIndex: number
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
  breakCandidates: Arr.empty(),
  end: zeroCursor,
  fitWidth: 0,
  paintWidth: 0,
  pendingEnd: zeroCursor,
  pendingFitWidth: 0,
  pendingPaintWidth: 0,
  pendingStart: Option.none(),
  start: zeroCursor
})

const segmentCount = (core: Text.Text): number => Arr.length(core.kernel.runtime.segments)

const cursorEquals = Equivalence.struct({ segmentIndex: Number.Equivalence, graphemeIndex: Number.Equivalence })
const cursorOrder = Order.struct({ segmentIndex: Order.number, graphemeIndex: Order.number })

const endCursorFor = (core: Text.Text): Text.Cursor => cursorAt(segmentCount(core))

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

const segmentAt = (
  core: Text.WithSegments,
  segmentIndex: number
) => Arr.get(core.logicalSurface.segments, segmentIndex)

const runtimeSegmentAt = (core: Text.Text, segmentIndex: number): Option.Option<Prepared.RuntimeSegment> =>
  Arr.get(core.kernel.runtime.segments, segmentIndex)

const breakKindAt = (core: Text.Text, segmentIndex: number): Prepared.BreakKind =>
  runtimeSegmentAt(core, segmentIndex).pipe(
    Option.map((segment) => segment.breakKind),
    Option.getOrElse((): Prepared.BreakKind => "text")
  )

const WidthValues = Schema.Array(Schema.Number)
type WidthValues = typeof WidthValues.Type
const StringValues = Schema.Array(Schema.String)
type StringValues = typeof StringValues.Type

const breakableGraphemeWidthsAt = (core: Text.Text, segmentIndex: number): WidthValues =>
  runtimeSegmentAt(core, segmentIndex).pipe(
    Option.map((segment) => segment.breakableGraphemeWidths),
    Option.getOrElse(Arr.empty<number>)
  )

const breakablePrefixWidthsAt = (core: Text.Text, segmentIndex: number): WidthValues =>
  runtimeSegmentAt(core, segmentIndex).pipe(
    Option.map((segment) => segment.breakablePrefixWidths),
    Option.getOrElse(Arr.empty<number>)
  )

const graphemeBidiLevelsAt = (core: Text.Text, segmentIndex: number): WidthValues =>
  runtimeSegmentAt(core, segmentIndex).pipe(
    Option.map((segment) => segment.graphemeBidiLevels),
    Option.getOrElse(Arr.empty<number>)
  )

const mirroredGraphemesAt = (core: Text.Text, segmentIndex: number): StringValues =>
  runtimeSegmentAt(core, segmentIndex).pipe(
    Option.map((segment) => segment.mirroredGraphemes),
    Option.getOrElse(Arr.empty<string>)
  )

const advanceFromPrefixWidths = (
  prefixWidths: WidthValues,
  graphemeIndex: number,
  fallback: number
): number =>
  Boolean.match(Number.Equivalence(graphemeIndex, 0), {
    onFalse: () =>
      Number.subtract(
        Arr.get(prefixWidths, graphemeIndex).pipe(Option.getOrElse(() => fallback)),
        Arr.get(prefixWidths, Number.decrement(graphemeIndex)).pipe(Option.getOrElse(() => 0))
      ),
    onTrue: () => Arr.head(prefixWidths).pipe(Option.getOrElse(() => fallback))
  })

const textGraphemeCountAt = (core: Text.Text, segmentIndex: number): number => {
  const graphemeWidths = breakableGraphemeWidthsAt(core, segmentIndex)

  return Boolean.match(Arr.isEmptyReadonlyArray(graphemeWidths), {
    onFalse: () => Arr.length(graphemeWidths),
    onTrue: () => 1
  })
}

const advanceCursor = (core: Text.Text, cursor: Text.Cursor): Text.Cursor => {
  const remainsInSegment = Boolean.and(
    Arr.isNonEmptyReadonlyArray(breakableGraphemeWidthsAt(core, cursor.segmentIndex)),
    Number.lessThan(Number.increment(cursor.graphemeIndex), textGraphemeCountAt(core, cursor.segmentIndex))
  )

  return Boolean.match(remainsInSegment, {
    onFalse: () => cursorAt(Number.increment(cursor.segmentIndex)),
    onTrue: () => cursorAt(cursor.segmentIndex, Number.increment(cursor.graphemeIndex))
  })
}

const breakKindAtCursor = (core: Text.Text, cursor: Text.Cursor): Prepared.BreakKind => {
  const insideTextSegment = Boolean.and(
    Arr.isNonEmptyReadonlyArray(breakableGraphemeWidthsAt(core, cursor.segmentIndex)),
    Number.lessThan(cursor.graphemeIndex, Number.decrement(textGraphemeCountAt(core, cursor.segmentIndex)))
  )

  return Boolean.match(insideTextSegment, {
    onFalse: () => breakKindAt(core, cursor.segmentIndex),
    onTrue: () => "text"
  })
}

const resolveFitAdvance = (core: Text.Text, segmentIndex: number, currentFitWidth: number): number =>
  Match.value(breakKindAt(core, segmentIndex)).pipe(
    Match.when("tab", () => resolveTabAdvance(currentFitWidth, core.kernel.runtime.tabStopAdvance)),
    Match.when(
      Match.is(
        "text",
        "space",
        "preserved-space",
        "soft-hyphen",
        "dictionary-hyphen",
        "hard-break",
        "glue",
        "zero-width-break"
      ),
      () =>
        runtimeSegmentAt(core, segmentIndex).pipe(
          Option.map((segment) => segment.fitAdvance),
          Option.getOrElse(() => 0)
        )
    ),
    Match.exhaustive
  )

const resolvePaintAdvance = (core: Text.Text, segmentIndex: number, currentPaintWidth: number): number =>
  Match.value(breakKindAt(core, segmentIndex)).pipe(
    Match.when("tab", () => resolveTabAdvance(currentPaintWidth, core.kernel.runtime.tabStopAdvance)),
    Match.when(
      Match.is(
        "text",
        "space",
        "preserved-space",
        "soft-hyphen",
        "dictionary-hyphen",
        "hard-break",
        "glue",
        "zero-width-break"
      ),
      () =>
        runtimeSegmentAt(core, segmentIndex).pipe(
          Option.map((segment) => segment.paintAdvance),
          Option.getOrElse(() => 0)
        )
    ),
    Match.exhaustive
  )

const resolveFitAdvanceAtCursor = (
  core: Text.Text,
  cursor: Text.Cursor,
  currentFitWidth: number
): number =>
  Match.value(breakKindAtCursor(core, cursor)).pipe(
    Match.when("tab", () => resolveTabAdvance(currentFitWidth, core.kernel.runtime.tabStopAdvance)),
    Match.when(
      Match.is(
        "text",
        "space",
        "preserved-space",
        "soft-hyphen",
        "dictionary-hyphen",
        "hard-break",
        "glue",
        "zero-width-break"
      ),
      () => {
        const prefixWidths = breakablePrefixWidthsAt(core, cursor.segmentIndex)
        const fallbackWidth = runtimeSegmentAt(core, cursor.segmentIndex).pipe(
          Option.map((segment) => segment.fitAdvance),
          Option.getOrElse(() => 0)
        )

        return Boolean.match(Arr.isNonEmptyReadonlyArray(prefixWidths), {
          onFalse: () => fallbackWidth,
          onTrue: () => advanceFromPrefixWidths(prefixWidths, cursor.graphemeIndex, fallbackWidth)
        })
      }
    ),
    Match.exhaustive
  )

const resolvePaintAdvanceAtCursor = (
  core: Text.Text,
  cursor: Text.Cursor,
  currentPaintWidth: number
): number =>
  Match.value(breakKindAtCursor(core, cursor)).pipe(
    Match.when("tab", () => resolveTabAdvance(currentPaintWidth, core.kernel.runtime.tabStopAdvance)),
    Match.when(
      Match.is(
        "text",
        "space",
        "preserved-space",
        "soft-hyphen",
        "dictionary-hyphen",
        "hard-break",
        "glue",
        "zero-width-break"
      ),
      () => {
        const graphemeWidths = breakableGraphemeWidthsAt(core, cursor.segmentIndex)
        const fallbackWidth = runtimeSegmentAt(core, cursor.segmentIndex).pipe(
          Option.map((segment) => segment.paintAdvance),
          Option.getOrElse(() => 0)
        )

        return Arr.get(graphemeWidths, cursor.graphemeIndex).pipe(Option.getOrElse(() => fallbackWidth))
      }
    ),
    Match.exhaustive
  )

const appendDiscretionaryBreakCandidate = (
  candidates: BreakCandidates,
  core: Text.Text,
  cursor: Text.Cursor,
  end: Text.Cursor,
  fitWidth: number,
  paintWidth: number
): BreakCandidates =>
  Match.value(breakKindAtCursor(core, cursor)).pipe(
    Match.when("soft-hyphen", () =>
      Arr.append(
        candidates,
        new BreakCandidate({
          end,
          fitWidth,
          insertedText: "-",
          insertedWidth: core.kernel.runtime.discretionaryHyphenWidth,
          kind: "soft-hyphen",
          nextCursor: end,
          paintWidth
        })
      )),
    Match.when("dictionary-hyphen", () =>
      Arr.append(
        candidates,
        new BreakCandidate({
          end,
          fitWidth,
          insertedText: "-",
          insertedWidth: core.kernel.runtime.discretionaryHyphenWidth,
          kind: "dictionary-hyphen",
          nextCursor: end,
          paintWidth
        })
      )),
    Match.when(
      Match.is(
        "text",
        "space",
        "preserved-space",
        "hard-break",
        "tab",
        "glue",
        "zero-width-break"
      ),
      () => candidates
    ),
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
  core: Text.Text,
  state: LineScanState,
  currentCursor: Text.Cursor
): BreakCandidates =>
  Boolean.match(hasPendingWhitespace(state), {
    onFalse: () => state.breakCandidates,
    onTrue: () =>
      Arr.of(
        Match.value(core.kernel.whiteSpace).pipe(
          Match.when("normal", () => explicitBreakCandidate(state, state.end, currentCursor)),
          Match.when("pre-wrap", () =>
            new BreakCandidate({
              end: state.pendingEnd,
              fitWidth: Number.sum(state.fitWidth, state.pendingFitWidth),
              insertedText: String.empty,
              insertedWidth: 0,
              kind: "explicit",
              nextCursor: currentCursor,
              paintWidth: Number.sum(state.paintWidth, state.pendingPaintWidth)
            })),
          Match.exhaustive
        )
      )
  })

const chooseBreakCandidate = (
  candidates: BreakCandidates,
  maxWidth: number,
  lineFitEpsilon: number,
  preferEarlySoftHyphenBreak: boolean
): Option.Option<BreakCandidate> => {
  const fittingCandidates = Arr.filter(
    candidates,
    (candidate) =>
      Number.lessThanOrEqualTo(
        Number.sum(candidate.fitWidth, candidate.insertedWidth),
        Number.sum(maxWidth, lineFitEpsilon)
      )
  )

  const softHyphenCandidates = Arr.filter(
    fittingCandidates,
    (candidate) =>
      Match.value(candidate.kind).pipe(
        Match.when("soft-hyphen", () => true),
        Match.when(Match.is("dictionary-hyphen", "explicit"), () => false),
        Match.exhaustive
      )
  )
  const dictionaryHyphenCandidates = Arr.filter(
    fittingCandidates,
    (candidate) =>
      Match.value(candidate.kind).pipe(
        Match.when("dictionary-hyphen", () => true),
        Match.when(Match.is("explicit", "soft-hyphen"), () => false),
        Match.exhaustive
      )
  )
  const explicitBreakCandidates = Arr.filter(
    fittingCandidates,
    (candidate) =>
      Match.value(candidate.kind).pipe(
        Match.when("explicit", () => true),
        Match.when(Match.is("dictionary-hyphen", "soft-hyphen"), () => false),
        Match.exhaustive
      )
  )

  return Boolean.match(Arr.isEmptyReadonlyArray(fittingCandidates), {
    onFalse: () =>
      Boolean.match(Arr.isNonEmptyReadonlyArray(softHyphenCandidates), {
        onFalse: () =>
          Boolean.match(Arr.isNonEmptyReadonlyArray(dictionaryHyphenCandidates), {
            onFalse: () => Arr.last(explicitBreakCandidates),
            onTrue: () => Arr.last(dictionaryHyphenCandidates)
          }),
        onTrue: () =>
          Boolean.match(preferEarlySoftHyphenBreak, {
            onFalse: () => Arr.last(softHyphenCandidates),
            onTrue: () => Arr.head(softHyphenCandidates)
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
  core: Text.Text,
  start: Text.Cursor,
  end: Text.Cursor,
  nextCursor: Text.Cursor,
  fitWidth: number,
  paintWidth: number,
  insertedBreakText: string = ""
): InternalLineRecord =>
  new InternalLineRecord({
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

class ResolvedPendingState extends Data.Class<{
  readonly end: Text.Cursor
  readonly fitWidth: number
  readonly paintWidth: number
}> {}

const resolvePendingState = (
  core: Text.Text,
  state: LineScanState
): ResolvedPendingState => {
  const preservePending = Match.value(core.kernel.whiteSpace).pipe(
    Match.when("normal", () => false),
    Match.when("pre-wrap", () => hasPendingWhitespace(state)),
    Match.exhaustive
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

const finalizeAtEnd = (core: Text.Text, state: LineScanState): Option.Option<InternalLineRecord> => {
  const resolved = resolvePendingState(core, state)

  const empty = Boolean.and(
    Boolean.not(lineHasCommittedContent(state)),
    Boolean.and(Number.Equivalence(resolved.fitWidth, 0), Number.Equivalence(resolved.paintWidth, 0))
  )

  return Boolean.match(empty, {
    onFalse: () =>
      Option.some(
        emitInternalLineRecord(
          core,
          state.start,
          resolved.end,
          endCursorFor(core),
          resolved.fitWidth,
          resolved.paintWidth
        )
      ),
    onTrue: Option.none
  })
}

const finalizeAtHardBreak = (
  core: Text.Text,
  state: LineScanState,
  nextCursor: Text.Cursor
): InternalLineRecord => {
  const resolved = resolvePendingState(core, state)

  return emitInternalLineRecord(core, state.start, resolved.end, nextCursor, resolved.fitWidth, resolved.paintWidth)
}

const finalizeBeforeCurrent = (
  core: Text.Text,
  state: LineScanState,
  nextCursor: Text.Cursor
): InternalLineRecord =>
  emitInternalLineRecord(core, state.start, state.end, nextCursor, state.fitWidth, state.paintWidth)

const finalizeBeforePending = (
  core: Text.Text,
  state: LineScanState,
  currentCursor: Text.Cursor
): InternalLineRecord =>
  emitInternalLineRecord(
    core,
    state.start,
    state.end,
    Match.value(core.kernel.whiteSpace).pipe(
      Match.when("normal", () => currentCursor),
      Match.when("pre-wrap", () => Option.getOrElse(state.pendingStart, () => currentCursor)),
      Match.exhaustive
    ),
    state.fitWidth,
    state.paintWidth
  )

const finalizeBreakCandidate = (
  core: Text.Text,
  candidate: BreakCandidate,
  start: Text.Cursor
): InternalLineRecord =>
  emitInternalLineRecord(
    core,
    start,
    candidate.end,
    candidate.nextCursor,
    Number.sum(candidate.fitWidth, candidate.insertedWidth),
    Number.sum(candidate.paintWidth, candidate.insertedWidth),
    candidate.insertedText
  )

const appendPendingWhitespace = (
  core: Text.Text,
  state: LineScanState,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): LineScanState => {
  const fitAdvance = resolveFitAdvanceAtCursor(core, currentCursor, Number.sum(state.fitWidth, state.pendingFitWidth))
  const paintAdvance = resolvePaintAdvanceAtCursor(
    core,
    currentCursor,
    Number.sum(state.paintWidth, state.pendingPaintWidth)
  )

  return new LineScanState({
    ...state,
    breakCandidates: Arr.empty(),
    pendingEnd: nextCursor,
    pendingFitWidth: Number.sum(state.pendingFitWidth, fitAdvance),
    pendingPaintWidth: Number.sum(state.pendingPaintWidth, paintAdvance),
    pendingStart: Option.orElse(state.pendingStart, () => Option.some(currentCursor))
  })
}

const startLineWithSegment = (
  core: Text.Text,
  state: LineScanState,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): LineScanState => {
  const leadingFitWidth = Match.value(core.kernel.whiteSpace).pipe(
    Match.when("normal", () => 0),
    Match.when("pre-wrap", () => state.pendingFitWidth),
    Match.exhaustive
  )
  const leadingPaintWidth = Match.value(core.kernel.whiteSpace).pipe(
    Match.when("normal", () => 0),
    Match.when("pre-wrap", () => state.pendingPaintWidth),
    Match.exhaustive
  )
  const fitWidth = Number.sum(leadingFitWidth, resolveFitAdvanceAtCursor(core, currentCursor, leadingFitWidth))
  const paintWidth = Number.sum(leadingPaintWidth, resolvePaintAdvanceAtCursor(core, currentCursor, leadingPaintWidth))

  return new LineScanState({
    ...state,
    breakCandidates: appendDiscretionaryBreakCandidate(
      Arr.empty(),
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
    pendingStart: Option.none()
  })
}

const appendCommittedSegment = (
  core: Text.Text,
  state: LineScanState,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): LineScanState => {
  const pendingFitWidth = Number.sum(state.fitWidth, state.pendingFitWidth)
  const pendingPaintWidth = Number.sum(state.paintWidth, state.pendingPaintWidth)
  const fitWidth = Number.sum(pendingFitWidth, resolveFitAdvanceAtCursor(core, currentCursor, pendingFitWidth))
  const paintWidth = Number.sum(
    pendingPaintWidth,
    resolvePaintAdvanceAtCursor(core, currentCursor, pendingPaintWidth)
  )

  return new LineScanState({
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
    pendingStart: Option.none()
  })
}

const segmentLimitForCursor = (core: Text.Text, cursor: Text.Cursor): number =>
  Iterable.head(RedBlackTree.greaterThan(core.kernel.runtime.chunksByEnd, cursor.segmentIndex)).pipe(
    Option.map(Tuple.getFirst),
    Option.getOrElse(() => segmentCount(core))
  )

const lineFrameIsComplete = (core: Text.Text, frame: LineWalkFrame): boolean =>
  Boolean.or(
    Option.isSome(frame.record),
    Boolean.or(
      Number.greaterThanOrEqualTo(frame.cursor.segmentIndex, segmentCount(core)),
      Number.greaterThanOrEqualTo(frame.cursor.segmentIndex, frame.segmentLimit)
    )
  )

const advanceWhitespaceFrame = (
  core: Text.Text,
  frame: LineWalkFrame,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): LineWalkFrame => {
  const ignoreLeading = Match.value(core.kernel.whiteSpace).pipe(
    Match.when("normal", () => Boolean.not(lineHasCommittedContent(frame.scan))),
    Match.when("pre-wrap", () => false),
    Match.exhaustive
  )

  return Boolean.match(ignoreLeading, {
    onFalse: () =>
      new LineWalkFrame({
        ...frame,
        cursor: nextCursor,
        scan: appendPendingWhitespace(core, frame.scan, currentCursor, nextCursor)
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
          breakCandidates: Arr.append(
            frame.scan.breakCandidates,
            explicitBreakCandidate(frame.scan, currentCursor, nextCursor)
          )
        })
      })
  })

const advanceContentFrame = (
  core: Text.Text,
  frame: LineWalkFrame,
  currentCursor: Text.Cursor,
  nextCursor: Text.Cursor
): LineWalkFrame => {
  const pendingFitWidth = Number.sum(frame.scan.fitWidth, frame.scan.pendingFitWidth)
  const candidateFitWidth = Number.sum(
    pendingFitWidth,
    resolveFitAdvanceAtCursor(core, currentCursor, pendingFitWidth)
  )
  const candidateFits = Number.lessThanOrEqualTo(
    candidateFitWidth,
    Number.sum(frame.maxWidth, core.kernel.lineFitEpsilon)
  )

  return Boolean.match(lineHasCommittedContent(frame.scan), {
    onFalse: () =>
      new LineWalkFrame({
        ...frame,
        cursor: nextCursor,
        scan: startLineWithSegment(core, frame.scan, currentCursor, nextCursor)
      }),
    onTrue: () =>
      Boolean.match(candidateFits, {
        onFalse: () =>
          Boolean.match(hasPendingWhitespace(frame.scan), {
            onFalse: () => {
              const breakCandidate = chooseBreakCandidate(
                frame.scan.breakCandidates,
                frame.maxWidth,
                core.kernel.lineFitEpsilon,
                core.kernel.preferEarlySoftHyphenBreak
              )

              return new LineWalkFrame({
                ...frame,
                record: Option.match(breakCandidate, {
                  onNone: () => Option.some(finalizeBeforeCurrent(core, frame.scan, currentCursor)),
                  onSome: (candidate) => Option.some(finalizeBreakCandidate(core, candidate, frame.scan.start))
                })
              })
            },
            onTrue: () =>
              new LineWalkFrame({
                ...frame,
                record: Option.some(finalizeBeforePending(core, frame.scan, currentCursor))
              })
          }),
        onTrue: () =>
          new LineWalkFrame({
            ...frame,
            cursor: nextCursor,
            scan: appendCommittedSegment(core, frame.scan, currentCursor, nextCursor)
          })
      })
  })
}

const advanceLineFrame = (core: Text.Text, frame: LineWalkFrame): LineWalkFrame => {
  const currentCursor = frame.cursor
  const nextCursor = advanceCursor(core, currentCursor)
  const breakKind = breakKindAtCursor(core, currentCursor)

  return Match.value(breakKind).pipe(
    Match.when("hard-break", () =>
      new LineWalkFrame({
        ...frame,
        cursor: nextCursor,
        record: Option.some(finalizeAtHardBreak(core, frame.scan, nextCursor))
      })),
    Match.when("space", () => advanceWhitespaceFrame(core, frame, currentCursor, nextCursor)),
    Match.when("preserved-space", () => advanceWhitespaceFrame(core, frame, currentCursor, nextCursor)),
    Match.when("tab", () => advanceWhitespaceFrame(core, frame, currentCursor, nextCursor)),
    Match.when("zero-width-break", () => advanceZeroWidthBreakFrame(frame, currentCursor, nextCursor)),
    Match.when("text", () => advanceContentFrame(core, frame, currentCursor, nextCursor)),
    Match.when("soft-hyphen", () => advanceContentFrame(core, frame, currentCursor, nextCursor)),
    Match.when("dictionary-hyphen", () => advanceContentFrame(core, frame, currentCursor, nextCursor)),
    Match.when("glue", () => advanceContentFrame(core, frame, currentCursor, nextCursor)),
    Match.exhaustive
  )
}

const walkNextLineRecord = (
  core: Text.Text,
  maxWidth: number,
  cursor: Text.Cursor
): Option.Option<InternalLineRecord> => {
  const initial = new LineWalkFrame({
    cursor,
    maxWidth,
    record: Option.none(),
    scan: initialLineScanState(cursor),
    segmentLimit: segmentLimitForCursor(core, cursor)
  })
  const terminalFrame = Iterable.reduce(
    Iterable.unfold(initial, (frame) =>
      Boolean.match(lineFrameIsComplete(core, frame), {
        onFalse: () => {
          const next = advanceLineFrame(core, frame)
          return Option.some(Tuple.make(next, next))
        },
        onTrue: Option.none
      })),
    initial,
    (_previous, current) => current
  )

  return Boolean.match(Number.greaterThanOrEqualTo(cursor.segmentIndex, segmentCount(core)), {
    onFalse: () => Option.orElse(terminalFrame.record, () => finalizeAtEnd(core, terminalFrame.scan)),
    onTrue: Option.none
  })
}

const walkLineRecordArray = (
  core: Text.Text,
  maxWidthAtLine: (lineIndex: number) => number,
  lineIndex: number = 0,
  cursor: Text.Cursor = cursorAt(0)
): InternalLineRecords =>
  Arr.unfold(
    new LineRecordWalkState({ cursor, lineIndex }),
    (state) =>
      Boolean.match(Number.greaterThanOrEqualTo(state.cursor.segmentIndex, segmentCount(core)), {
        onFalse: () =>
          walkNextLineRecord(core, maxWidthAtLine(state.lineIndex), state.cursor).pipe(
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
  )

const visualOrderUnitAtCursor = (
  core: Text.WithSegments,
  cursor: Text.Cursor,
  logicalIndex: number
): VisualOrderUnit => {
  const segment = segmentAt(core, cursor.segmentIndex)
  const fallbackLevel = Match.value(core.kernel.baseDirection).pipe(
    Match.when("ltr", () => 0),
    Match.when("rtl", () => 1),
    Match.exhaustive
  )
  const graphemeBidiLevels = graphemeBidiLevelsAt(core, cursor.segmentIndex)
  const mirroredGraphemes = mirroredGraphemesAt(core, cursor.segmentIndex)

  return Option.match(segment, {
    onNone: () =>
      new VisualOrderUnit({
        level: fallbackLevel,
        logicalIndex,
        mirroredText: "",
        text: ""
      }),
    onSome: (value) =>
      Match.value(value.kind).pipe(
        Match.when("text", () => {
          const text = Arr.get(value.graphemes, cursor.graphemeIndex).pipe(Option.getOrElse(() => String.empty))
          return new VisualOrderUnit({
            level: Arr.get(graphemeBidiLevels, cursor.graphemeIndex).pipe(
              Option.getOrElse(() => value.bidiLevel)
            ),
            logicalIndex,
            mirroredText: Arr.get(mirroredGraphemes, cursor.graphemeIndex).pipe(Option.getOrElse(() => text)),
            text
          })
        }),
        Match.when("space", () =>
          new VisualOrderUnit({
            level: value.bidiLevel,
            logicalIndex,
            mirroredText: value.text,
            text: value.text
          })),
        Match.when("tab", () =>
          new VisualOrderUnit({
            level: value.bidiLevel,
            logicalIndex,
            mirroredText: value.text,
            text: value.text
          })),
        Match.when("hard-break", () =>
          new VisualOrderUnit({
            level: value.bidiLevel,
            logicalIndex,
            mirroredText: value.text,
            text: value.text
          })),
        Match.exhaustive
      )
  })
}

const visualUnitsForRecord = (
  core: Text.WithSegments,
  record: InternalLineRecord
) =>
  Arr.unfold(
    new VisualUnitCursorState({ cursor: record.start, logicalIndex: 0 }),
    (state: VisualUnitCursorState) =>
      Boolean.match(cursorEquals(state.cursor, record.end), {
        onFalse: () =>
          Option.some(
            Tuple.make(
              visualOrderUnitAtCursor(core, state.cursor, state.logicalIndex),
              new VisualUnitCursorState({
                cursor: advanceCursor(core, state.cursor),
                logicalIndex: Number.increment(state.logicalIndex)
              })
            )
          ),
        onTrue: Option.none
      })
  )

const visualTextForRecord = (core: Text.WithSegments, record: InternalLineRecord): string => {
  const units = visualUnitsForRecord(core, record)
  const fallbackLevel = Arr.last(units).pipe(
    Option.map((unit) => unit.level),
    Option.getOrElse(() =>
      Match.value(core.kernel.baseDirection).pipe(
        Match.when("ltr", () => 0),
        Match.when("rtl", () => 1),
        Match.exhaustive
      )
    )
  )

  return projectVisualText(units, record.insertedBreakText, fallbackLevel)
}

const materializeLine = (
  core: Text.WithSegments,
  lineIndex: number,
  record: InternalLineRecord
): Text.Line => ({
  baseDirection: core.kernel.baseDirection,
  index: lineIndex,
  order: "visual",
  text: visualTextForRecord(core, record),
  width: record.width
})

const measureChunkWidth = (
  core: Text.Text,
  startSegmentIndex: number,
  segmentLimit: number
): number =>
  Iterable.reduce(
    Iterable.unfold(startSegmentIndex, (index) =>
      Boolean.match(Number.lessThan(index, segmentLimit), {
        onFalse: Option.none,
        onTrue: () => Option.some(Tuple.make(index, Number.increment(index)))
      })),
    Data.struct({ fitWidth: 0, paintWidth: 0 }),
    (state, segmentIndex) =>
      Data.struct({
        fitWidth: Number.sum(state.fitWidth, resolveFitAdvance(core, segmentIndex, state.fitWidth)),
        paintWidth: Number.sum(state.paintWidth, resolvePaintAdvance(core, segmentIndex, state.paintWidth))
      })
  ).paintWidth

/**
 * Summarizes layout from the canonical walker without materializing line text.
 *
 * @since 0.2.0
 * @category internals
 */
export const summarizeLines = (core: Text.Text, request: Text.Request): Text.Summary =>
  Arr.reduce(
    walkLineRecordArray(core, () => request.maxWidth),
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
  core: Text.WithSegments,
  request: Text.Request,
  targetCursor: Text.Cursor
): number =>
  Arr.length(
    Arr.unfold(cursorAt(0), (cursor) =>
      Boolean.match(cursorIsBefore(cursor, targetCursor), {
        onFalse: () => Option.none(),
        onTrue: () =>
          walkNextLineRecord(core, request.maxWidth, cursor).pipe(
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
  core: Text.WithSegments,
  request: Text.Request,
  maxWidthAtLine: (lineIndex: number) => number = () => request.maxWidth
): Text.Lines =>
  Arr.map(walkLineRecordArray(core, maxWidthAtLine), (record, lineIndex) => materializeLine(core, lineIndex, record))

/**
 * Materializes lines and derives summary from one walk pass.
 *
 * @since 0.2.0
 * @category internals
 */
export const materializeLinesWithSummary = (
  core: Text.WithSegments,
  request: Text.Request
): Text.Layout => {
  const records = walkLineRecordArray(core, () => request.maxWidth)
  const lines = Arr.map(records, (record, lineIndex) => materializeLine(core, lineIndex, record))

  return {
    summary: {
      height: Number.multiply(Arr.length(records), request.lineHeight),
      lineCount: Arr.length(records),
      maxLineWidth: Arr.reduce(records, 0, (maxWidth, record) => Number.max(maxWidth, record.width))
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
  prepared: Text.WithSegments,
  request: Text.Request,
  cursor: Text.Cursor,
  lineIndexHint: Option.Option<number> = Option.none()
): Option.Option<Text.LineStep> => {
  const core = prepared
  const cursorHints = prepared.cursorHints

  return walkNextLineRecord(core, request.maxWidth, cursor).pipe(
    Option.map((record): Text.LineStep => {
      const lineIndex = Option.orElse(
        lineIndexHint,
        () => rememberedCursorLineIndex(cursor, cursorHints, request.maxWidth)
      ).pipe(Option.getOrElse(() => countLinesBeforeCursor(core, request, cursor)))

      return Tuple.make(
        materializeLine(core, lineIndex, record),
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
  core: Text.WithSegments,
  request: Text.Request,
  maxWidthAtLine: (lineIndex: number) => number = () => request.maxWidth
): Text.LineRanges =>
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
export const measureNaturalWidth = (core: Text.Text): number =>
  Arr.reduce(core.kernel.runtime.chunks, 0, (maxWidth, chunk) => {
    const chunkWidth = measureChunkWidth(core, chunk.startSegmentIndex, chunk.consumedEndSegmentIndex)

    return Number.max(maxWidth, chunkWidth)
  })
