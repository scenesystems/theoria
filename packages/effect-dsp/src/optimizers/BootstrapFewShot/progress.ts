/**
 * Formats BootstrapFewShot events and folds them into progress summaries.
 *
 * @since 0.1.0
 */
import type { Effect } from "effect"
import { Array as Arr, Boolean as Bool, Inspectable, Match, Number as Num, Schema, Stream, String as Str } from "effect"
import { type BootstrapEvent, BootstrapEventSchema } from "../../Optimizer/events/bootstrap.js"

const BootstrapEventTag = Schema.typeSchema(Schema.pluck(BootstrapEventSchema, "_tag"))

/**
 * Carries all formatted BootstrapFewShot event fields with the original event tag.
 *
 * @since 0.1.0
 * @category models
 */
export class BootstrapProgressLine extends Schema.Class<BootstrapProgressLine>("BootstrapProgressLine")({
  /** Original event discriminator. */
  tag: BootstrapEventTag,
  /** Space-separated key-value fields selected for display. */
  details: Schema.String,
  /** Event tag followed by `details` when details are present. */
  text: Schema.String
}) {}

const toProgressLine = (
  tag: BootstrapProgressLine["tag"],
  details: string
): BootstrapProgressLine =>
  new BootstrapProgressLine({
    tag,
    details,
    text: Bool.match(Str.isNonEmpty(details), {
      onFalse: () => tag,
      onTrue: () => Str.concat(Str.concat(tag, " "), details)
    })
  })

const renderValue = (label: string, value: number): string => Str.concat(label, Inspectable.toStringUnknown(value))

const renderFlag = (label: string, value: boolean): string => Str.concat(label, Inspectable.toStringUnknown(value))

const joinDetails = (details: Iterable<string>): string => Arr.join(Arr.fromIterable(details), " ")

const detailsFromEvent = (event: BootstrapEvent): string =>
  Match.value(event).pipe(
    Match.tag("RoundStarted", ({ round, maxRounds }) =>
      joinDetails(Arr.make(renderValue("round=", round), renderValue("maxRounds=", maxRounds)))),
    Match.tag("TraceAccepted", ({ moduleName, score }) =>
      joinDetails(Arr.make(Str.concat("module=", moduleName), renderValue("score=", score)))),
    Match.tag(
      "TraceRejected",
      ({ moduleName, score, threshold }) =>
        joinDetails(
          Arr.make(
            Str.concat("module=", moduleName),
            renderValue("score=", score),
            renderValue("threshold=", threshold)
          )
        )
    ),
    Match.tag("RoundCompleted", ({ round, demosCollected }) =>
      joinDetails(Arr.make(renderValue("round=", round), renderValue("demosCollected=", demosCollected)))),
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
        joinDetails(
          Arr.make(
            renderValue("threshold=", threshold),
            renderValue("roundsAttempted=", roundsAttempted),
            renderValue("acceptedTraces=", acceptedTraces),
            renderValue("rejectedTraces=", rejectedTraces),
            renderFlag("bestScoreSeen=", bestScoreSeen),
            renderValue("bestScore=", bestScore),
            renderValue("averageScore=", averageScore),
            renderValue("fallbackLabeledDemoCount=", fallbackLabeledDemoCount)
          )
        )
    ),
    Match.tag(
      "BootstrapFallbackCompleted",
      ({ fallbackDemosAdded, totalDemos, roundsUsed }) =>
        joinDetails(
          Arr.make(
            renderValue("fallbackDemosAdded=", fallbackDemosAdded),
            renderValue("totalDemos=", totalDemos),
            renderValue("roundsUsed=", roundsUsed)
          )
        )
    ),
    Match.tag(
      "BootstrapCompleted",
      ({ totalDemos, roundsUsed, fallbackUsed }) =>
        joinDetails(
          Arr.make(
            renderValue("totalDemos=", totalDemos),
            renderValue("roundsUsed=", roundsUsed),
            renderFlag("fallbackUsed=", fallbackUsed)
          )
        )
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
export class BootstrapEventSummary extends Schema.Class<BootstrapEventSummary>("BootstrapEventSummary")({
  /** Number of input events across all tags. */
  totalEvents: Schema.Number,
  /** Number of `RoundStarted` events. */
  roundsStarted: Schema.Number,
  /** Number of `RoundCompleted` events. */
  roundsCompleted: Schema.Number,
  /** Number of accepted root traces. */
  traceAcceptedCount: Schema.Number,
  /** Number of rejected or missing root traces. */
  traceRejectedCount: Schema.Number,
  /** Whether a `BootstrapFallbackActivated` event was observed. */
  fallbackActivatedSeen: Schema.Boolean,
  /** Whether a `BootstrapFallbackCompleted` event was observed. */
  fallbackCompletedSeen: Schema.Boolean,
  /** Fallback flag from the most recent completion event. */
  fallbackUsed: Schema.Boolean,
  /** Whether a `BootstrapCompleted` event was observed. */
  completedSeen: Schema.Boolean,
  /** Demonstration count from the most recent completion event. */
  totalDemos: Schema.Number,
  /** Attempted round count from the most recent completion event. */
  roundsUsed: Schema.Number
}) {}

const EMPTY_BOOTSTRAP_EVENT_SUMMARY = new BootstrapEventSummary({
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
  const incremented = new BootstrapEventSummary({
    ...summary,
    totalEvents: Num.increment(summary.totalEvents)
  })

  return Match.value(event).pipe(
    Match.tag("RoundStarted", () =>
      new BootstrapEventSummary({
        ...incremented,
        roundsStarted: Num.increment(incremented.roundsStarted)
      })),
    Match.tag("TraceAccepted", () =>
      new BootstrapEventSummary({
        ...incremented,
        traceAcceptedCount: Num.increment(incremented.traceAcceptedCount)
      })),
    Match.tag("TraceRejected", () =>
      new BootstrapEventSummary({
        ...incremented,
        traceRejectedCount: Num.increment(incremented.traceRejectedCount)
      })),
    Match.tag("RoundCompleted", () =>
      new BootstrapEventSummary({
        ...incremented,
        roundsCompleted: Num.increment(incremented.roundsCompleted)
      })),
    Match.tag("BootstrapFallbackActivated", () =>
      new BootstrapEventSummary({
        ...incremented,
        fallbackActivatedSeen: true
      })),
    Match.tag("BootstrapFallbackCompleted", () =>
      new BootstrapEventSummary({
        ...incremented,
        fallbackCompletedSeen: true
      })),
    Match.tag("BootstrapCompleted", ({ totalDemos, roundsUsed, fallbackUsed }) =>
      new BootstrapEventSummary({
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
  events: Schema.Array$<typeof BootstrapEventSchema>["Type"]
): BootstrapEventSummary => Arr.reduce(events, EMPTY_BOOTSTRAP_EVENT_SUMMARY, summarizeEvent)
