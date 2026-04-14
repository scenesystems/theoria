/**
 * Compressed public adapter seam for normalized open-agent-trace captures.
 *
 * @since 0.2.0
 */

export {
  /**
   * Shared adapter contract for one capture-normalization lane.
   *
   * @see {@link makeAdapter} for the constructor surface
   * @since 0.2.0
   * @category type-level
   */
  type Adapter,
  /**
   * Construct a source adapter for one capture-normalization lane.
   *
   * @see {@link normalizeCapture} to run the adapter against unknown input
   * @since 0.2.0
   * @category constructors
   */
  makeAdapter,
  /**
   * Decode an unknown capture and normalize it through a shared adapter.
   *
   * @see {@link makeAdapter} for the adapter constructor
   * @since 0.2.0
   * @category constructors
   */
  normalizeCapture,
  /**
   * Shared normalization options accepted by external trace adapters.
   *
   * @see {@link NormalizeCaptureResult} for the normalized result envelope
   * @since 0.2.0
   * @category type-level
   */
  type NormalizeCaptureOptions,
  /**
   * Shared normalization result returned by external trace adapters.
   *
   * @see {@link NormalizeCaptureOptions} for the corresponding options
   * @since 0.2.0
   * @category type-level
   */
  type NormalizeCaptureResult
} from "./adapter.js"

export {
  /**
   * Source-agnostic raw adapter capture envelope.
   *
   * @see {@link AdapterNormalizationEnvelope} for the normalized result envelope
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceAdapterCapture as AdapterCapture,
  /**
   * Source identity attached to one raw adapter capture.
   *
   * @see {@link AdapterCapture} for the enclosing capture envelope
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceAdapterCaptureSource as AdapterCaptureSource,
  /**
   * Adapter-scoped normalization gap preserved alongside the normalized record.
   *
   * @see {@link Coverage} for the normalized-record coverage family
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceAdapterCoverageGap as AdapterCoverageGap,
  /**
   * Supported adapter lanes for the experimental open-agent-trace surface.
   *
   * @see {@link AdapterKindSchema} for the runtime schema
   * @since 0.2.0
   * @category type-level
   */
  type OpenAgentTraceAdapterKind as AdapterKind,
  /**
   * Runtime schema for the supported adapter lanes.
   *
   * @see {@link AdapterKind} for the decoded type
   * @since 0.2.0
   * @category schemas
   */
  OpenAgentTraceAdapterKindSchema as AdapterKindSchema,
  /**
   * Normalization envelope returned by shared adapter contracts.
   *
   * @see {@link AdapterCapture} for the raw capture envelope
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceAdapterNormalizationEnvelope as AdapterNormalizationEnvelope
} from "./adapterSchema.js"

export {
  /**
   * Canonical redaction policy for normalized public corpora.
   *
   * @see {@link redactOpenAgentTraceRecord} for the redaction entrypoint
   * @since 0.2.0
   * @category constants
   */
  defaultOpenAgentTraceRedactionPolicy,
  /**
   * Redaction policy used to scrub normalized public corpora.
   *
   * @see {@link defaultOpenAgentTraceRedactionPolicy} for the canonical instance
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceRedactionPolicy as RedactionPolicy,
  /**
   * Redact a normalized trace record under the configured policy.
   *
   * @see {@link RedactionPolicy} for the policy model
   * @since 0.2.0
   * @category constructors
   */
  redactOpenAgentTraceRecord
} from "./redaction.js"
