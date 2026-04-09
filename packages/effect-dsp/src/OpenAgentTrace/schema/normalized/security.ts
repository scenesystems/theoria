/**
 * Signature and sealing schemas for experimental open-agent-trace security boundaries.
 *
 * @since 0.2.0
 */
import { SealedEnvelope } from "@scenesystems/seal"
import { DetachedSignature } from "@scenesystems/sign"
import { Schema } from "effect"

import { PiShareHfReviewSidecar } from "../piReview.js"
import { OpenAgentTraceRecordId, OpenAgentTraceSessionId } from "./authorities.js"
import { CorpusManifest } from "./provenance.js"

const OpenAgentTracePrivateLiteralSecret = Schema.Struct({
  secretId: Schema.String,
  secretValue: Schema.Redacted(Schema.NonEmptyString),
  replacementToken: Schema.String
})

/**
 * Non-public review payload that may be sealed for quarantine or reviewer handoff.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTracePrivateReviewPayload
  extends Schema.Class<OpenAgentTracePrivateReviewPayload>("OpenAgentTracePrivateReviewPayload")({
    recordId: OpenAgentTraceRecordId,
    sessionId: OpenAgentTraceSessionId,
    policyId: Schema.String,
    policyVersion: Schema.Number,
    reviewSidecar: Schema.optional(PiShareHfReviewSidecar),
    literalSecrets: Schema.Array(OpenAgentTracePrivateLiteralSecret)
  })
{}

/**
 * Public metadata plus sealed private review payload.
 *
 * @since 0.2.0
 * @category models
 */
export class OpenAgentTraceSealedReviewBundle
  extends Schema.Class<OpenAgentTraceSealedReviewBundle>("OpenAgentTraceSealedReviewBundle")({
    bundleKind: Schema.Literal("sealed-review-bundle"),
    recordId: OpenAgentTraceRecordId,
    sessionId: OpenAgentTraceSessionId,
    policyId: Schema.String,
    policyVersion: Schema.Number,
    literalSecretCount: Schema.Number,
    hasReviewSidecar: Schema.Boolean,
    envelope: SealedEnvelope
  })
{}

/**
 * Public corpus manifest plus detached authenticity proof.
 *
 * @since 0.2.0
 * @category models
 */
export class SignedCorpusManifest extends Schema.Class<SignedCorpusManifest>("OpenAgentTrace/SignedCorpusManifest")({
  manifestKind: Schema.Literal("signed-corpus-manifest"),
  manifest: CorpusManifest,
  signature: DetachedSignature,
  publicKey: Schema.Uint8ArrayFromSelf
}) {}
