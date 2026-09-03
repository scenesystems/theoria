/**
 * Folds GEPA lifecycle events into progress counters and terminal state.
 *
 * @since 0.1.0
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Match } from "effect"
import type { GEPAEvent } from "./events.js"

/**
 * Aggregates event counts, frontier sizes, and the latest completion payload.
 *
 * @since 0.1.0
 * @category models
 */
export type GEPAEventSummary = Readonly<{
  /** Number of input events across all tags. */
  readonly totalEvents: number
  /** Number of `IterationStarted` events. */
  readonly iterationStartedCount: number
  /** Number of attempted and skipped merge checks. */
  readonly mergeCheckedCount: number
  /** Number of emitted mutation proposals. */
  readonly mutationProposedCount: number
  /** Number of mutation acceptance decisions. */
  readonly acceptanceEvaluatedCount: number
  /** Number of accepted mutation decisions. */
  readonly acceptanceAcceptedCount: number
  /** Number of mutations that improved the evaluated subsample. */
  readonly gate1PassedCount: number
  /** Number of acceptance events that report full validation evaluation. */
  readonly fullValsetEvaluatedCount: number
  /** Number of frontier updates. */
  readonly paretoUpdatedCount: number
  /** Number of completed iterations. */
  readonly iterationCompletedCount: number
  /** Number of completed iterations that accepted a mutation candidate. */
  readonly iterationWithAcceptedCandidateCount: number
  /** Whether an `OptimizationCompleted` event was observed. */
  readonly optimizationCompletedSeen: boolean
  /** Iteration count from the most recent completion event. */
  readonly optimizationIterationCount: number
  /** Whether a completion event supplied a selected candidate ID. */
  readonly optimizationBestCandidateIdSeen: boolean
  /** Selected candidate ID from the most recent completion event. */
  readonly optimizationBestCandidateId: string
  /** Frontier size from the most recent completion event. */
  readonly optimizationFrontierSize: number
  /** Frontier size from the most recent event that reports one. */
  readonly lastReportedFrontierSize: number
  /** Largest reported frontier size. */
  readonly maxFrontierSize: number
  /** Total parent-weight rows across all frontier updates. */
  readonly parentWeightEntriesObserved: number
}>

const EMPTY_GEPA_EVENT_SUMMARY: GEPAEventSummary = {
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
}

const withFrontierSize = (
  summary: GEPAEventSummary,
  frontierSize: number
): GEPAEventSummary => ({
  ...summary,
  lastReportedFrontierSize: frontierSize,
  maxFrontierSize: Numeric.max(summary.maxFrontierSize, frontierSize)
})

const summarizeEvent = (
  summary: GEPAEventSummary,
  event: GEPAEvent
): GEPAEventSummary => {
  const incremented: GEPAEventSummary = {
    ...summary,
    totalEvents: summary.totalEvents + 1
  }

  return Match.value(event).pipe(
    Match.tag("IterationStarted", ({ frontierSize }) =>
      withFrontierSize(
        {
          ...incremented,
          iterationStartedCount: incremented.iterationStartedCount + 1
        },
        frontierSize
      )),
    Match.tag("MergeChecked", () => ({
      ...incremented,
      mergeCheckedCount: incremented.mergeCheckedCount + 1
    })),
    Match.tag("MutationProposed", () => ({
      ...incremented,
      mutationProposedCount: incremented.mutationProposedCount + 1
    })),
    Match.tag("AcceptanceEvaluated", ({ accepted, gate1Passed, fullValsetEvaluated }) => ({
      ...incremented,
      acceptanceEvaluatedCount: incremented.acceptanceEvaluatedCount + 1,
      acceptanceAcceptedCount: incremented.acceptanceAcceptedCount + (accepted
        ? 1
        : 0),
      gate1PassedCount: incremented.gate1PassedCount + (gate1Passed
        ? 1
        : 0),
      fullValsetEvaluatedCount: incremented.fullValsetEvaluatedCount + (fullValsetEvaluated
        ? 1
        : 0)
    })),
    Match.tag("ParetoUpdated", ({ frontierIndices, parentWeights }) =>
      withFrontierSize(
        {
          ...incremented,
          paretoUpdatedCount: incremented.paretoUpdatedCount + 1,
          parentWeightEntriesObserved: incremented.parentWeightEntriesObserved + parentWeights.length
        },
        frontierIndices.length
      )),
    Match.tag("IterationCompleted", ({ acceptedCandidate, frontierSize }) =>
      withFrontierSize(
        {
          ...incremented,
          iterationCompletedCount: incremented.iterationCompletedCount + 1,
          iterationWithAcceptedCandidateCount: incremented.iterationWithAcceptedCandidateCount + (acceptedCandidate
            ? 1
            : 0)
        },
        frontierSize
      )),
    Match.tag("OptimizationCompleted", ({ iterations, bestCandidateId, frontierSize }) =>
      withFrontierSize(
        {
          ...incremented,
          optimizationCompletedSeen: true,
          optimizationIterationCount: iterations,
          optimizationBestCandidateIdSeen: true,
          optimizationBestCandidateId: bestCandidateId,
          optimizationFrontierSize: frontierSize
        },
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
  events: ReadonlyArray<GEPAEvent>
): GEPAEventSummary => Arr.reduce(events, EMPTY_GEPA_EVENT_SUMMARY, summarizeEvent)
