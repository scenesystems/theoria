/**
 * COPRO event progress formatting and summaries.
 *
 * @since 0.2.0
 */
import { Array as Arr, Match, Stream } from "effect"
import type { Effect } from "effect"
import type { COPROEvent } from "./events.js"

/**
 * Formatted COPRO progress line.
 *
 * @since 0.2.0
 * @category models
 */
export type COPROProgressLine = Readonly<{
  readonly tag: COPROEvent["_tag"]
  readonly details: string
  readonly text: string
}>

/**
 * Semantic summary projected from COPRO events.
 *
 * @since 0.2.0
 * @category models
 */
export type COPROEventSummary = Readonly<{
  readonly totalEvents: number
  readonly stepsStarted: number
  readonly candidateCount: number
  readonly trialsEvaluated: number
  readonly improvedTrials: number
  readonly changedPredictors: number
  readonly completed: boolean
  readonly bestScore: number
}>

const toProgressLine = (tag: COPROProgressLine["tag"], details: string): COPROProgressLine => ({
  tag,
  details,
  text: details.length > 0 ? `${tag} ${details}` : tag
})

const detailsFromEvent = (event: COPROEvent): string =>
  Match.value(event).pipe(
    Match.tag(
      "OptimizationStarted",
      ({ maxSteps, numCandidates, resumedFromSnapshot, nextStep }) =>
        `maxSteps=${maxSteps} numCandidates=${numCandidates} resumed=${resumedFromSnapshot} nextStep=${nextStep}`
    ),
    Match.tag("StepStarted", ({ step }) => `step=${step}`),
    Match.tag(
      "InstructionCandidateProposed",
      ({ step, predictorName, candidateIndex, instruction }) =>
        `step=${step} predictor=${predictorName} candidateIndex=${candidateIndex} instructionLength=${instruction.length}`
    ),
    Match.tag(
      "TrialEvaluated",
      ({ step, predictorName, trialNumber, candidateIndex, score, improved }) =>
        `step=${step} predictor=${predictorName} trial=${trialNumber} candidateIndex=${candidateIndex} score=${score} improved=${improved}`
    ),
    Match.tag(
      "PredictorUpdated",
      ({ step, predictorName, score, changed }) =>
        `step=${step} predictor=${predictorName} score=${score} changed=${changed}`
    ),
    Match.tag(
      "StepCompleted",
      ({ step, bestScore, changedPredictorCount }) =>
        `step=${step} bestScore=${bestScore} changedPredictorCount=${changedPredictorCount}`
    ),
    Match.tag(
      "OptimizationCompleted",
      ({ stepsCompleted, totalTrials, bestScore }) =>
        `stepsCompleted=${stepsCompleted} totalTrials=${totalTrials} bestScore=${bestScore}`
    ),
    Match.exhaustive
  )

/**
 * Deterministically format a COPRO event as one progress line.
 *
 * @since 0.2.0
 * @category formatters
 */
export const formatCOPROProgressEvent = (event: COPROEvent): COPROProgressLine =>
  toProgressLine(event._tag, detailsFromEvent(event))

/**
 * Progress sink for formatted COPRO lines.
 *
 * @since 0.2.0
 * @category models
 */
export type COPROProgressSink<E = never, R = never> = (line: COPROProgressLine) => Effect.Effect<void, E, R>

/**
 * Tap formatted COPRO progress lines from an event stream.
 *
 * @since 0.2.0
 * @category combinators
 */
export const tapCOPROProgress =
  <E, R>(onProgress: COPROProgressSink<E, R>) =>
  <SE, SR>(stream: Stream.Stream<COPROEvent, SE, SR>): Stream.Stream<COPROEvent, E | SE, R | SR> =>
    stream.pipe(Stream.tap((event) => onProgress(formatCOPROProgressEvent(event))))

const EMPTY_COPRO_EVENT_SUMMARY: COPROEventSummary = {
  totalEvents: 0,
  stepsStarted: 0,
  candidateCount: 0,
  trialsEvaluated: 0,
  improvedTrials: 0,
  changedPredictors: 0,
  completed: false,
  bestScore: 0
}

const summarizeEvent = (summary: COPROEventSummary, event: COPROEvent): COPROEventSummary => {
  const incremented = {
    ...summary,
    totalEvents: summary.totalEvents + 1
  }

  return Match.value(event).pipe(
    Match.tag("OptimizationStarted", () => incremented),
    Match.tag("StepStarted", () => ({ ...incremented, stepsStarted: incremented.stepsStarted + 1 })),
    Match.tag(
      "InstructionCandidateProposed",
      () => ({ ...incremented, candidateCount: incremented.candidateCount + 1 })
    ),
    Match.tag("TrialEvaluated", ({ score, improved }) => ({
      ...incremented,
      trialsEvaluated: incremented.trialsEvaluated + 1,
      improvedTrials: incremented.improvedTrials + (improved ? 1 : 0),
      bestScore: Math.max(incremented.bestScore, score)
    })),
    Match.tag("PredictorUpdated", ({ changed, score }) => ({
      ...incremented,
      changedPredictors: incremented.changedPredictors + (changed ? 1 : 0),
      bestScore: Math.max(incremented.bestScore, score)
    })),
    Match.tag("StepCompleted", ({ bestScore }) => ({
      ...incremented,
      bestScore: Math.max(incremented.bestScore, bestScore)
    })),
    Match.tag("OptimizationCompleted", ({ bestScore }) => ({
      ...incremented,
      completed: true,
      bestScore: Math.max(incremented.bestScore, bestScore)
    })),
    Match.exhaustive
  )
}

/**
 * Summarize COPRO events into semantically meaningful counters.
 *
 * @since 0.2.0
 * @category combinators
 */
export const summarizeCOPROEvents = (events: ReadonlyArray<COPROEvent>): COPROEventSummary =>
  Arr.reduce(events, EMPTY_COPRO_EVENT_SUMMARY, summarizeEvent)
