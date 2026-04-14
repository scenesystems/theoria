/**
 * Provenance nouns for checked-in public Amp capture fixtures.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"
import { WorkflowSessionIdSchema } from "effect-inference/Contracts"

import { OpenAgentTraceManifestDigest } from "../schema.js"

const ampThreadIdPattern = /^T-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u

/**
 * Capture methods supported by the package-owned Amp fixture lane.
 *
 * @since 0.2.0
 * @category schemas
 */
export const AmpCaptureMethod = Schema.Literal("plugin-api", "stream-json")

/**
 * Canonical checked-in Amp thread identifier.
 *
 * @since 0.2.0
 * @category schemas
 */
export const AmpThreadId = Schema.String.pipe(Schema.pattern(ampThreadIdPattern))

/**
 * Decode one canonical Amp thread id into the workflow-session UUID it carries.
 *
 * @since 0.2.0
 * @category schemas
 */
export const AmpSessionId = Schema.transform(
  AmpThreadId,
  WorkflowSessionIdSchema,
  {
    decode: (threadId) => threadId.slice(2),
    encode: (sessionId) => `T-${sessionId}`
  }
)

const AmpDesiredCaptureAuthority = Schema.Struct({
  threadId: AmpThreadId,
  sourceUrl: Schema.String,
  visibility: Schema.Literal("public"),
  captureMethod: AmpCaptureMethod
})

const AmpResolvedCaptureAuthority = Schema.Struct({
  threadId: AmpThreadId,
  sessionId: AmpThreadId,
  captureMethod: AmpCaptureMethod,
  rawFileName: Schema.String,
  rawDigest: OpenAgentTraceManifestDigest,
  derivedFileName: Schema.String,
  sourceHash: OpenAgentTraceManifestDigest
})

const AmpObservedCaptureFacts = Schema.Struct({
  capturedAt: Schema.String,
  startedAt: Schema.String,
  firstTaskSummary: Schema.String,
  toolNames: Schema.Array(Schema.String),
  shellCommands: Schema.Array(Schema.String),
  terminalStatus: Schema.Literal("done", "error", "interrupted", "success"),
  coverageKinds: Schema.Array(Schema.String)
})

const AmpReviewBoundary = Schema.Struct({
  rawArtifactAuthority: Schema.Literal(true),
  derivedReplayAuthority: Schema.Literal("checked-in-derived-replay"),
  notes: Schema.String
})

/**
 * Checked-in provenance sidecar for one Amp public capture artifact.
 *
 * @since 0.2.0
 * @category schemas
 */
export const AmpCaptureEvidence = Schema.Struct({
  desired: AmpDesiredCaptureAuthority,
  resolved: AmpResolvedCaptureAuthority,
  observed: AmpObservedCaptureFacts,
  capabilityGaps: Schema.Array(Schema.String),
  reviewBoundary: AmpReviewBoundary
})

/**
 * Decoded checked-in provenance sidecar for one Amp capture artifact.
 *
 * @since 0.2.0
 * @category type-level
 */
export type AmpCaptureEvidence = typeof AmpCaptureEvidence.Type

/**
 * Canonical checked-in Amp thread identifier.
 *
 * @since 0.2.0
 * @category type-level
 */
export type AmpThreadId = typeof AmpThreadId.Type
