/**
 * Formats GEPA events and exposes progress-stream projections.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean as Bool, Inspectable, Match, Schema, Stream, String as Str } from "effect"
import type { Effect } from "effect"
import { type GEPAEvent, GEPAEventSchema } from "./events.js"

const GEPAEventTag = Schema.typeSchema(Schema.pluck(GEPAEventSchema, "_tag"))

/**
 * Carries a GEPA tag with progress text that reduces instructions and frontier arrays.
 *
 * @since 0.1.0
 * @category models
 */
export class GEPAProgressLine extends Schema.Class<GEPAProgressLine>("GEPAProgressLine")({
  /** Original event discriminator. */
  tag: GEPAEventTag,
  /** Space-separated key-value fields selected for display. */
  details: Schema.String,
  /** Event tag followed by `details` when details are present. */
  text: Schema.String
}) {}

const renderValue = (label: string, value: unknown): string => Str.concat(label, Inspectable.toStringUnknown(value))

const renderString = (label: string, value: string): string => Str.concat(label, value)

const joinDetails = (details: Iterable<string>): string => Arr.join(Arr.fromIterable(details), " ")

const toProgressLine = (
  tag: GEPAProgressLine["tag"],
  details: string
): GEPAProgressLine =>
  new GEPAProgressLine({
    tag,
    details,
    text: Bool.match(Str.isNonEmpty(details), {
      onFalse: () => tag,
      onTrue: () => Str.concat(Str.concat(tag, " "), details)
    })
  })

const detailsFromEvent = (event: GEPAEvent): string =>
  Match.value(event).pipe(
    Match.tag(
      "IterationStarted",
      ({ iteration, frontierSize }) =>
        joinDetails(Arr.make(renderValue("iteration=", iteration), renderValue("frontierSize=", frontierSize)))
    ),
    Match.tag(
      "MergeChecked",
      ({ iteration, attempted, accepted, mergeBudgetRemaining }) =>
        joinDetails(
          Arr.make(
            renderValue("iteration=", iteration),
            renderValue("attempted=", attempted),
            renderValue("accepted=", accepted),
            renderValue("mergeBudgetRemaining=", mergeBudgetRemaining)
          )
        )
    ),
    Match.tag(
      "MutationProposed",
      ({ iteration, parentId, mutatedCandidateId, predictorName, instruction }) =>
        joinDetails(
          Arr.make(
            renderValue("iteration=", iteration),
            renderString("parentId=", parentId),
            renderString("mutatedCandidateId=", mutatedCandidateId),
            renderString("predictor=", predictorName),
            renderValue("instructionLength=", Str.length(instruction))
          )
        )
    ),
    Match.tag(
      "AcceptanceEvaluated",
      ({ iteration, accepted, gate1Passed, fullValsetEvaluated, previousSubsampleSum, mutatedSubsampleSum }) =>
        joinDetails(
          Arr.make(
            renderValue("iteration=", iteration),
            renderValue("accepted=", accepted),
            renderValue("gate1Passed=", gate1Passed),
            renderValue("fullValsetEvaluated=", fullValsetEvaluated),
            renderValue("previousSubsampleSum=", previousSubsampleSum),
            renderValue("mutatedSubsampleSum=", mutatedSubsampleSum)
          )
        )
    ),
    Match.tag(
      "ParetoUpdated",
      ({ iteration, frontierIndices, dominatedIndices, parentWeights }) =>
        joinDetails(
          Arr.make(
            renderValue("iteration=", iteration),
            renderValue("frontierCount=", Arr.length(frontierIndices)),
            renderValue("dominatedCount=", Arr.length(dominatedIndices)),
            renderValue("parentWeightCount=", Arr.length(parentWeights))
          )
        )
    ),
    Match.tag(
      "IterationCompleted",
      ({ iteration, acceptedCandidate, frontierSize }) =>
        joinDetails(
          Arr.make(
            renderValue("iteration=", iteration),
            renderValue("acceptedCandidate=", acceptedCandidate),
            renderValue("frontierSize=", frontierSize)
          )
        )
    ),
    Match.tag(
      "OptimizationCompleted",
      ({ iterations, bestCandidateId, frontierSize }) =>
        joinDetails(
          Arr.make(
            renderValue("iterations=", iterations),
            renderString("bestCandidateId=", bestCandidateId),
            renderValue("frontierSize=", frontierSize)
          )
        )
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
