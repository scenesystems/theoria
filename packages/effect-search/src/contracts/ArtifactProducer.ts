/**
 * Declared producer identity attached to artifact envelopes.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

import { ComponentPath, PackageVersion, RunId } from "./identity.js"

/**
 * Decodes producer metadata for effect-search, effect-dsp, or an external system.
 *
 * @remarks
 * Package-owned variants validate a package version prefix, component path, and run
 * ULID. The effect-dsp branch also requires non-empty optimizer, metric, and example
 * names. External names and versions are non-empty strings without further validation.
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
 * Producer-supplied origin metadata for an artifact.
 *
 * @remarks
 * The tagged variants preserve different producer-specific fields. The metadata is
 * declarative and does not authenticate the named package, execution, or external system.
 *
 * @since 0.1.0
 * @category models
 */
export type ArtifactProducer = Schema.Schema.Type<typeof ArtifactProducerSchema>

const ArtifactProducers = Data.taggedEnum<ArtifactProducer>()

/**
 * Constructs effect-search provenance from a declared package version, component, and run.
 *
 * @since 0.1.0
 * @category constructors
 */
export const EffectSearch = ArtifactProducers.EffectSearch

/**
 * Constructs effect-dsp provenance with optimizer, metric, and example context.
 *
 * @remarks
 * The constructor accepts already typed fields and performs no runtime schema decoding.
 *
 * @since 0.1.0
 * @category constructors
 */
export const EffectDsp = ArtifactProducers.EffectDsp

/**
 * Constructs external provenance from a producer name and version label.
 *
 * @remarks
 * Both fields are opaque declarations. Use {@link ArtifactProducerSchema} at an
 * untrusted boundary to enforce their non-empty constraint.
 *
 * @since 0.1.0
 * @category constructors
 */
export const ExternalProducer = ArtifactProducers.External

/**
 * Dispatches producer metadata to the handler for its tagged variant.
 *
 * @typeParam Cases - Exhaustive handler record whose return values determine the result union.
 *
 * @since 0.1.0
 * @category pattern-matching
 */
export const matchProducer = ArtifactProducers.$match

/**
 * Builds a predicate that narrows producer metadata by `_tag`.
 *
 * @typeParam Tag - Producer discriminator selected for narrowing.
 *
 * @since 0.1.0
 * @category guards
 */
export const isProducer = ArtifactProducers.$is
