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
 * Tagged union of artifact producer variants.
 *
 * Each producer kind carries its own metadata — EffectSearch has study context,
 * EffectDsp has optimizer context, External has opaque identity.
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
 * Type guard for narrowing a single producer variant by tag.
 *
 * Returns a predicate that narrows {@link ArtifactProducer} to the
 * specified variant — useful in `Array.filter` and conditional branches
 * where exhaustive matching is unnecessary.
 *
 * @see {@link ArtifactProducer} — the union being narrowed
 * @see {@link matchProducer} — exhaustive alternative
 *
 * @since 0.1.0
 * @category guards
 */
export const isProducer = ArtifactProducers.$is
