/**
 * Formats BootstrapFewShot events and folds them into progress summaries.
 *
 * @since 0.1.0
 */
import type { Effect } from "effect"
import { Array as Arr, Data, Match, Stream } from "effect"
import type { BootstrapEvent } from "../../Optimizer/events/bootstrap.js"

/**
 * Carries all formatted BootstrapFewShot event fields with the original event tag.
 *
 * @since 0.1.0
 * @category models
 */
export class BootstrapProgressLine extends Data.Class<{
  /** Original event discriminator. */
  readonly tag: BootstrapEvent["_tag"]
  /** Space-separated key-value fields selected for display. */
  readonly details: string
  /** Event tag followed by `details` when details are present. */
  readonly text: string
}> {}

const toProgressLine = (
  tag: BootstrapProgressLine["tag"],
  details: string
): BootstrapProgressLine => ({
  tag,
  details,
  text: details.length > 0
    ? `${tag} ${details}`
    : tag
})

const detailsFromEvent = (event: BootstrapEvent): string =>
  Match.value(event).pipe(
    Match.tag("RoundStarted", ({ round, maxRounds }) => `round=${round} maxRounds=${maxRounds}`),
    Match.tag("TraceAccepted", ({ moduleName, score }) => `module=${moduleName} score=${score}`),
    Match.tag(
      "TraceRejected",
      ({ moduleName, score, threshold }) => `module=${moduleName} score=${score} threshold=${threshold}`
    ),
    Match.tag("RoundCompleted", ({ round, demosCollected }) => `round=${round} demosCollected=${demosCollected}`),
    Match.tag(
      "BootstrapFallbackActivated",
      ({
        threshold,
        roundsAttempted,
        acceptedTraces,
        rejectedTraces,
        bestScoreSeen,
        bestScore,
        averageScore,
        fallbackLabeledDemoCount
      }) =>
        `threshold=${threshold} roundsAttempted=${roundsAttempted} acceptedTraces=${acceptedTraces} rejectedTraces=${rejectedTraces} bestScoreSeen=${bestScoreSeen} bestScore=${bestScore} averageScore=${averageScore} fallbackLabeledDemoCount=${fallbackLabeledDemoCount}`
    ),
    Match.tag(
      "BootstrapFallbackCompleted",
      ({ fallbackDemosAdded, totalDemos, roundsUsed }) =>
        `fallbackDemosAdded=${fallbackDemosAdded} totalDemos=${totalDemos} roundsUsed=${roundsUsed}`
    ),
    Match.tag(
      "BootstrapCompleted",
      ({ totalDemos, roundsUsed, fallbackUsed }) =>
        `totalDemos=${totalDemos} roundsUsed=${roundsUsed} fallbackUsed=${fallbackUsed}`
    ),
    Match.exhaustive
  )

/**
 * Formats every event field into a single non-localized line.
 *
 * @param event - Lifecycle event to format.
 * @returns A new line value containing the original tag.
 *
 * @since 0.1.0
 * @category formatters
 */
export const formatBootstrapProgressEvent = (event: BootstrapEvent): BootstrapProgressLine =>
  toProgressLine(event._tag, detailsFromEvent(event))

/**
 * Receives each BootstrapFewShot progress line with caller-defined Effect channels.
 *
 * @typeParam E - Expected failure from the progress sink.
 * @typeParam R - Services required by the progress sink.
 *
 * @since 0.1.0
 * @category models
 */
export type BootstrapProgressSink<E = never, R = never> = (
  line: BootstrapProgressLine
) => Effect.Effect<void, E, R>

/**
 * Observes each BootstrapFewShot event in stream order without changing its value.
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
export const tapBootstrapProgress =
  <E, R>(onProgress: BootstrapProgressSink<E, R>) =>
  <SE, SR>(stream: Stream.Stream<BootstrapEvent, SE, SR>): Stream.Stream<BootstrapEvent, E | SE, R | SR> =>
    stream.pipe(
      Stream.tap((event) => onProgress(formatBootstrapProgressEvent(event)))
    )

/**
 * Aggregates observed round, trace, fallback, and completion data.
 *
 * @since 0.1.0
 * @category models
 */
