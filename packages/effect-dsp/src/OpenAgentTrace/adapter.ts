/**
 * Shared adapter contract for source-specific trace normalization into the
 * canonical open-agent-trace record family.
 *
 * @since 0.2.0
 */
import type { ParseResult } from "effect"
import { Effect, Schema } from "effect"

import type { DspError } from "../Errors/index.js"
import {
  OpenAgentTraceAdapterCapture,
  type OpenAgentTraceAdapterCoverageGap,
  type OpenAgentTraceAdapterKind
} from "./adapterSchema.js"
import type { OpenAgentTraceRedactionPolicy } from "./redaction.js"
import { type OpenAgentTraceReviewStatus } from "./schema.js"
import type { OpenAgentTraceRecord } from "./schema.js"

/**
 * Shared normalization options for external trace adapters.
 *
 * @since 0.2.0
 * @category models
 */
export type NormalizeCaptureOptions = Readonly<{
  readonly redactionPolicy?: OpenAgentTraceRedactionPolicy
  readonly reviewStatusOverride?: OpenAgentTraceReviewStatus
}>

/**
 * Shared normalization result for external trace adapters.
 *
 * @since 0.2.0
 * @category models
 */
export type NormalizeCaptureResult = Readonly<{
  readonly record: OpenAgentTraceRecord
  readonly coverageGaps: ReadonlyArray<OpenAgentTraceAdapterCoverageGap>
}>

/**
 * Shared source-adapter contract for normalizing one capture into the canonical
 * trace record family.
 *
 * @since 0.2.0
 * @category models
 */
export type Adapter = Readonly<{
  readonly kind: OpenAgentTraceAdapterKind
  readonly normalize: (
    capture: OpenAgentTraceAdapterCapture,
    options?: NormalizeCaptureOptions
  ) => Effect.Effect<NormalizeCaptureResult, DspError | ParseResult.ParseError>
}>

/**
 * Construct a shared source adapter without exposing source-specific consumer
 * branching at the call site.
 *
 * @since 0.2.0
 * @category constructors
 */
export const makeAdapter = (adapter: Adapter): Adapter => adapter

/**
 * Decode a raw capture through the shared adapter envelope and normalize it to
 * the canonical open-agent-trace record family.
 *
 * @since 0.2.0
 * @category constructors
 */
export const normalizeCapture = (
  adapter: Adapter,
  capture: unknown,
  options?: NormalizeCaptureOptions
): Effect.Effect<NormalizeCaptureResult, DspError | ParseResult.ParseError> =>
  Effect.flatMap(
    Schema.decodeUnknown(OpenAgentTraceAdapterCapture)(capture),
    (decodedCapture) => adapter.normalize(decodedCapture, options)
  )
