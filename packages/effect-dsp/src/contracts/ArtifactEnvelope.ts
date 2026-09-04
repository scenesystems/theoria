/**
 * Re-exports of the `effect-search` artifact envelope system — typed
 * provenance wrappers for every artifact produced during optimization.
 *
 * Source of truth lives in `@scenesystems/effect-search/Contracts`. The `EffectDsp` producer
 * variant carries DSP-specific context (optimizer, metricName, exampleName)
 * directly — no separate extension type needed.
 *
 * @since 0.1.4
 * @category re-exports
 */

export {
  type ArtifactEnvelope,
  ArtifactEnvelopeSchema,
  ArtifactEnvelopeVersion,
  ArtifactId,
  ArtifactLineage,
  ArtifactPayload,
  type ArtifactProducer,
  ArtifactProducerSchema,
  type ArtifactRelation,
  ArtifactRelationSchema,
  ArtifactSink,
  type ArtifactSinkApi,
  BindingRef,
  ComponentPath,
  ContentDigest,
  Custom,
  EffectDsp,
  EffectSearch,
  emit,
  EnvelopeContext,
  EnvelopeContextLive,
  ExternalProducer,
  fanout,
  fileSystemSink,
  InstrumentRef,
  isEnvelope,
  isProducer,
  isRelation,
  layer,
  matchEnvelope,
  matchProducer,
  matchRelation,
  ObservationRef,
  PackageVersion,
  ProtocolRef,
  RunId,
  SlotEdgeRef,
  SlotRef,
  SourceRef,
  StudyEventEnvelope,
  StudySnapshotEnvelope,
  TrialLog
} from "@scenesystems/effect-search/Contracts"
