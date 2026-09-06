/**
 * Formats MIPROv2 events and folds them into progress summaries.
 *
 * @since 0.1.0
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Data, Match, Stream } from "effect"
import type { Effect } from "effect"
import type { MIPROv2Event } from "./events.js"

/**
 * Carries a MIPROv2 event tag with progress text that omits complete instructions.
 *
 * @since 0.1.0
 * @category models
 */
export class MIPROv2ProgressLine extends Data.Class<{
  /** Original event discriminator. */
  readonly tag: MIPROv2Event["_tag"]
  /** Space-separated key-value fields selected for display. */
  readonly details: string
  /** Event tag followed by `details` when details are present. */
  readonly text: string
}> {}

const toProgressLine = (
  tag: MIPROv2ProgressLine["tag"],
  details: string
): MIPROv2ProgressLine => ({
  tag,
  details,
  text: details.length > 0
    ? `${tag} ${details}`
    : tag
})

const detailsFromEvent = (event: MIPROv2Event): string =>
  Match.value(event).pipe(
    Match.tag("Phase1Started", ({ numCandidates }) => `numCandidates=${numCandidates}`),
    Match.tag("DemoCandidate", ({ predictorIndex, candidateIndex }) =>
      `predictorIndex=${predictorIndex} candidateIndex=${candidateIndex}`),
    Match.tag("Phase1Completed", ({ totalCandidates }) =>
      `totalCandidates=${totalCandidates}`),
    Match.tag("Phase2Started", ({ numInstructions }) => `numInstructions=${numInstructions}`),
    Match.tag("InstructionProposed", ({ predictorIndex, instruction }) =>
      `predictorIndex=${predictorIndex} instructionLength=${instruction.length}`),
    Match.tag("Phase2Completed", ({ totalInstructions }) =>
      `totalInstructions=${totalInstructions}`),
    Match.tag("Phase3Started", ({ numTrials }) =>
      `numTrials=${numTrials}`),
    Match.tag("TrialEvaluated", ({ trial, score }) => `trial=${trial} score=${score}`),
    Match.tag("FullEvalCompleted", ({ bestScore }) => `bestScore=${bestScore}`),
    Match.tag("Phase3Completed", ({ bestScore, totalTrials }) => `bestScore=${bestScore} totalTrials=${totalTrials}`),
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
export class MIPROv2EventSummary extends Data.Class<{
  /** Number of input events across all tags. */
  readonly totalEvents: number
  /** Number of `DemoCandidate` events. */
  readonly demoCandidateCount: number
  /** Number of `InstructionProposed` events, including emitted baselines. */
  readonly instructionProposedCount: number
  /** Number of minibatch `TrialEvaluated` events. */
  readonly trialEvaluatedCount: number
  /** Number of `FullEvalCompleted` events. */
  readonly fullEvalCompletedCount: number
  /** Whether a `Phase3Started` event was observed. */
  readonly phase3StartedSeen: boolean
  /** Whether a `Phase3Completed` event was observed. */
  readonly phase3CompletedSeen: boolean
  /** Trial count from the most recent `Phase3Started` event. */
  readonly phase3ConfiguredTrials: number
  /** Trial count from the most recent `Phase3Completed` event. */
  readonly phase3CompletedTrials: number
  /** Whether any trial, full-set, or completion score was observed. */
  readonly phase3BestScoreSeen: boolean
  /** Maximum score across all observed Phase 3 score-bearing events. */
  readonly phase3BestScore: number
}> {}

const EMPTY_MIPROV2_EVENT_SUMMARY: MIPROv2EventSummary = {
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
}

const withBestScore = (
  summary: MIPROv2EventSummary,
  candidateScore: number
): MIPROv2EventSummary => ({
  ...summary,
  phase3BestScoreSeen: true,
  phase3BestScore: summary.phase3BestScoreSeen
    ? Numeric.max(summary.phase3BestScore, candidateScore)
    : candidateScore
})

const summarizeEvent = (
  summary: MIPROv2EventSummary,
  event: MIPROv2Event
): MIPROv2EventSummary => {
  const incremented: MIPROv2EventSummary = {
    ...summary,
    totalEvents: summary.totalEvents + 1
  }

  return Match.value(event).pipe(
    Match.tag("Phase1Started", () => incremented),
    Match.tag("DemoCandidate", () => ({
      ...incremented,
      demoCandidateCount: incremented.demoCandidateCount + 1
    })),
    Match.tag("Phase1Completed", () => incremented),
    Match.tag("Phase2Started", () => incremented),
    Match.tag("InstructionProposed", () => ({
      ...incremented,
      instructionProposedCount: incremented.instructionProposedCount + 1
    })),
    Match.tag("Phase2Completed", () => incremented),
    Match.tag("Phase3Started", ({ numTrials }) => ({
      ...incremented,
      phase3StartedSeen: true,
      phase3ConfiguredTrials: numTrials
    })),
    Match.tag("TrialEvaluated", ({ score }) =>
      withBestScore(
        {
          ...incremented,
          trialEvaluatedCount: incremented.trialEvaluatedCount + 1
        },
        score
      )),
    Match.tag("FullEvalCompleted", ({ bestScore }) =>
      withBestScore(
        {
          ...incremented,
          fullEvalCompletedCount: incremented.fullEvalCompletedCount + 1
        },
        bestScore
      )),
    Match.tag("Phase3Completed", ({ bestScore, totalTrials }) =>
      withBestScore(
        {
          ...incremented,
          phase3CompletedSeen: true,
          phase3CompletedTrials: totalTrials
        },
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
  events: ReadonlyArray<MIPROv2Event>
): MIPROv2EventSummary => Arr.reduce(events, EMPTY_MIPROV2_EVENT_SUMMARY, summarizeEvent)
