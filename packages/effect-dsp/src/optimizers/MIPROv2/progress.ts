/**
 * Formats MIPROv2 events and folds them into progress summaries.
 *
 * @since 0.1.0
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Inspectable, Match, Number as Num, Schema, Stream, String as Str } from "effect"
import type { Effect } from "effect"
import { type MIPROv2Event, MIPROv2EventSchema } from "./events.js"

const MIPROv2EventTag = Schema.typeSchema(Schema.pluck(MIPROv2EventSchema, "_tag"))

/**
 * Carries a MIPROv2 event tag with progress text that omits complete instructions.
 *
 * @since 0.1.0
 * @category models
 */
export class MIPROv2ProgressLine extends Schema.Class<MIPROv2ProgressLine>("MIPROv2ProgressLine")({
  /** Original event discriminator. */
  tag: MIPROv2EventTag,
  /** Space-separated key-value fields selected for display. */
  details: Schema.String,
  /** Event tag followed by `details` when details are present. */
  text: Schema.String
}) {}

const renderValue = (label: string, value: unknown): string => Str.concat(label, Inspectable.toStringUnknown(value))

const joinDetails = (details: Iterable<string>): string => Arr.join(Arr.fromIterable(details), " ")

const toProgressLine = (
  tag: MIPROv2ProgressLine["tag"],
  details: string
): MIPROv2ProgressLine =>
  new MIPROv2ProgressLine({
    tag,
    details,
    text: Bool.match(Str.isNonEmpty(details), {
      onFalse: () => tag,
      onTrue: () => Str.concat(Str.concat(tag, " "), details)
    })
  })

const detailsFromEvent = (event: MIPROv2Event): string =>
  Match.value(event).pipe(
    Match.tag("Phase1Started", ({ numCandidates }) => renderValue("numCandidates=", numCandidates)),
    Match.tag("DemoCandidate", ({ predictorIndex, candidateIndex }) =>
      joinDetails(
        Arr.make(renderValue("predictorIndex=", predictorIndex), renderValue("candidateIndex=", candidateIndex))
      )),
    Match.tag("Phase1Completed", ({ totalCandidates }) => renderValue("totalCandidates=", totalCandidates)),
    Match.tag("Phase2Started", ({ numInstructions }) => renderValue("numInstructions=", numInstructions)),
    Match.tag("InstructionProposed", ({ predictorIndex, instruction }) =>
      joinDetails(
        Arr.make(
          renderValue("predictorIndex=", predictorIndex),
          renderValue("instructionLength=", Str.length(instruction))
        )
      )),
    Match.tag("Phase2Completed", ({ totalInstructions }) => renderValue("totalInstructions=", totalInstructions)),
    Match.tag("Phase3Started", ({ numTrials }) => renderValue("numTrials=", numTrials)),
    Match.tag("TrialEvaluated", ({ trial, score }) =>
      joinDetails(Arr.make(renderValue("trial=", trial), renderValue("score=", score)))),
    Match.tag("FullEvalCompleted", ({ bestScore }) =>
      renderValue("bestScore=", bestScore)),
    Match.tag("Phase3Completed", ({ bestScore, totalTrials }) =>
      joinDetails(Arr.make(renderValue("bestScore=", bestScore), renderValue("totalTrials=", totalTrials)))),
    Match.exhaustive
  )

/**
 * Formats an event without exposing full instruction text.
 *
 * @remarks
 * `InstructionProposed` reports only instruction length. Numeric values use
 * JavaScript string conversion and no locale-specific formatting.
 *
 * @param event - Lifecycle event to format.
 * @returns A new line value containing the original tag.
 *
 * @since 0.1.0
 * @category formatters
 */
export const formatMIPROv2ProgressEvent = (event: MIPROv2Event): MIPROv2ProgressLine =>
  toProgressLine(event._tag, detailsFromEvent(event))

/**
 * Consumes one formatted MIPROv2 progress line with caller-defined Effect channels.
 *
 * @typeParam E - Expected failure from the progress sink.
 * @typeParam R - Services required by the progress sink.
 *
 * @since 0.1.0
 * @category models
 */
export type MIPROv2ProgressSink<E = never, R = never> = (
  line: MIPROv2ProgressLine
) => Effect.Effect<void, E, R>

/**
 * Invokes an effectful progress sink for every MIPROv2 event in a stream.
 *
 * @remarks
 * Sink effects run in stream order. Their failures and requirements are added
 * to the returned stream.
 *
 * @param onProgress - Sink invoked once per upstream event.
 * @returns A stream transformation that preserves event values and ordering.
 * @typeParam E - Expected failure added by the progress sink.
 * @typeParam R - Services required by the progress sink.
 *
 * @since 0.1.0
 * @category combinators
 */
export const tapMIPROv2Progress =
  <E, R>(onProgress: MIPROv2ProgressSink<E, R>) =>
  <SE, SR>(stream: Stream.Stream<MIPROv2Event, SE, SR>): Stream.Stream<MIPROv2Event, E | SE, R | SR> =>
    stream.pipe(
      Stream.tap((event) => onProgress(formatMIPROv2ProgressEvent(event)))
    )

