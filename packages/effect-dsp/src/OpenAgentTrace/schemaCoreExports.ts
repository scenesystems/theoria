/**
 * Core normalized record and event exports for the public open-agent-trace seam.
 *
 * @since 0.2.0
 */

export {
  /**
   * Canonical actor descriptor for normalized trace events.
   *
   * @see {@link Message} for the primary event surface that carries actors
   * @since 0.2.0
   * @category schemas
   */
  OpenAgentTraceActor as Actor,
  /**
   * Canonical identifier for normalized content blocks.
   *
   * @see {@link ContentBlock} for the block family it identifies
   * @since 0.2.0
   * @category schemas
   */
  OpenAgentTraceBlockId as BlockId,
  /**
   * Canonical branch-lineage unit for one normalized trace.
   *
   * @see {@link Selection} for the active-path selection surface
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceBranch as Branch,
  /**
   * Canonical normalized content-block family.
   *
   * @see {@link Message} for the event surface that carries content blocks
   * @since 0.2.0
   * @category schemas
   */
  OpenAgentTraceContentBlock as ContentBlock,
  /**
   * Content digest preserved on normalized trace payloads.
   *
   * @see {@link formatOpenAgentTraceContentDigest} for the stable formatter
   * @since 0.2.0
   * @category schemas
   */
  OpenAgentTraceContentDigest as ContentDigest,
  /**
   * Coverage gap surface for lossy or unsupported projection.
   *
   * @see {@link AdapterCoverageGap} for adapter-specific normalization gaps
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceCoverage as Coverage,
  /**
   * Canonical normalized event family.
   *
   * @see {@link Record} for the enclosing normalized trace record
   * @since 0.2.0
   * @category schemas
   */
  OpenAgentTraceEvent as Event,
  /**
   * Canonical identifier for normalized trace events.
   *
   * @see {@link Event} for the event family it identifies
   * @since 0.2.0
   * @category schemas
   */
  OpenAgentTraceEventId as EventId,
  /**
   * Canonical identifier for redaction findings.
   *
   * @see {@link RedactionFinding} for the finding model it identifies
   * @since 0.2.0
   * @category schemas
   */
  OpenAgentTraceFindingId as FindingId,
  /**
   * Manifest digest preserved for corpus-manifest provenance.
   *
   * @see {@link SignedCorpusManifest} for the sealed manifest surface
   * @since 0.2.0
   * @category schemas
   */
  OpenAgentTraceManifestDigest as ManifestDigest,
  /**
   * Canonical normalized message event.
   *
   * @see {@link Event} for the enclosing event family
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceMessage as Message,
  /**
   * Canonical normalized metadata or extension event.
   *
   * @see {@link Event} for the enclosing event family
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceMetadataEvent as MetadataEvent,
  /**
   * Preserved runtime provenance for assistant turns sourced from `pi`.
   *
   * @see {@link Message} for the event surface that can carry it
   * @since 0.2.0
   * @category schemas
   */
  OpenAgentTracePiTurnProvenance as PiTurnProvenance,
  /**
   * Private review payload preserved before sealing.
   *
   * @see {@link SealedReviewBundle} for the sealed boundary surface
   * @since 0.2.0
   * @category models
   */
  OpenAgentTracePrivateReviewPayload as PrivateReviewPayload,
  /**
   * Canonical normalized trace record.
   *
   * @see {@link Event} for the event family it contains
   * @since 0.2.0
   * @category models
   */
  OpenAgentTraceRecord as Record,
  /**
   * Canonical identifier for normalized trace records.
   *
   * @see {@link Record} for the model it identifies
   * @since 0.2.0
   * @category schemas
   */
  OpenAgentTraceRecordId as RecordId
} from "./schema.js"
