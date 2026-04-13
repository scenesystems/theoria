/**
 * Structured request and result envelopes for ordered multi-item verification.
 *
 * The multi-item surface reuses the existing self-describing and detached
 * signature carriers, but reports order-preserving per-item outcomes in one
 * structured envelope instead of collapsing the whole collection into a single
 * boolean or implying a cryptographic batch-verify optimization.
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
 * One multi-item verification request using a self-describing signature.
 *
 * @since 0.2.0
 * @category schemas
 */
export class VerifyManySignatureRequest extends Schema.Class<VerifyManySignatureRequest>(
  "VerifyManySignatureRequest"
)({
  kind: Schema.Literal("self-describing"),
  message: Schema.Uint8ArrayFromSelf,
  signature: Signature
}) {}

/**
 * One multi-item verification request using a detached signature plus explicit key.
 *
 * @since 0.2.0
 * @category schemas
 */
export class VerifyManyDetachedSignatureRequest extends Schema.Class<VerifyManyDetachedSignatureRequest>(
  "VerifyManyDetachedSignatureRequest"
)({
  kind: Schema.Literal("detached"),
  message: Schema.Uint8ArrayFromSelf,
  signature: DetachedSignature,
  publicKey: Schema.Uint8ArrayFromSelf
}) {}

/**
 * Supported multi-item verification request carriers.
 *
 * @since 0.2.0
 * @category schemas
 */
export const VerifyManyRequest = Schema.Union(
  VerifyManySignatureRequest,
  VerifyManyDetachedSignatureRequest
)

/**
 * Multi-item verification request type.
 *
 * @since 0.2.0
 * @category models
 */
export type VerifyManyRequestType = typeof VerifyManyRequest.Type

/**
 * One successful multi-item verification result.
 *
 * @since 0.2.0
 * @category schemas
 */
export class VerifyManyPass extends Schema.TaggedClass<VerifyManyPass>()("VerifyManyPass", {
  index: NonNegativeInt,
  algorithm: SignatureAlgorithm
}) {}

/**
 * One multi-item verification mismatch where the signature decoded but did not
 * match the supplied message or public key.
 *
 * @since 0.2.0
 * @category schemas
 */
export class VerifyManyMismatch extends Schema.TaggedClass<VerifyManyMismatch>()("VerifyManyMismatch", {
  index: NonNegativeInt,
  algorithm: SignatureAlgorithm,
  reason: Schema.Literal("signature-mismatch")
}) {}

/**
 * One multi-item verification error where the verifier could not interpret the
 * supplied signature bytes for that algorithm.
 *
 * @since 0.2.0
 * @category schemas
 */
export class VerifyManyError extends Schema.TaggedClass<VerifyManyError>()("VerifyManyError", {
  index: NonNegativeInt,
  algorithm: SignatureAlgorithm,
  error: VerificationFailed
}) {}

/**
 * Supported per-item multi-item verification outcomes.
 *
 * @since 0.2.0
 * @category schemas
 */
export const VerifyManyResult = Schema.Union(VerifyManyPass, VerifyManyMismatch, VerifyManyError)

/**
 * Multi-item verification result type.
 *
 * @since 0.2.0
 * @category models
 */
export type VerifyManyResultType = typeof VerifyManyResult.Type

/**
 * Aggregate report for ordered multi-item verification.
 *
 * @since 0.2.0
 * @category schemas
 */
export class VerifyManyReport extends Schema.Class<VerifyManyReport>("VerifyManyReport")({
  allValid: Schema.Boolean,
  verifiedCount: NonNegativeInt,
  failedCount: NonNegativeInt,
  results: Schema.Array(VerifyManyResult)
}) {}
