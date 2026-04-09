/**
 * Synthetic coverage-gap projection for normalized open-agent-trace records.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import { Match } from "effect"

import { OpenAgentTraceCoverage, type OpenAgentTraceEvent, type OpenAgentTraceRecord } from "./schema.js"

const coverageGap = (options: {
  readonly gapId: string
  readonly sourceKind: string
  readonly sourceRef: Record<string, string>
  readonly reason: string
  readonly severity: "info" | "warning" | "error"
}): OpenAgentTraceCoverage =>
  OpenAgentTraceCoverage.make({
    gapId: options.gapId,
    sourceKind: options.sourceKind,
    sourceRef: options.sourceRef,
    reason: options.reason,
    severity: options.severity
  })

const eventCoverageGaps = (event: OpenAgentTraceEvent): ReadonlyArray<OpenAgentTraceCoverage> =>
  Match.value(event).pipe(
    Match.when({ eventKind: "model-change" }, ({ eventId, eventKind }) => [
      coverageGap({
        gapId: `coverage:${eventId}`,
        sourceKind: eventKind,
        sourceRef: { eventId },
        reason: "Runtime model switches stay explicit trace provenance rather than workflow-session truth.",
        severity: "info"
      })
    ]),
    Match.when({ eventKind: "thinking-level-change" }, ({ eventId, eventKind }) => [
      coverageGap({
        gapId: `coverage:${eventId}`,
        sourceKind: eventKind,
        sourceRef: { eventId },
        reason: "Thinking-level transitions remain runtime metadata outside the reusable workflow contract.",
        severity: "info"
      })
    ]),
    Match.when({ eventKind: "bash-execution" }, ({ eventId, eventKind }) => [
      coverageGap({
        gapId: `coverage:${eventId}`,
        sourceKind: eventKind,
        sourceRef: { eventId },
        reason: "Bash execution output stays explicit tool-runtime evidence instead of workflow-ground-truth content.",
        severity: "warning"
      })
    ]),
    Match.when({ eventKind: "compaction" }, ({ eventId, eventKind }) => [
      coverageGap({
        gapId: `coverage:${eventId}`,
        sourceKind: eventKind,
        sourceRef: { eventId },
        reason: "Summary events remain explicit coverage outside the reusable workflow record.",
        severity: "info"
      })
    ]),
    Match.when({ eventKind: "branch-summary" }, ({ eventId, eventKind }) => [
      coverageGap({
        gapId: `coverage:${eventId}`,
        sourceKind: eventKind,
        sourceRef: { eventId },
        reason: "Branch summaries remain explicit lineage coverage instead of being flattened into workflow turns.",
        severity: "info"
      })
    ]),
    Match.when({ eventKind: "custom" }, ({ eventId, eventKind }) => [
      coverageGap({
        gapId: `coverage:${eventId}`,
        sourceKind: eventKind,
        sourceRef: { eventId },
        reason: "Custom source metadata stays package-authored context rather than workflow-session truth.",
        severity: "info"
      })
    ]),
    Match.when({ eventKind: "custom-message" }, ({ eventId, eventKind }) => [
      coverageGap({
        gapId: `coverage:${eventId}`,
        sourceKind: eventKind,
        sourceRef: { eventId },
        reason: "Metadata events stay package-authored context rather than workflow-session truth.",
        severity: "info"
      })
    ]),
    Match.when({ eventKind: "label" }, ({ eventId, eventKind }) => [
      coverageGap({
        gapId: `coverage:${eventId}`,
        sourceKind: eventKind,
        sourceRef: { eventId },
        reason: "Labels remain package-authored annotations outside the reusable workflow contract.",
        severity: "info"
      })
    ]),
    Match.when({ eventKind: "session-info" }, ({ eventId, eventKind }) => [
      coverageGap({
        gapId: `coverage:${eventId}`,
        sourceKind: eventKind,
        sourceRef: { eventId },
        reason: "Session metadata stays package-authored context rather than workflow-session truth.",
        severity: "info"
      })
    ]),
    Match.when(
      { eventKind: "message" },
      () => []
    ),
    Match.exhaustive
  )

const messageCoverageGaps = (event: OpenAgentTraceEvent): ReadonlyArray<OpenAgentTraceCoverage> =>
  Match.value(event).pipe(
    Match.when(
      { eventKind: "message" },
      ({ contentBlocks, eventId }) =>
        contentBlocks.flatMap((block) =>
          block.type === "image"
            ? [coverageGap({
              gapId: `coverage:${block.blockId}`,
              sourceKind: "image",
              sourceRef: { blockId: block.blockId, eventId },
              reason: "Image presence is preserved, but image content is not projected into workflow graphs.",
              severity: "info"
            })]
            : []
        )
    ),
    Match.orElse(() => [])
  )

/**
 * Synthesize explicit coverage gaps for every normalized feature that the bounded workflow lane does not project.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
export const syntheticCoverageGaps = (record: OpenAgentTraceRecord): ReadonlyArray<OpenAgentTraceCoverage> => [
  ...record.events.flatMap(eventCoverageGaps),
  ...record.events.flatMap(messageCoverageGaps),
  ...record.redactionFindings.map((finding) =>
    coverageGap({
      gapId: `coverage:${finding.findingId}`,
      sourceKind: "redaction",
      sourceRef: { findingId: finding.findingId, eventId: finding.eventId },
      reason: "Redacted spans remain explicit and should not be silently treated as workflow-ground-truth content.",
      severity: "warning"
    })
  )
]
