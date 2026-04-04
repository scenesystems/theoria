/**
 * GEPA semantic summary projection.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match } from "effect"
import type { GEPAEvent } from "./events.js"

/**
 * Semantic summary projected from GEPA events.
 *
 * @since 0.1.0
 * @category models
 */
export type GEPAEventSummary = Readonly<{
  readonly totalEvents: number
  readonly iterationStartedCount: number
  readonly mergeCheckedCount: number
  readonly mutationProposedCount: number
  readonly acceptanceEvaluatedCount: number
  readonly acceptanceAcceptedCount: number
  readonly gate1PassedCount: number
  readonly fullValsetEvaluatedCount: number
  readonly paretoUpdatedCount: number
  readonly iterationCompletedCount: number
  readonly iterationWithAcceptedCandidateCount: number
  readonly optimizationCompletedSeen: boolean
  readonly optimizationIterationCount: number
  readonly optimizationBestCandidateIdSeen: boolean
  readonly optimizationBestCandidateId: string
  readonly optimizationFrontierSize: number
  readonly lastReportedFrontierSize: number
  readonly maxFrontierSize: number
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
  maxFrontierSize: Math.max(summary.maxFrontierSize, frontierSize)
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
 * Summarize GEPA stream events into semantically meaningful counters.
 *
 * @since 0.1.0
 * @category combinators
 */
export const summarizeGEPAEvents = (
  events: ReadonlyArray<GEPAEvent>
): GEPAEventSummary => Arr.reduce(events, EMPTY_GEPA_EVENT_SUMMARY, summarizeEvent)
