/**
 * MIPROv2 event progress formatting and summaries.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Match, Stream } from "effect"
import type { Effect } from "effect"
import type { MIPROv2Event } from "./events.js"

/**
 * Formatted MIPROv2 progress line.
 *
 * @since 0.2.0
 * @category models
 */
export class MIPROv2ProgressLine extends Data.Class<{
  readonly tag: MIPROv2Event["_tag"]
  readonly details: string
  readonly text: string
}> {
  static project = (event: MIPROv2Event): MIPROv2ProgressLine => toProgressLine(event._tag, detailsFromEvent(event))

  static tap =
    <E, R>(onProgress: MIPROv2ProgressSink<E, R>) =>
    <SE, SR>(stream: Stream.Stream<MIPROv2Event, SE, SR>): Stream.Stream<MIPROv2Event, E | SE, R | SR> =>
      stream.pipe(Stream.tap((event) => onProgress(MIPROv2ProgressLine.project(event))))
}

const toProgressLine = (
  tag: MIPROv2ProgressLine["tag"],
  details: string
): MIPROv2ProgressLine =>
  new MIPROv2ProgressLine({
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
 * Progress sink for formatted MIPROv2 lines.
 *
 * @since 0.1.0
 * @category models
 */
export type MIPROv2ProgressSink<E = never, R = never> = (
  line: MIPROv2ProgressLine
) => Effect.Effect<void, E, R>

/**
 * Semantic summary projected from MIPROv2 events.
 *
 * @since 0.2.0
 * @category models
 */
export class MIPROv2EventSummary extends Data.Class<{
  readonly totalEvents: number
  readonly demoCandidateCount: number
  readonly instructionProposedCount: number
  readonly trialEvaluatedCount: number
  readonly fullEvalCompletedCount: number
  readonly phase3StartedSeen: boolean
  readonly phase3CompletedSeen: boolean
  readonly phase3ConfiguredTrials: number
  readonly phase3CompletedTrials: number
  readonly phase3BestScoreSeen: boolean
  readonly phase3BestScore: number
}> {
  static make = (options: {
    readonly totalEvents: number
    readonly demoCandidateCount: number
    readonly instructionProposedCount: number
    readonly trialEvaluatedCount: number
    readonly fullEvalCompletedCount: number
    readonly phase3StartedSeen: boolean
    readonly phase3CompletedSeen: boolean
    readonly phase3ConfiguredTrials: number
    readonly phase3CompletedTrials: number
    readonly phase3BestScoreSeen: boolean
    readonly phase3BestScore: number
  }): MIPROv2EventSummary => new MIPROv2EventSummary(options)

  static summarize = (events: ReadonlyArray<MIPROv2Event>): MIPROv2EventSummary =>
    Arr.reduce(events, EMPTY_MIPROV2_EVENT_SUMMARY, summarizeEvent)
}

const EMPTY_MIPROV2_EVENT_SUMMARY = MIPROv2EventSummary.make({
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
  MIPROv2EventSummary.make({
    ...summary,
    phase3BestScoreSeen: true,
    phase3BestScore: summary.phase3BestScoreSeen
      ? Math.max(summary.phase3BestScore, candidateScore)
      : candidateScore
  })

const summarizeEvent = (
  summary: MIPROv2EventSummary,
  event: MIPROv2Event
): MIPROv2EventSummary => {
  const incremented = MIPROv2EventSummary.make({
    ...summary,
    totalEvents: summary.totalEvents + 1
  })

  return Match.value(event).pipe(
    Match.tag("Phase1Started", () => incremented),
    Match.tag("DemoCandidate", () =>
      MIPROv2EventSummary.make({
        ...incremented,
        demoCandidateCount: incremented.demoCandidateCount + 1
      })),
    Match.tag("Phase1Completed", () => incremented),
    Match.tag("Phase2Started", () => incremented),
    Match.tag("InstructionProposed", () =>
      MIPROv2EventSummary.make({
        ...incremented,
        instructionProposedCount: incremented.instructionProposedCount + 1
      })),
    Match.tag("Phase2Completed", () => incremented),
    Match.tag("Phase3Started", ({ numTrials }) =>
      MIPROv2EventSummary.make({
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
