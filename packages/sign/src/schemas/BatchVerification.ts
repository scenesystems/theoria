/**
 * Structured request and result envelopes for additive batch verification.
 *
 * The batch surface reuses the existing self-describing and detached
 * signature carriers, but reports order-preserving per-item outcomes in one
 * structured envelope instead of collapsing the whole batch into a single
 * boolean.
 *
 * @since 0.2.0
 * @category schemas
 */
import { Schema } from "effect"

import { DetachedSignature } from "./DetachedSignature.js"
import { VerificationFailed } from "./errors.js"
import { Signature } from "./Signature.js"
import { SignatureAlgorithm } from "./SignatureAlgorithm.js"

const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))

/**
 * One batch-verification request using a self-describing signature.
 *
 * @since 0.2.0
 * @category schemas
 */
export class BatchVerifySignatureRequest extends Schema.Class<BatchVerifySignatureRequest>(
  "BatchVerifySignatureRequest"
)({
  kind: Schema.Literal("self-describing"),
  message: Schema.Uint8ArrayFromSelf,
  signature: Signature
}) {}

/**
 * One batch-verification request using a detached signature plus explicit key.
 *
 * @since 0.2.0
 * @category schemas
 */
export class BatchVerifyDetachedSignatureRequest extends Schema.Class<BatchVerifyDetachedSignatureRequest>(
  "BatchVerifyDetachedSignatureRequest"
)({
  kind: Schema.Literal("detached"),
  message: Schema.Uint8ArrayFromSelf,
  signature: DetachedSignature,
  publicKey: Schema.Uint8ArrayFromSelf
}) {}

/**
 * Supported batch-verification request carriers.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BatchVerifyRequest = Schema.Union(
  BatchVerifySignatureRequest,
  BatchVerifyDetachedSignatureRequest
)

/**
 * Batch-verification request type.
 *
 * @since 0.2.0
 * @category models
 */
export type BatchVerifyRequestType = typeof BatchVerifyRequest.Type

/**
 * One successful batch-verification result.
 *
 * @since 0.2.0
 * @category schemas
 */
export class BatchVerifyPass extends Schema.TaggedClass<BatchVerifyPass>()("BatchVerifyPass", {
  index: NonNegativeInt,
  algorithm: SignatureAlgorithm
}) {}

/**
 * One batch-verification mismatch where the signature decoded but did not
 * match the supplied message or public key.
 *
 * @since 0.2.0
 * @category schemas
 */
export class BatchVerifyMismatch extends Schema.TaggedClass<BatchVerifyMismatch>()("BatchVerifyMismatch", {
  index: NonNegativeInt,
  algorithm: SignatureAlgorithm,
  reason: Schema.Literal("signature-mismatch")
}) {}

/**
 * One batch-verification error where the verifier could not interpret the
 * supplied signature bytes for that algorithm.
 *
 * @since 0.2.0
 * @category schemas
 */
export class BatchVerifyError extends Schema.TaggedClass<BatchVerifyError>()("BatchVerifyError", {
  index: NonNegativeInt,
  algorithm: SignatureAlgorithm,
  error: VerificationFailed
}) {}

/**
 * Supported per-item batch-verification outcomes.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BatchVerifyResult = Schema.Union(BatchVerifyPass, BatchVerifyMismatch, BatchVerifyError)

/**
 * Batch-verification result type.
 *
 * @since 0.2.0
 * @category models
 */
export type BatchVerifyResultType = typeof BatchVerifyResult.Type

/**
 * Aggregate batch-verification report.
 *
 * @since 0.2.0
 * @category schemas
 */
export class BatchVerifyReport extends Schema.Class<BatchVerifyReport>("BatchVerifyReport")({
  allValid: Schema.Boolean,
  verifiedCount: NonNegativeInt,
  failedCount: NonNegativeInt,
  results: Schema.Array(BatchVerifyResult)
}) {}
