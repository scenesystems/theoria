/**
 * Source-agnostic adapter schemas for normalizing external agent traces into
 * the canonical open-agent-trace record family.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import { FieldRecord } from "../contracts/FieldValue.js"
import {
  OpenAgentTraceContentDigest,
  OpenAgentTraceCoverage,
  OpenAgentTraceRecord,
  OpenAgentTraceSessionId
} from "./schema.js"

/**
 * Supported adapter lanes for the experimental open-agent-trace surface.
 *
 * @since 0.2.0
 * @category schemas
 */
export const OpenAgentTraceAdapterKindSchema = Schema.Literal(
  "pi-mono",
  "amp-plugin",
  "amp-thread",
  "amp-stream-json",
  "custom"
)

/**
 * Decoded adapter kind.
 *
 * @since 0.2.0
 * @category type-level
 */
export type OpenAgentTraceAdapterKind = typeof OpenAgentTraceAdapterKindSchema.Type

/**
 * Source identity for one adapter capture before normalization.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceAdapterCaptureSource
  extends Schema.Class<OpenAgentTraceAdapterCaptureSource>("OpenAgentTrace/AdapterCaptureSource")({
    adapterKind: OpenAgentTraceAdapterKindSchema,
    sourceId: Schema.String,
    sourceRevision: Schema.String,
    sourceUrl: Schema.String,
    licenseTag: Schema.String,
    harness: Schema.String,
    sessionId: OpenAgentTraceSessionId,
    fileName: Schema.optional(Schema.String),
    sourceHash: Schema.optional(OpenAgentTraceContentDigest)
  })
{}

/**
 * Source-agnostic raw adapter capture envelope.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceAdapterCapture
  extends Schema.Class<OpenAgentTraceAdapterCapture>("OpenAgentTrace/AdapterCapture")({
    captureId: Schema.String,
    source: OpenAgentTraceAdapterCaptureSource,
    payload: Schema.Unknown,
    capturedAt: Schema.String
  })
{}

/**
 * Adapter-scoped normalization gap preserved alongside the normalized record.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceAdapterCoverageGap
  extends Schema.Class<OpenAgentTraceAdapterCoverageGap>("OpenAgentTrace/AdapterCoverageGap")({
    gapId: Schema.String,
    sourceKind: Schema.String,
    sourceRef: FieldRecord,
    reason: Schema.String,
    severity: Schema.Literal("info", "warning", "error")
  })
{}

/**
 * Normalization envelope returned by shared adapter contracts.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceAdapterNormalizationEnvelope
  extends Schema.Class<OpenAgentTraceAdapterNormalizationEnvelope>(
    "OpenAgentTrace/AdapterNormalizationEnvelope"
  )({
    record: OpenAgentTraceRecord,
    coverageGaps: Schema.Array(Schema.Union(OpenAgentTraceAdapterCoverageGap, OpenAgentTraceCoverage))
  })
{}