/**
 * Aggregates observed candidate, evaluation, and Phase 3 completion data.
 *
 * @since 0.1.0
 * @category models
 */
export class MIPROv2EventSummary extends Schema.Class<MIPROv2EventSummary>("MIPROv2EventSummary")({
  /** Number of input events across all tags. */
  totalEvents: Schema.Number,
  /** Number of `DemoCandidate` events. */
  demoCandidateCount: Schema.Number,
  /** Number of `InstructionProposed` events, including emitted baselines. */
  instructionProposedCount: Schema.Number,
  /** Number of minibatch `TrialEvaluated` events. */
  trialEvaluatedCount: Schema.Number,
  /** Number of `FullEvalCompleted` events. */
  fullEvalCompletedCount: Schema.Number,
  /** Whether a `Phase3Started` event was observed. */
  phase3StartedSeen: Schema.Boolean,
  /** Whether a `Phase3Completed` event was observed. */
  phase3CompletedSeen: Schema.Boolean,
  /** Trial count from the most recent `Phase3Started` event. */
  phase3ConfiguredTrials: Schema.Number,
  /** Trial count from the most recent `Phase3Completed` event. */
  phase3CompletedTrials: Schema.Number,
  /** Whether any trial, full-set, or completion score was observed. */
  phase3BestScoreSeen: Schema.Boolean,
  /** Maximum score across all observed Phase 3 score-bearing events. */
  phase3BestScore: Schema.Number
}) {}

const EMPTY_MIPROV2_EVENT_SUMMARY = new MIPROv2EventSummary({
  totalEvents: 0,
  demoCandidateCount: 0,
  instructionProposedCount: 0,
  trialEvaluatedCount: 0,
  fullEvalCompletedCount: 0,
  phase3StartedSeen: false,
  phase3CompletedSeen: false,
  phase3ConfiguredTrials: 0,
  phase3CompletedTrials: 0,
  phase3BestScoreSeen: false,
  phase3BestScore: 0
})

const withBestScore = (
  summary: MIPROv2EventSummary,
  candidateScore: number
): MIPROv2EventSummary =>
  new MIPROv2EventSummary({
    ...summary,
    phase3BestScoreSeen: true,
    phase3BestScore: Bool.match(summary.phase3BestScoreSeen, {
      onFalse: () => candidateScore,
      onTrue: () => Numeric.max(summary.phase3BestScore, candidateScore)
    })
  })

const summarizeEvent = (
  summary: MIPROv2EventSummary,
  event: MIPROv2Event
): MIPROv2EventSummary => {
  const incremented = new MIPROv2EventSummary({
    ...summary,
    totalEvents: Num.increment(summary.totalEvents)
  })

  return Match.value(event).pipe(
    Match.tag("Phase1Started", () => incremented),
    Match.tag("DemoCandidate", () =>
      new MIPROv2EventSummary({
        ...incremented,
        demoCandidateCount: Num.increment(incremented.demoCandidateCount)
      })),
    Match.tag("Phase1Completed", () => incremented),
    Match.tag("Phase2Started", () => incremented),
    Match.tag("InstructionProposed", () =>
      new MIPROv2EventSummary({
        ...incremented,
        instructionProposedCount: Num.increment(incremented.instructionProposedCount)
      })),
    Match.tag("Phase2Completed", () => incremented),
    Match.tag("Phase3Started", ({ numTrials }) =>
      new MIPROv2EventSummary({
        ...incremented,
        phase3StartedSeen: true,
        phase3ConfiguredTrials: numTrials
      })),
    Match.tag("TrialEvaluated", ({ score }) =>
      withBestScore(
        new MIPROv2EventSummary({
          ...incremented,
          trialEvaluatedCount: Num.increment(incremented.trialEvaluatedCount)
        }),
        score
      )),
    Match.tag("FullEvalCompleted", ({ bestScore }) =>
      withBestScore(
        new MIPROv2EventSummary({
          ...incremented,
          fullEvalCompletedCount: Num.increment(incremented.fullEvalCompletedCount)
        }),
        bestScore
      )),
    Match.tag("Phase3Completed", ({ bestScore, totalTrials }) =>
      withBestScore(
        new MIPROv2EventSummary({
          ...incremented,
          phase3CompletedSeen: true,
          phase3CompletedTrials: totalTrials
        }),
        bestScore
      )),
    Match.exhaustive
  )
}

/**
 * Counts MIPROv2 candidates and evaluations while retaining Phase 3 score state.
 *
 * @remarks
 * Repeated phase boundaries overwrite their corresponding trial-count fields.
 * Scores from minibatch, full-set, and completion events share one maximum.
 *
 * @param events - Events to fold in their supplied order.
 * @returns Counters and the maximum observed Phase 3 score.
 *
 * @since 0.1.0
 * @category combinators
 */
export const summarizeMIPROv2Events = (
  events: Iterable<MIPROv2Event>
): MIPROv2EventSummary => Arr.reduce(events, EMPTY_MIPROV2_EVENT_SUMMARY, summarizeEvent)
