/**
 * Redaction and review schemas for normalized open-agent-trace records.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import {
  OpenAgentTraceBlockId,
  OpenAgentTraceContentDigest,
  OpenAgentTraceEventId,
  OpenAgentTraceFindingId
} from "./authorities.js"

const OpenAgentTraceFindingKind = Schema.Literal("literal-secret", "credential-pattern")

const OpenAgentTraceSemanticReviewStatus = Schema.Literal("approved", "manual-review-required", "not-reviewed")

/**
 * Canonical deterministic-redaction finding surface.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceRedactionFinding
  extends Schema.Class<OpenAgentTraceRedactionFinding>("OpenAgentTraceRedactionFinding")({
    findingId: OpenAgentTraceFindingId,
    findingKind: OpenAgentTraceFindingKind,
    matchTextDigest: OpenAgentTraceContentDigest,
    replacementToken: Schema.String,
    blockId: OpenAgentTraceBlockId,
    eventId: OpenAgentTraceEventId,
    confidence: Schema.Literal("high", "medium"),
    manualReviewRequired: Schema.Boolean
  })
{}

/**
 * Canonical release-safety and review status surface.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceReviewStatus extends Schema.Class<OpenAgentTraceReviewStatus>("OpenAgentTraceReviewStatus")({
  projectionSafe: Schema.Boolean,
  manualReviewRequired: Schema.Boolean,
  semanticReviewStatus: OpenAgentTraceSemanticReviewStatus,
  aboutProject: Schema.optional(Schema.Boolean),
  shareable: Schema.optional(Schema.Boolean),
  missedSensitiveData: Schema.optional(Schema.Boolean),
  policyId: Schema.String,
  policyVersion: Schema.Number,
  reviewKey: Schema.optional(Schema.Redacted(Schema.NonEmptyString)),
  promptVersion: Schema.optional(Schema.Number)
}) {}
