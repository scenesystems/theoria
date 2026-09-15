/**
 * Folds GEPA lifecycle events into progress counters and terminal state.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean as Bool, Match, Number as Num, Schema } from "effect"
import type { GEPAEvent } from "./events.js"

/**
 * Aggregates event counts, frontier sizes, and the latest completion payload.
 *
 * @since 0.1.0
 * @category models
 */
export class GEPAEventSummary extends Schema.Class<GEPAEventSummary>("GEPAEventSummary")({
  /** Number of input events across all tags. */
  totalEvents: Schema.Number,
  /** Number of `IterationStarted` events. */
  iterationStartedCount: Schema.Number,
  /** Number of attempted and skipped merge checks. */
  mergeCheckedCount: Schema.Number,
  /** Number of emitted mutation proposals. */
  mutationProposedCount: Schema.Number,
  /** Number of mutation acceptance decisions. */
  acceptanceEvaluatedCount: Schema.Number,
  /** Number of accepted mutation decisions. */
  acceptanceAcceptedCount: Schema.Number,
  /** Number of mutations that improved the evaluated subsample. */
  gate1PassedCount: Schema.Number,
  /** Number of acceptance events that report full validation evaluation. */
  fullValsetEvaluatedCount: Schema.Number,
  /** Number of frontier updates. */
  paretoUpdatedCount: Schema.Number,
  /** Number of completed iterations. */
  iterationCompletedCount: Schema.Number,
  /** Number of completed iterations that accepted a mutation candidate. */
  iterationWithAcceptedCandidateCount: Schema.Number,
  /** Whether an `OptimizationCompleted` event was observed. */
  optimizationCompletedSeen: Schema.Boolean,
  /** Iteration count from the most recent completion event. */
  optimizationIterationCount: Schema.Number,
  /** Whether a completion event supplied a selected candidate ID. */
  optimizationBestCandidateIdSeen: Schema.Boolean,
  /** Selected candidate ID from the most recent completion event. */
  optimizationBestCandidateId: Schema.String,
  /** Frontier size from the most recent completion event. */
  optimizationFrontierSize: Schema.Number,
  /** Frontier size from the most recent event that reports one. */
  lastReportedFrontierSize: Schema.Number,
  /** Largest reported frontier size. */
  maxFrontierSize: Schema.Number,
  /** Total parent-weight rows across all frontier updates. */
  parentWeightEntriesObserved: Schema.Number
}) {}

const EMPTY_GEPA_EVENT_SUMMARY = new GEPAEventSummary({
  totalEvents: 0,
  iterationStartedCount: 0,
  mergeCheckedCount: 0,
  mutationProposedCount: 0,
  acceptanceEvaluatedCount: 0,
  acceptanceAcceptedCount: 0,
  gate1PassedCount: 0,
  fullValsetEvaluatedCount: 0,
  paretoUpdatedCount: 0,
  iterationCompletedCount: 0,
  iterationWithAcceptedCandidateCount: 0,
  optimizationCompletedSeen: false,
  optimizationIterationCount: 0,
  optimizationBestCandidateIdSeen: false,
  optimizationBestCandidateId: "",
  optimizationFrontierSize: 0,
  lastReportedFrontierSize: 0,
  maxFrontierSize: 0,
  parentWeightEntriesObserved: 0
})

const withFrontierSize = (
  summary: GEPAEventSummary,
  frontierSize: number
): GEPAEventSummary =>
  new GEPAEventSummary({
    ...summary,
    lastReportedFrontierSize: frontierSize,
    maxFrontierSize: Num.max(summary.maxFrontierSize, frontierSize)
  })

const summarizeEvent = (
  summary: GEPAEventSummary,
  event: GEPAEvent
): GEPAEventSummary => {
  const incremented = new GEPAEventSummary({
    ...summary,
    totalEvents: Num.increment(summary.totalEvents)
  })

  return Match.value(event).pipe(
    Match.tag("IterationStarted", ({ frontierSize }) =>
      withFrontierSize(
        new GEPAEventSummary({
          ...incremented,
          iterationStartedCount: Num.increment(incremented.iterationStartedCount)
        }),
        frontierSize
      )),
    Match.tag("MergeChecked", () =>
      new GEPAEventSummary({
        ...incremented,
        mergeCheckedCount: Num.increment(incremented.mergeCheckedCount)
      })),
    Match.tag("MutationProposed", () =>
      new GEPAEventSummary({
        ...incremented,
        mutationProposedCount: Num.increment(incremented.mutationProposedCount)
      })),
    Match.tag("AcceptanceEvaluated", ({ accepted, gate1Passed, fullValsetEvaluated }) =>
      new GEPAEventSummary({
        ...incremented,
        acceptanceEvaluatedCount: Num.increment(incremented.acceptanceEvaluatedCount),
        acceptanceAcceptedCount: Num.sum(
          incremented.acceptanceAcceptedCount,
          Bool.match(accepted, { onFalse: () => 0, onTrue: () => 1 })
        ),
        gate1PassedCount: Num.sum(
          incremented.gate1PassedCount,
          Bool.match(gate1Passed, { onFalse: () => 0, onTrue: () => 1 })
        ),
        fullValsetEvaluatedCount: Num.sum(
          incremented.fullValsetEvaluatedCount,
          Bool.match(fullValsetEvaluated, { onFalse: () => 0, onTrue: () => 1 })
        )
      })),
    Match.tag("ParetoUpdated", ({ frontierIndices, parentWeights }) =>
      withFrontierSize(
        new GEPAEventSummary({
          ...incremented,
          paretoUpdatedCount: Num.increment(incremented.paretoUpdatedCount),
          parentWeightEntriesObserved: Num.sum(
            incremented.parentWeightEntriesObserved,
            Arr.length(parentWeights)
          )
        }),
        Arr.length(frontierIndices)
      )),
    Match.tag("IterationCompleted", ({ acceptedCandidate, frontierSize }) =>
      withFrontierSize(
        new GEPAEventSummary({
          ...incremented,
          iterationCompletedCount: Num.increment(incremented.iterationCompletedCount),
          iterationWithAcceptedCandidateCount: Num.sum(
            incremented.iterationWithAcceptedCandidateCount,
            Bool.match(acceptedCandidate, { onFalse: () => 0, onTrue: () => 1 })
          )
        }),
        frontierSize
      )),
    Match.tag("OptimizationCompleted", ({ iterations, bestCandidateId, frontierSize }) =>
      withFrontierSize(
        new GEPAEventSummary({
          ...incremented,
          optimizationCompletedSeen: true,
          optimizationIterationCount: iterations,
          optimizationBestCandidateIdSeen: true,
          optimizationBestCandidateId: bestCandidateId,
          optimizationFrontierSize: frontierSize
        }),
        frontierSize
      )),
    Match.exhaustive
  )
}

/**
 * Counts GEPA iterations, mutations, acceptance decisions, and frontier updates.
 *
 * @remarks
 * Repeated completion events overwrite completion fields. Frontier maxima are
 * computed from start, frontier-update, iteration-completion, and optimization-
 * completion events.
 *
 * @param events - Events to fold in their supplied order.
 * @returns Counters and the latest reported completion state.
 *
 * @since 0.1.0
 * @category combinators
 */
export const summarizeGEPAEvents = (
  events: Iterable<GEPAEvent>
): GEPAEventSummary => Arr.reduce(events, EMPTY_GEPA_EVENT_SUMMARY, summarizeEvent)
