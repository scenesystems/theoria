/**
 * Producer identity — tagged union of package-specific contexts.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

import { ComponentPath, PackageVersion, RunId } from "./identity.js"

/**
 * Codec for serializing and deserializing {@link ArtifactProducer} values.
 *
 * @remarks
 * Encodes the three-variant tagged union to JSON and back. Each variant
 * carries different metadata fields — use `Schema.decodeUnknown` at
 * ingestion boundaries.
 *
 * @see {@link ArtifactProducer} — the type this schema produces
 * @see {@link ArtifactRelationSchema} — companion schema for relation refs
 *
 * @since 0.1.0
 * @category schemas
 */
export const ArtifactProducerSchema = Schema.Union(
  Schema.TaggedStruct("EffectSearch", {
    packageVersion: PackageVersion,
    component: ComponentPath,
    runId: RunId
  }),
  Schema.TaggedStruct("EffectDsp", {
    packageVersion: PackageVersion,
    component: ComponentPath,
    runId: RunId,
    optimizer: Schema.NonEmptyString,
    metricName: Schema.NonEmptyString,
    exampleName: Schema.NonEmptyString
  }),
  Schema.TaggedStruct("External", {
    name: Schema.NonEmptyString,
    version: Schema.NonEmptyString
  })
)

/**
 * Cross-package provenance identity attached to every artifact envelope.
 *
 * @remarks
 * EffectSearch identifies package/component/run, EffectDsp additionally names
 * optimizer, metric, and example context, and External uses a non-empty
 * name/version pair. Consumers can branch exhaustively without interpreting
 * one producer's fields as another's.
 *
 * @see {@link ArtifactProducerSchema} — codec for serialization
 * @see {@link matchProducer} — exhaustive pattern match
 * @see {@link isProducer} — type guard
 *
 * @since 0.1.0
 * @category models
 */
export type ArtifactProducer = Schema.Schema.Type<typeof ArtifactProducerSchema>

const ArtifactProducers = Data.taggedEnum<ArtifactProducer>()

/**
 * Marks an artifact as produced by effect-search study orchestration.
 *
 * @remarks
 * Carries `packageVersion`, `component`, and `runId` to fully identify the
 * study pipeline and execution that generated the artifact.
 *
 * @see {@link ArtifactProducer} — parent union
 * @see {@link RunId} — the execution run within this producer
 *
 * @since 0.1.0
 * @category constructors
 */
export const EffectSearch = ArtifactProducers.EffectSearch

/**
 * Marks an artifact as produced by effect-dsp optimizer pipelines.
 *
 * @remarks
 * Extends the base fields with `optimizer`, `metricName`, and `exampleName`
 * to capture the specific optimization context — which optimizer ran, what
 * metric it targeted, and which example it evaluated.
 *
 * @see {@link ArtifactProducer} — parent union
 * @see {@link EffectSearch} — companion producer for study-level artifacts
 *
 * @since 0.1.0
 * @category constructors
 */
export const EffectDsp = ArtifactProducers.EffectDsp

/**
 * Marks an artifact as produced by a third-party integration.
 *
 * @remarks
 * Carries only `name` and `version` — an opaque identity for systems
 * outside effect-search / effect-dsp (e.g. "mlflow", "optuna").
 *
 * @see {@link ArtifactProducer} — parent union
 * @see {@link ExternalRelation} — companion for external relation refs
 *
 * @since 0.1.0
 * @category constructors
 */
export const ExternalProducer = ArtifactProducers.External

/**
 * Exhaustive pattern match on producer variants.
 *
 * @remarks
 * Provide a handler for each of the three producer kinds. Adding a new
 * variant to {@link ArtifactProducer} causes a compile error at every
 * uncovered match site.
 *
 * @see {@link ArtifactProducer} — the union being matched
 * @see {@link isProducer} — non-exhaustive type guard alternative
 *
 * @since 0.1.0
 * @category pattern-matching
 */
export const matchProducer = ArtifactProducers.$match

/**
 * Builds a type guard that narrows an artifact producer by its producer tag.
 *
 * @remarks
 * The returned predicate selects `EffectSearch`, `EffectDsp`, or `External`
 * provenance and exposes the metadata carried by that producer variant.
 *
 * @see {@link ArtifactProducer} — the union being narrowed
 * @see {@link matchProducer} — exhaustive alternative
 *
 * @since 0.1.0
 * @category guards
 */
export const isProducer = ArtifactProducers.$is
