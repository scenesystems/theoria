/**
 * Event and record surfaces for normalized open-agent-trace data.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { FieldRecord } from "../../../contracts/FieldValue.js"
import { OpenAgentTraceContentDigest, OpenAgentTraceEventId, OpenAgentTraceRecordId } from "./authorities.js"
import {
  OpenAgentTraceActor,
  OpenAgentTraceBranch,
  OpenAgentTraceContentBlock,
  OpenAgentTracePiTurnProvenance,
  OpenAgentTraceSelection,
  OpenAgentTraceSession,
  OpenAgentTraceSource
} from "./core.js"
import { OpenAgentTraceRedactionFinding, OpenAgentTraceReviewStatus } from "./redaction.js"

/**
 * Canonical normalized message event.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceMessage extends Schema.Class<OpenAgentTraceMessage>("OpenAgentTraceMessage")({
  eventId: OpenAgentTraceEventId,
  parentEventId: Schema.optional(OpenAgentTraceEventId),
  timestamp: Schema.String,
  eventKind: Schema.Literal("message"),
  actor: OpenAgentTraceActor,
  contentBlocks: Schema.Array(OpenAgentTraceContentBlock),
  usage: Schema.optional(FieldRecord),
  piTurnProvenance: Schema.optional(OpenAgentTracePiTurnProvenance),
  errorMessage: Schema.optional(Schema.String)
}) {}

/**
 * Canonical normalized runtime event.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceRuntimeEvent extends Schema.Class<OpenAgentTraceRuntimeEvent>("OpenAgentTraceRuntimeEvent")({
  eventId: OpenAgentTraceEventId,
  parentEventId: Schema.optional(OpenAgentTraceEventId),
  timestamp: Schema.String,
  eventKind: Schema.Literal("model-change", "thinking-level-change", "bash-execution"),
  actor: OpenAgentTraceActor,
  command: Schema.optional(Schema.String),
  outputText: Schema.optional(Schema.String),
  exitCode: Schema.optional(Schema.Number),
  cancelled: Schema.optional(Schema.Boolean),
  truncated: Schema.optional(Schema.Boolean),
  thinkingLevel: Schema.optional(Schema.String),
  modelId: Schema.optional(Schema.String)
}) {}

/**
 * Canonical normalized summary event.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceSummaryEvent extends Schema.Class<OpenAgentTraceSummaryEvent>("OpenAgentTraceSummaryEvent")({
  eventId: OpenAgentTraceEventId,
  parentEventId: Schema.optional(OpenAgentTraceEventId),
  timestamp: Schema.String,
  eventKind: Schema.Literal("compaction", "branch-summary"),
  summaryText: Schema.String,
  firstKeptEntryId: Schema.optional(OpenAgentTraceEventId),
  fromEntryId: Schema.optional(OpenAgentTraceEventId),
  tokensBefore: Schema.optional(Schema.Number)
}) {}

/**
 * Canonical normalized metadata or extension event.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceMetadataEvent
  extends Schema.Class<OpenAgentTraceMetadataEvent>("OpenAgentTraceMetadataEvent")({
    eventId: OpenAgentTraceEventId,
    parentEventId: Schema.optional(OpenAgentTraceEventId),
    timestamp: Schema.String,
    eventKind: Schema.Literal("custom", "custom-message", "label", "session-info"),
    actor: Schema.optional(OpenAgentTraceActor),
    data: Schema.optional(FieldRecord),
    label: Schema.optional(Schema.String),
    targetId: Schema.optional(OpenAgentTraceEventId),
    sessionName: Schema.optional(Schema.String),
    contentBlocks: Schema.optional(Schema.Array(OpenAgentTraceContentBlock))
  })
{}

/**
 * Canonical coverage gap surface for lossy or unsupported projection.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceCoverage extends Schema.Class<OpenAgentTraceCoverage>("OpenAgentTraceCoverage")({
  gapId: Schema.String,
  sourceKind: Schema.String,
  sourceRef: FieldRecord,
  reason: Schema.String,
  severity: Schema.Literal("info", "warning", "error")
}) {}

/**
 * Canonical normalized event family.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OpenAgentTraceEvent = Schema.Union(
  OpenAgentTraceMessage,
  OpenAgentTraceRuntimeEvent,
  OpenAgentTraceSummaryEvent,
  OpenAgentTraceMetadataEvent
)

/**
 * Canonical normalized trace record.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceRecord extends Schema.Class<OpenAgentTraceRecord>("OpenAgentTraceRecord")({
  recordId: OpenAgentTraceRecordId,
  source: OpenAgentTraceSource,
  session: OpenAgentTraceSession,
  selection: OpenAgentTraceSelection,
  branches: Schema.Array(OpenAgentTraceBranch),
  events: Schema.NonEmptyArray(OpenAgentTraceEvent),
  coverageGaps: Schema.Array(OpenAgentTraceCoverage),
  redactionFindings: Schema.Array(OpenAgentTraceRedactionFinding),
  reviewStatus: OpenAgentTraceReviewStatus,
  sourceDigest: OpenAgentTraceContentDigest,
  normalizedDigest: OpenAgentTraceContentDigest,
  redactedDigest: OpenAgentTraceContentDigest
}) {}

/**
 * Decoded normalized event union.
 *
 * @since 0.2.0
 * @category type-level
 */
export type OpenAgentTraceEvent = typeof OpenAgentTraceEvent.Type
