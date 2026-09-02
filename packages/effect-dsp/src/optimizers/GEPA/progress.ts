/**
 * Formats GEPA events and exposes progress-stream projections.
 *
 * @since 0.1.0
 */
import { Match, Stream } from "effect"
import type { Effect } from "effect"
import type { GEPAEvent } from "./events.js"

/**
 * Carries a GEPA tag with progress text that reduces instructions and frontier arrays.
 *
 * @since 0.1.0
 * @category models
 */
export type GEPAProgressLine = Readonly<{
  /** Original event discriminator. */
  readonly tag: GEPAEvent["_tag"]
  /** Space-separated key-value fields selected for display. */
  readonly details: string
  /** Event tag followed by `details` when details are present. */
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
 * Formats an event without exposing a proposed instruction's full text.
 *
 * @remarks
 * `MutationProposed` reports instruction length. Array-valued frontier data is
 * reduced to counts. Other identifiers and numeric fields are included as
 * supplied, without locale-specific formatting.
 *
 * @param event - Lifecycle event to format.
 * @returns A new line value containing the original tag.
 *
 * @since 0.1.0
 * @category formatters
 */
export const formatGEPAProgressEvent = (event: GEPAEvent): GEPAProgressLine =>
  toProgressLine(event._tag, detailsFromEvent(event))

/**
 * Consumes one reduced GEPA progress line with caller-defined Effect channels.
 *
 * @typeParam E - Expected failure from the progress sink.
 * @typeParam R - Services required by the progress sink.
 *
 * @since 0.1.0
 * @category models
 */
export type GEPAProgressSink<E = never, R = never> = (
  line: GEPAProgressLine
) => Effect.Effect<void, E, R>

/**
 * Adds ordered GEPA progress observation to an event stream.
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
export const tapGEPAProgress =
  <E, R>(onProgress: GEPAProgressSink<E, R>) =>
  <SE, SR>(stream: Stream.Stream<GEPAEvent, SE, SR>): Stream.Stream<GEPAEvent, E | SE, R | SR> =>
    stream.pipe(
      Stream.tap((event) => onProgress(formatGEPAProgressEvent(event)))
    )

/**
 * Aggregates observed GEPA lifecycle counts and frontier data.
 *
 * @since 0.1.0
 * @category models
 */
export type { GEPAEventSummary } from "./progressSummary.js"

/**
 * Folds GEPA events in array order into a fresh summary.
 *
 * @since 0.1.0
 * @category combinators
 */
export { summarizeGEPAEvents } from "./progressSummary.js"
