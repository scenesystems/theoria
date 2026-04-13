/**
 * Metadata, security, and digest exports for the public open-agent-trace seam.
 *
 * @since 0.2.0
 */

export {
  /**
   * Unsigned public corpus manifest for normalized trace releases.
   *
   * @see {@link SignedCorpusManifest} for the signed release surface
   * @since 0.2.0
   * @category models
   */
  CorpusManifest,
  /**
   * Decode a formatted content digest into the branded digest schema.
   *
   * @see {@link formatOpenAgentTraceContentDigest} for the inverse formatter
   * @since 0.2.0
   * @category constructors
   */
  decodeOpenAgentTraceContentDigest,
  /**
   * Format a branded content digest into its stable string representation.
   *
   * @see {@link decodeOpenAgentTraceContentDigest} for the inverse decoder
   * @since 0.2.0
   * @category constructors
   */
  formatOpenAgentTraceContentDigest,
  /**
   * Redaction finding emitted while scrubbing normalized traces.
   *
   * @see {@link RedactionPolicy} for the governing policy surface
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceRedactionFinding as RedactionFinding,
  /**
   * Redaction-policy key attached to normalized sources.
   *
   * @see {@link RedactionPolicy} for the governing policy surface
   * @since 0.2.0
   * @category schemas
   */
  OpenAgentTraceRedactionKey as RedactionKey,
  /**
   * Review-status surface attached to normalized public traces.
   *
   * @see {@link Record} for the record model that carries it
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceReviewStatus as ReviewStatus,
  /**
   * Canonical normalized runtime event.
   *
   * @see {@link Event} for the enclosing event family
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceRuntimeEvent as RuntimeEvent,
  /**
   * Sealed private-review bundle preserved across trust boundaries.
   *
   * @see {@link PrivateReviewPayload} for the payload before sealing
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceSealedReviewBundle as SealedReviewBundle,
  /**
   * Canonical active-path selection record.
   *
   * @see {@link Branch} for the branch-lineage surface it summarizes
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceSelection as Selection,
  /**
   * Canonical normalized session header.
   *
   * @see {@link Record} for the normalized trace record that carries it
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceSession as Session,
  /**
   * Canonical identifier for normalized sessions.
   *
   * @see {@link Session} for the session model it identifies
   * @since 0.2.0
   * @category schemas
   */
  OpenAgentTraceSessionId as SessionId,
  /**
   * Canonical source locator for one normalized trace row.
   *
   * @see {@link Record} for the normalized trace record that carries it
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceSource as Source,
  /**
   * Canonical normalized summary event.
   *
   * @see {@link Event} for the enclosing event family
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceSummaryEvent as SummaryEvent,
  /**
   * Stable digest surface for normalized records.
   *
   * @see {@link SourceDigest} for the source-level companion digest
   * @since 0.2.0
   * @category models
   */
  RecordDigest,
  /**
   * Signed public corpus manifest for normalized trace releases.
   *
   * @see {@link CorpusManifest} for the unsigned manifest surface
   * @since 0.2.0
   * @category models
   */
  SignedCorpusManifest,
  /**
   * Stable digest surface for normalized sources.
   *
   * @see {@link RecordDigest} for the record-level companion digest
   * @since 0.2.0
   * @category models
   */
  SourceDigest
} from "./schema.js"
