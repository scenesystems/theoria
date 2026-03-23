/**
 * GEPA event progress formatting and summaries.
 *
 * @since 0.0.0
 */
import { Match, Stream } from "effect"
import type { Effect } from "effect"
import type { GEPAEvent } from "./events.js"

/**
 * Formatted GEPA progress line.
 *
 * @since 0.0.0
 * @category models
 */
export type GEPAProgressLine = Readonly<{
  readonly tag: GEPAEvent["_tag"]
  readonly details: string
  readonly text: string
}>

const toProgressLine = (
  tag: GEPAProgressLine["tag"],
  details: string
): GEPAProgressLine => ({
  tag,
  details,
  text: details.length > 0
    ? `${tag} ${details}`
    : tag
})

const detailsFromEvent = (event: GEPAEvent): string =>
  Match.value(event).pipe(
    Match.tag(
      "IterationStarted",
      ({ iteration, frontierSize }) => `iteration=${iteration} frontierSize=${frontierSize}`
    ),
    Match.tag(
      "MergeChecked",
      ({ iteration, attempted, accepted, mergeBudgetRemaining }) =>
        `iteration=${iteration} attempted=${attempted} accepted=${accepted} mergeBudgetRemaining=${mergeBudgetRemaining}`
    ),
    Match.tag(
      "MutationProposed",
      ({ iteration, parentId, mutatedCandidateId, predictorName, instruction }) =>
        `iteration=${iteration} parentId=${parentId} mutatedCandidateId=${mutatedCandidateId} predictor=${predictorName} instructionLength=${instruction.length}`
    ),
    Match.tag(
      "AcceptanceEvaluated",
      ({ iteration, accepted, gate1Passed, fullValsetEvaluated, previousSubsampleSum, mutatedSubsampleSum }) =>
        `iteration=${iteration} accepted=${accepted} gate1Passed=${gate1Passed} fullValsetEvaluated=${fullValsetEvaluated} previousSubsampleSum=${previousSubsampleSum} mutatedSubsampleSum=${mutatedSubsampleSum}`
    ),
    Match.tag(
      "ParetoUpdated",
      ({ iteration, frontierIndices, dominatedIndices, parentWeights }) =>
        `iteration=${iteration} frontierCount=${frontierIndices.length} dominatedCount=${dominatedIndices.length} parentWeightCount=${parentWeights.length}`
    ),
    Match.tag(
      "IterationCompleted",
      ({ iteration, acceptedCandidate, frontierSize }) =>
        `iteration=${iteration} acceptedCandidate=${acceptedCandidate} frontierSize=${frontierSize}`
    ),
    Match.tag(
      "OptimizationCompleted",
      ({ iterations, bestCandidateId, frontierSize }) =>
        `iterations=${iterations} bestCandidateId=${bestCandidateId} frontierSize=${frontierSize}`
    ),
    Match.exhaustive
  )

/**
 * Deterministically format a GEPA event as one progress line.
 *
 * @since 0.0.0
 * @category formatters
 */
export const formatGEPAProgressEvent = (event: GEPAEvent): GEPAProgressLine =>
  toProgressLine(event._tag, detailsFromEvent(event))

/**
 * Progress sink for formatted GEPA lines.
 *
 * @since 0.0.0
 * @category models
 */
export type GEPAProgressSink<E = never, R = never> = (
  line: GEPAProgressLine
) => Effect.Effect<void, E, R>

/**
 * Tap formatted GEPA progress lines from an event stream.
 *
 * @since 0.0.0
 * @category combinators
 */
export const tapGEPAProgress =
  <E, R>(onProgress: GEPAProgressSink<E, R>) =>
  <SE, SR>(stream: Stream.Stream<GEPAEvent, SE, SR>): Stream.Stream<GEPAEvent, E | SE, R | SR> =>
    stream.pipe(
      Stream.tap((event) => onProgress(formatGEPAProgressEvent(event)))
    )

/**
 * Semantic summary projected from GEPA events.
 *
 * @since 0.0.0
 * @category models
 */
export type { GEPAEventSummary } from "./progressSummary.js"

/**
 * Summarize GEPA stream events into semantically meaningful counters.
 *
 * @since 0.0.0
 * @category combinators
 */
export { summarizeGEPAEvents } from "./progressSummary.js"
