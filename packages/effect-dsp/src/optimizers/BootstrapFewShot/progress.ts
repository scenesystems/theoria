/**
 * BootstrapFewShot event progress formatting and summaries.
 *
 * @since 0.1.0
 */
import type { Effect } from "effect"
import { Array as Arr, Data, Match, Stream } from "effect"
import type { BootstrapEvent } from "../../Optimizer/events/bootstrap.js"

/**
 * Formatted BootstrapFewShot progress line.
 *
 * @since 0.2.0
 * @category models
 */
export class BootstrapProgressLine extends Data.Class<{
  readonly tag: BootstrapEvent["_tag"]
  readonly details: string
  readonly text: string
}> {
  static project = (event: BootstrapEvent): BootstrapProgressLine => toProgressLine(event._tag, detailsFromEvent(event))

  static tap =
    <E, R>(onProgress: BootstrapProgressSink<E, R>) =>
    <SE, SR>(stream: Stream.Stream<BootstrapEvent, SE, SR>): Stream.Stream<BootstrapEvent, E | SE, R | SR> =>
      stream.pipe(Stream.tap((event) => onProgress(BootstrapProgressLine.project(event))))
}

const toProgressLine = (
  tag: BootstrapProgressLine["tag"],
  details: string
): BootstrapProgressLine =>
  new BootstrapProgressLine({
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
 * Progress sink for formatted BootstrapFewShot lines.
 *
 * @since 0.1.0
 * @category models
 */
export type BootstrapProgressSink<E = never, R = never> = (
  line: BootstrapProgressLine
) => Effect.Effect<void, E, R>

/**
 * Semantic summary projected from BootstrapFewShot events.
 *
 * @since 0.2.0
 * @category models
 */
export class BootstrapEventSummary extends Data.Class<{
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
}> {
  static make = (options: {
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
  }): BootstrapEventSummary => new BootstrapEventSummary(options)

  static summarize = (events: ReadonlyArray<BootstrapEvent>): BootstrapEventSummary =>
    Arr.reduce(events, EMPTY_BOOTSTRAP_EVENT_SUMMARY, summarizeEvent)
}

const EMPTY_BOOTSTRAP_EVENT_SUMMARY = BootstrapEventSummary.make({
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
})

const summarizeEvent = (
  summary: BootstrapEventSummary,
  event: BootstrapEvent
): BootstrapEventSummary => {
  const incremented = BootstrapEventSummary.make({
    ...summary,
    totalEvents: summary.totalEvents + 1
  })

  return Match.value(event).pipe(
    Match.tag("RoundStarted", () =>
      BootstrapEventSummary.make({
        ...incremented,
        roundsStarted: incremented.roundsStarted + 1
      })),
    Match.tag("TraceAccepted", () =>
      BootstrapEventSummary.make({
        ...incremented,
        traceAcceptedCount: incremented.traceAcceptedCount + 1
      })),
    Match.tag("TraceRejected", () =>
      BootstrapEventSummary.make({
        ...incremented,
        traceRejectedCount: incremented.traceRejectedCount + 1
      })),
    Match.tag("RoundCompleted", () =>
      BootstrapEventSummary.make({
        ...incremented,
        roundsCompleted: incremented.roundsCompleted + 1
      })),
    Match.tag("BootstrapFallbackActivated", () =>
      BootstrapEventSummary.make({
        ...incremented,
        fallbackActivatedSeen: true
      })),
    Match.tag("BootstrapFallbackCompleted", () =>
      BootstrapEventSummary.make({
        ...incremented,
        fallbackCompletedSeen: true
      })),
    Match.tag("BootstrapCompleted", ({ totalDemos, roundsUsed, fallbackUsed }) =>
      BootstrapEventSummary.make({
        ...incremented,
        completedSeen: true,
        totalDemos,
        roundsUsed,
        fallbackUsed
      })),
    Match.exhaustive
  )
}
