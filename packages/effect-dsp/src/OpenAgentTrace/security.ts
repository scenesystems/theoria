/**
 * Sealed private-review bundles and signed public-manifest helpers for open-agent-trace.
 *
 * @since 0.2.0
 */
import { canonicalJsonBytes } from "@scenesystems/digest"
import { type EnvelopeKeyMetadataType, seal, unseal, utf8FromBytes } from "@scenesystems/seal"
import { SignatureAlgorithm, signDetached, verifyDetached } from "@scenesystems/sign"
import { Effect, Option, Schema } from "effect"

import type { OpenAgentTraceRedactionPolicy } from "./redaction.js"
import {
  OpenAgentTraceCorpusManifest,
  OpenAgentTracePrivateReviewPayload,
  type OpenAgentTraceRecord,
  OpenAgentTraceRecordId,
  OpenAgentTraceSealedReviewBundle,
  OpenAgentTraceSessionId,
  OpenAgentTraceSignedCorpusManifest,
  type PiShareHfReviewSidecar
} from "./schema.js"

const OpenAgentTraceReviewBundleAssociatedData = Schema.Struct({
  recordId: OpenAgentTraceRecordId,
  sessionId: OpenAgentTraceSessionId,
  policyId: Schema.String,
  policyVersion: Schema.Number
})

const canonicalSchemaBytes = <A, I>(schema: Schema.Schema<A, I>, value: A) =>
  Effect.flatMap(Schema.encode(schema)(value), canonicalJsonBytes)

const reviewBundleAssociatedData = (payload: OpenAgentTracePrivateReviewPayload) =>
  canonicalSchemaBytes(OpenAgentTraceReviewBundleAssociatedData, {
    recordId: payload.recordId,
    sessionId: payload.sessionId,
    policyId: payload.policyId,
    policyVersion: payload.policyVersion
  })

/**
 * Seals non-public review sidecars and literal-secret policy inputs for private persistence.
 *
 * @since 0.2.0
 * @category combinators
 */
export const sealOpenAgentTracePrivateReviewBundle = (options: {
  readonly record: OpenAgentTraceRecord
  readonly policy: OpenAgentTraceRedactionPolicy
  readonly key: Uint8Array
  readonly keyMetadata?: EnvelopeKeyMetadataType
  readonly reviewSidecar?: PiShareHfReviewSidecar
}) =>
  Effect.gen(function*() {
    const payload = new OpenAgentTracePrivateReviewPayload({
      recordId: options.record.recordId,
      sessionId: options.record.source.sessionId,
      policyId: options.policy.policyId,
      policyVersion: options.policy.policyVersion,
      reviewSidecar: options.reviewSidecar,
      literalSecrets: options.policy.literalSecrets
    })
    const plaintext = yield* canonicalSchemaBytes(OpenAgentTracePrivateReviewPayload, payload)
    const associatedData = yield* reviewBundleAssociatedData(payload)
    const envelope = yield* seal(
      "xchacha20-poly1305",
      options.key,
      plaintext,
      options.keyMetadata,
      associatedData
    )

    return new OpenAgentTraceSealedReviewBundle({
      bundleKind: "sealed-review-bundle",
      recordId: payload.recordId,
      sessionId: payload.sessionId,
      policyId: payload.policyId,
      policyVersion: payload.policyVersion,
      literalSecretCount: payload.literalSecrets.length,
      hasReviewSidecar: Option.isSome(Option.fromNullable(payload.reviewSidecar)),
      envelope
    })
  })

/**
 * Opens one sealed private-review bundle back into its schema-owned payload.
 *
 * @since 0.2.0
 * @category combinators
 */
export const unsealOpenAgentTracePrivateReviewBundle = (options: {
  readonly bundle: OpenAgentTraceSealedReviewBundle
  readonly key: Uint8Array
}) =>
  Effect.gen(function*() {
    const associatedData = yield* canonicalSchemaBytes(OpenAgentTraceReviewBundleAssociatedData, {
      recordId: options.bundle.recordId,
      sessionId: options.bundle.sessionId,
      policyId: options.bundle.policyId,
      policyVersion: options.bundle.policyVersion
    })
    const plaintext = yield* unseal(options.key, options.bundle.envelope, associatedData)

    return yield* Schema.decode(Schema.parseJson(OpenAgentTracePrivateReviewPayload))(utf8FromBytes(plaintext))
  })

/**
 * Signs one public corpus manifest over the same canonical schema wire form used for digests.
 *
 * @since 0.2.0
 * @category combinators
 */
export const signOpenAgentTraceCorpusManifest = (options: {
  readonly manifest: OpenAgentTraceCorpusManifest
  readonly algorithm: Schema.Schema.Type<typeof SignatureAlgorithm>
  readonly secretKey: Uint8Array
  readonly publicKey: Uint8Array
}) =>
  Effect.gen(function*() {
    const algorithm = yield* Schema.decode(SignatureAlgorithm)(options.algorithm)
    const bytes = yield* canonicalSchemaBytes(OpenAgentTraceCorpusManifest, options.manifest)
    const signature = yield* signDetached(algorithm, bytes, options.secretKey, options.publicKey)

    return new OpenAgentTraceSignedCorpusManifest({
      manifestKind: "signed-corpus-manifest",
      manifest: options.manifest,
      signature,
      publicKey: options.publicKey
    })
  })

/**
 * Verifies a detached public-manifest signature against the canonical manifest wire form.
 *
 * @since 0.2.0
 * @category combinators
 */
export const verifyOpenAgentTraceSignedCorpusManifest = (value: OpenAgentTraceSignedCorpusManifest) =>
  Effect.gen(function*() {
    const bytes = yield* canonicalSchemaBytes(OpenAgentTraceCorpusManifest, value.manifest)
    return yield* verifyDetached(value.signature, bytes, value.publicKey)
  })
