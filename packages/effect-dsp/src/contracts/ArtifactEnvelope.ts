/**
 * Re-exports of the `effect-search` artifact envelope system — typed
 * provenance wrappers for every artifact produced during optimization.
 *
 * Source of truth lives in `effect-search/Contracts`. The `EffectDsp` producer
 * variant carries DSP-specific context (optimizer, metricName, exampleName)
 * directly — no separate extension type needed.
 *
 * @since 0.1.4
 * @category re-exports
 */

export {
  /**
   * Typed artifact envelope carrying lineage, payload, and provenance metadata.
   *
   * @since 0.1.4
   */
  type ArtifactEnvelope,
  /**
   * Schema for decoding/encoding artifact envelopes.
   *
   * @since 0.1.4
   */
  ArtifactEnvelopeSchema,
  /**
   * Current artifact envelope schema version constant.
   *
   * @since 0.1.4
   */
  ArtifactEnvelopeVersion,
  /**
   * Composite run + sequence identifier for a single artifact record.
   *
   * @since 0.1.4
   */
  ArtifactId,
  /**
   * Provenance lineage record linking an artifact to its parent and relations.
   *
   * @since 0.1.4
   */
  ArtifactLineage,
  /**
   * Union schema for artifact payload content.
   *
   * @since 0.1.4
   */
  ArtifactPayload,
  /**
   * Discriminated union of artifact producer origins.
   *
   * @since 0.1.4
   */
  type ArtifactProducer,
  /**
   * Codec for serializing and deserializing producer union values.
   *
   * @since 0.1.4
   */
  ArtifactProducerSchema,
  /**
   * Typed parent/child relationship between artifacts.
   *
   * @since 0.1.4
   */
  type ArtifactRelation,
  /**
   * Schema for artifact relation records.
   *
   * @since 0.1.4
   */
  ArtifactRelationSchema,
  /**
   * Effectful artifact persistence sink backed by file system or custom transport.
   *
   * @since 0.1.4
   */
  ArtifactSink,
  /**
   * API contract for artifact sink implementations.
   *
   * @since 0.1.4
   */
  type ArtifactSinkApi,
  /**
   * Branded reference to a search-space binding coordinate.
   *
   * @since 0.1.4
   */
  BindingRef,
  /**
   * Branded reference to a module component path.
   *
   * @since 0.1.4
   */
  ComponentPath,
  /**
   * Branded hash digest for content-addressable artifact deduplication.
   *
   * @since 0.1.4
   */
  ContentDigest,
  /**
   * Custom external producer variant for user-defined artifact sources.
   *
   * @since 0.1.4
   */
  Custom,
  /**
   * DSP-specific producer variant carrying optimizer and metric context.
   *
   * @since 0.1.4
   */
  EffectDsp,
  /**
   * Effect-search producer variant for study/trial artifacts.
   *
   * @since 0.1.4
   */
  EffectSearch,
  /**
   * Emit an artifact envelope through the current sink context.
   *
   * @since 0.1.4
   */
  emit,
  /**
   * Context tag providing the active artifact sink and run identity.
   *
   * @since 0.1.4
   */
  EnvelopeContext,
  /**
   * Layer constructor for the envelope context service.
   *
   * @since 0.1.4
   */
  EnvelopeContextLive,
  /**
   * External producer variant for third-party artifact origins.
   *
   * @since 0.1.4
   */
  ExternalProducer,
  /**
   * Combine two sinks so both receive every envelope.
   *
   * @since 0.1.4
   */
  fanout,
  /**
   * File-system artifact sink writing NDJSON to a configurable directory.
   *
   * @since 0.1.4
   */
  fileSystemSink,
  /**
   * Branded reference to an instrument/measurement configuration.
   *
   * @since 0.1.4
   */
  InstrumentRef,
  /**
   * Reports whether a value is a valid artifact envelope.
   *
   * @since 0.1.4
   */
  isEnvelope,
  /**
   * Type guard for narrowing a single producer variant by tag.
   *
   * @since 0.1.4
   */
  isProducer,
  /**
   * Type guard for narrowing a single relation variant by tag.
   *
   * @since 0.1.4
   */
  isRelation,
  /**
   * Create an ArtifactSink layer from a custom implementation.
   *
   * @since 0.1.4
   */
  layer,
  /**
   * Pattern-match on artifact payload discriminant.
   *
   * @since 0.1.4
   */
  matchEnvelope,
  /**
   * Exhaustive pattern match on producer variants.
   *
   * @since 0.1.4
   */
  matchProducer,
  /**
   * Exhaustive pattern match on relation variants.
   *
   * @since 0.1.4
   */
  matchRelation,
  /**
   * Branded reference to an observation data point.
   *
   * @since 0.1.4
   */
  ObservationRef,
  /**
   * Branded reference to a package version string.
   *
   * @since 0.1.4
   */
  PackageVersion,
  /**
   * Branded reference to a protocol identifier.
   *
   * @since 0.1.4
   */
  ProtocolRef,
  /**
   * Branded identifier for an optimizer or evaluation run.
   *
   * @since 0.1.4
   */
  RunId,
  /**
   * Branded reference to a slot edge in the protocol graph.
   *
   * @since 0.1.4
   */
  SlotEdgeRef,
  /**
   * Branded reference to a slot in the protocol graph.
   *
   * @since 0.1.4
   */
  SlotRef,
  /**
   * Branded reference to a source file or module path.
   *
   * @since 0.1.4
   */
  SourceRef,
  /**
   * Envelope variant wrapping a study event with full provenance.
   *
   * @since 0.1.4
   */
  StudyEventEnvelope,
  /**
   * Envelope variant wrapping a study snapshot with full provenance.
   *
   * @since 0.1.4
   */
  StudySnapshotEnvelope,
  /**
   * Envelope variant wrapping a trial log entry with full provenance.
   *
   * @since 0.1.4
   */
  TrialLog
} from "effect-search/Contracts"