export class BootstrapEventSummary extends Data.Class<{
  /** Number of input events across all tags. */
  readonly totalEvents: number
  /** Number of `RoundStarted` events. */
  readonly roundsStarted: number
  /** Number of `RoundCompleted` events. */
  readonly roundsCompleted: number
  /** Number of accepted root traces. */
  readonly traceAcceptedCount: number
  /** Number of rejected or missing root traces. */
  readonly traceRejectedCount: number
  /** Whether a `BootstrapFallbackActivated` event was observed. */
  readonly fallbackActivatedSeen: boolean
  /** Whether a `BootstrapFallbackCompleted` event was observed. */
  readonly fallbackCompletedSeen: boolean
  /** Fallback flag from the most recent completion event. */
  readonly fallbackUsed: boolean
  /** Whether a `BootstrapCompleted` event was observed. */
  readonly completedSeen: boolean
  /** Demonstration count from the most recent completion event. */
  readonly totalDemos: number
  /** Attempted round count from the most recent completion event. */
  readonly roundsUsed: number
}> {}

const EMPTY_BOOTSTRAP_EVENT_SUMMARY: BootstrapEventSummary = {
  totalEvents: 0,
  roundsStarted: 0,
  roundsCompleted: 0,
  traceAcceptedCount: 0,
  traceRejectedCount: 0,
  fallbackActivatedSeen: false,
  fallbackCompletedSeen: false,
  fallbackUsed: false,
  completedSeen: false,
  totalDemos: 0,
  roundsUsed: 0
}

const summarizeEvent = (
  summary: BootstrapEventSummary,
  event: BootstrapEvent
): BootstrapEventSummary => {
  const incremented: BootstrapEventSummary = {
    ...summary,
    totalEvents: summary.totalEvents + 1
  }

  return Match.value(event).pipe(
    Match.tag("RoundStarted", () => ({
      ...incremented,
      roundsStarted: incremented.roundsStarted + 1
    })),
    Match.tag("TraceAccepted", () => ({
      ...incremented,
      traceAcceptedCount: incremented.traceAcceptedCount + 1
    })),
    Match.tag("TraceRejected", () => ({
      ...incremented,
      traceRejectedCount: incremented.traceRejectedCount + 1
    })),
    Match.tag("RoundCompleted", () => ({
      ...incremented,
      roundsCompleted: incremented.roundsCompleted + 1
    })),
    Match.tag("BootstrapFallbackActivated", () => ({
      ...incremented,
      fallbackActivatedSeen: true
    })),
    Match.tag("BootstrapFallbackCompleted", () => ({
      ...incremented,
      fallbackCompletedSeen: true
    })),
    Match.tag("BootstrapCompleted", ({ totalDemos, roundsUsed, fallbackUsed }) => ({
      ...incremented,
      completedSeen: true,
      totalDemos,
      roundsUsed,
      fallbackUsed
    })),
    Match.exhaustive
  )
}

/**
 * Counts bootstrap rounds, trace decisions, fallbacks, and completion state.
 *
 * @remarks
 * Repeated completion events overwrite `totalDemos`, `roundsUsed`, and
 * `fallbackUsed`; all other numeric fields are event counts.
 *
 * @param events - Events to fold in their supplied order.
 * @returns Counters and the latest completion payload.
 *
 * @since 0.1.0
 * @category combinators
 */
export const summarizeBootstrapEvents = (
  events: ReadonlyArray<BootstrapEvent>
): BootstrapEventSummary => Arr.reduce(events, EMPTY_BOOTSTRAP_EVENT_SUMMARY, summarizeEvent)
