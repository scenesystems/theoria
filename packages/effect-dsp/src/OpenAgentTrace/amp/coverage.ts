/**
 * Amp-specific explicit coverage reporting.
 *
 * @since 0.2.0
 */
import { Array as Arr } from "effect"

import { OpenAgentTraceAdapterCoverageGap } from "../adapterSchema.js"
import { OpenAgentTraceCoverage } from "../schema.js"

const coveragePair = (options: {
  readonly gapId: string
  readonly sourceKind: string
  readonly sourceRef: Record<string, string>
  readonly reason: string
  readonly severity: "info" | "warning" | "error"
}) => ({
  adapter: OpenAgentTraceAdapterCoverageGap.make(options),
  record: OpenAgentTraceCoverage.make(options)
})

/**
 * Build explicit adapter and record coverage gaps for Amp normalization.
 *
 * @since 0.2.0
 * @category combinators
 */
export const ampCoverage = (options: {
  readonly sessionId: string
  readonly missingUsage: boolean
  readonly missingBranchLineage: boolean
}) => {
  const gaps = Arr.fromIterable([
    ...(options.missingBranchLineage
      ? [coveragePair({
        gapId: `amp:${options.sessionId}:branch-lineage`,
        sourceKind: "branch-lineage",
        sourceRef: { sessionId: options.sessionId },
        reason:
          "Amp captures currently normalize to a conservative linear path because explicit branch ancestry is not exposed.",
        severity: "warning"
      })]
      : []),
    ...(options.missingUsage
      ? [coveragePair({
        gapId: `amp:${options.sessionId}:usage-provenance`,
        sourceKind: "usage-provenance",
        sourceRef: { sessionId: options.sessionId },
        reason: "This Amp capture does not expose assistant usage samples for every turn.",
        severity: "info"
      })]
      : [])
  ])

  return {
    adapterGaps: gaps.map((gap) => gap.adapter),
    recordGaps: gaps.map((gap) => gap.record)
  }
}
