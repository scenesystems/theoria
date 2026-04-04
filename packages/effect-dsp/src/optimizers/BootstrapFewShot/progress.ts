/**
 * BootstrapFewShot event progress formatting and summaries.
 *
 * @since 0.1.0
 */
import type { Effect } from "effect"
import { Array as Arr, Match, Stream } from "effect"
import type { BootstrapEvent } from "../../Optimizer/events/bootstrap.js"

/**
 * Formatted BootstrapFewShot progress line.
 *
 * @since 0.1.0
 * @category models
 */
export type BootstrapProgressLine = Readonly<{
  readonly tag: BootstrapEvent["_tag"]
  readonly details: string
  readonly text: string
}>

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
 * Deterministically format a BootstrapFewShot event as one progress line.
 *
 * @since 0.1.0
 * @category formatters
 */
export const formatBootstrapProgressEvent = (event: BootstrapEvent): BootstrapProgressLine =>
  toProgressLine(event._tag, detailsFromEvent(event))

/**
 * Progress sink for formatted BootstrapFewShot lines.
 *
 * @since 0.1.0
 * @category models
 */
export type BootstrapProgressSink<E = never, R = never> = (
  line: BootstrapProgressLine
) => Effect.Effect<void, E, R>

/**
 * Tap formatted BootstrapFewShot progress lines from an event stream.
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
 * Semantic summary projected from BootstrapFewShot events.
 *
 * @since 0.1.0
 * @category models
 */
export type BootstrapEventSummary = Readonly<{
  readonly totalEvents: number
  readonly roundsStarted: number
  readonly roundsCompleted: number
  readonly traceAcceptedCount: number
  readonly traceRejectedCount: number
  readonly fallbackActivatedSeen: boolean
  readonly fallbackCompletedSeen: boolean
  readonly fallbackUsed: boolean
  readonly completedSeen: boolean
  readonly totalDemos: number
  readonly roundsUsed: number
}>

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
 * Summarize BootstrapFewShot stream events into semantically meaningful counters.
 *
 * @since 0.1.0
 * @category combinators
 */
export const summarizeBootstrapEvents = (
  events: ReadonlyArray<BootstrapEvent>
): BootstrapEventSummary => Arr.reduce(events, EMPTY_BOOTSTRAP_EVENT_SUMMARY, summarizeEvent)
