/**
 * Shared helpers for workflow, usage, and coverage projection over normalized traces.
 *
 * @since 0.2.0
 */
import { Effect, Match, Option, Schema } from "effect"
import type { WorkflowKind } from "effect-inference/Contracts"

import { OpenAgentTracePiUsageProjection, OpenAgentTraceUsageSample } from "./projectionSchema.js"
import {
  OpenAgentTraceCoverage,
  type OpenAgentTraceEvent,
  OpenAgentTraceMessage,
  type OpenAgentTraceRecord
} from "./schema.js"
/**
 * The first bounded workflow and example projection version.
 *
 * @since 0.2.0
 */
export const PROJECTION_VERSION = "1"
type OpenAgentTraceMessageEvent = Schema.Schema.Type<typeof OpenAgentTraceMessage>
/**
 * Narrow a normalized trace event to the message-event family used by workflow projection.
 *
 * @since 0.2.0
 */
export const isMessageEvent = (event: OpenAgentTraceEvent): event is OpenAgentTraceMessageEvent =>
  Schema.is(OpenAgentTraceMessage)(event)

const decodeOptionalNumber = (value: unknown) =>
  Option.match(Option.fromNullable(value), {
    onNone: () => Effect.succeed(Option.none<number>()),
    onSome: (presentValue) => Effect.map(Schema.decodeUnknown(Schema.Number)(presentValue), Option.some)
  })

const coverageGap = (options: {
  readonly gapId: string
  readonly sourceKind: string
  readonly sourceRef: Record<string, string>
  readonly reason: string
  readonly severity: "info" | "warning" | "error"
}) =>
  new OpenAgentTraceCoverage({
    gapId: options.gapId,
    sourceKind: options.sourceKind,
    sourceRef: options.sourceRef,
    reason: options.reason,
    severity: options.severity
  })

/**
 * Collapse one normalized content block into the bounded text form used by workflow and example projections.
 *
 * @since 0.2.0
 */
export const blockText = (block: OpenAgentTraceMessageEvent["contentBlocks"][number]): string =>
  Match.value(block).pipe(
    Match.when({ type: "text" }, ({ text }) => text),
    Match.when({ type: "thinking" }, ({ thinking }) => thinking),
    Match.when({ type: "image" }, ({ mimeType }) => `[image:${mimeType}]`),
    Match.when({ type: "toolCall" }, ({ toolName, toolCallId }) => `${toolName}:${toolCallId}`),
    Match.when({ type: "json" }, () => "[json]"),
    Match.exhaustive
  )

/**
 * Concatenate the projected text surface for one normalized message event.
 *
 * @since 0.2.0
 */
export const messageText = (event: OpenAgentTraceMessageEvent): string => event.contentBlocks.map(blockText).join("\n")
/**
 * Derive the reusable workflow kind from the normalized session authority.
 *
 * @since 0.2.0
 */
export const workflowKindFrom = (record: OpenAgentTraceRecord): WorkflowKind =>
  Option.match(Option.fromNullable(record.session.parentSession), {
    onNone: () => "task-first",
    onSome: () => "chat-continuation"
  })
/**
 * Map a workflow kind onto the bounded evaluation profile family used by the first projection lane.
 *
 * @since 0.2.0
 */
export const profileFamilyFrom = (workflowKind: WorkflowKind) =>
  workflowKind === "chat-continuation" ? "chat-oriented" : "task-oriented"

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
    Match.orElse(() => [])
  )

const blockCoverageGaps = (event: OpenAgentTraceMessageEvent): ReadonlyArray<OpenAgentTraceCoverage> =>
  event.contentBlocks.flatMap((block) =>
    block.type === "image"
      ? [coverageGap({
        gapId: `coverage:${block.blockId}`,
        sourceKind: "image",
        sourceRef: { blockId: block.blockId, eventId: event.eventId },
        reason: "Image presence is preserved, but image content is not projected into workflow graphs.",
        severity: "info"
      })]
      : []
  )

/**
 * Synthesize explicit coverage gaps for every normalized feature that the bounded workflow lane does not project.
 *
 * @since 0.2.0
 */
export const syntheticCoverageGaps = (record: OpenAgentTraceRecord) => [
  ...record.events.flatMap(eventCoverageGaps),
  ...record.events.flatMap((event) => (isMessageEvent(event) ? blockCoverageGaps(event) : [])),
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

/**
 * Preserve bounded assistant-usage provenance while folding cache hits into the public usage sample.
 *
 * @since 0.2.0
 */
export const assistantUsageProjection = (event: OpenAgentTraceMessageEvent) =>
  Effect.gen(function*() {
    const inputTokens = yield* decodeOptionalNumber(event.usage?.input)
    const outputTokens = yield* decodeOptionalNumber(event.usage?.output)
    const cacheReadTokens = yield* decodeOptionalNumber(event.usage?.cacheRead)
    const cacheWriteTokens = yield* decodeOptionalNumber(event.usage?.cacheWrite)
    const totalTokens = yield* decodeOptionalNumber(event.usage?.totalTokens)
    const costUsd = yield* decodeOptionalNumber(event.usage?.costUsd)

    return new OpenAgentTracePiUsageProjection({
      eventId: event.eventId,
      provider: event.piTurnProvenance?.provider,
      model: event.piTurnProvenance?.model,
      api: event.piTurnProvenance?.api,
      stopReason: event.piTurnProvenance?.stopReason,
      usage: new OpenAgentTraceUsageSample({
        cached: Option.getOrElse(cacheReadTokens, () => 0) > 0,
        ...Option.match(inputTokens, {
          onNone: () => ({}),
          onSome: (value) => ({ inputTokens: value })
        }),
        ...Option.match(outputTokens, {
          onNone: () => ({}),
          onSome: (value) => ({ outputTokens: value })
        })
      }),
      ...Option.match(cacheReadTokens, {
        onNone: () => ({}),
        onSome: (value) => ({ cacheReadTokens: value })
      }),
      ...Option.match(cacheWriteTokens, {
        onNone: () => ({}),
        onSome: (value) => ({ cacheWriteTokens: value })
      }),
      ...Option.match(totalTokens, {
        onNone: () => ({}),
        onSome: (value) => ({ totalTokens: value })
      }),
      ...Option.match(costUsd, {
        onNone: () => ({}),
        onSome: (value) => ({ costUsd: value })
      })
    })
  })
