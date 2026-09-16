/**
 * Artifact identity, provenance, relations, and schema composition.
 *
 * @since 0.1.0
 * @module
 */
import { ContentDigest } from "@scenesystems/digest"
import { Data, Schema } from "effect"

/**
 * Canonical ULID execution identifier.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RunId = Schema.ULID.pipe(Schema.brand("RunId"))

/**
 * An execution identifier decoded by {@link RunId}.
 *
 * @since 0.1.0
 * @category type-level
 */
export type RunId = typeof RunId.Type

/**
 * Canonical package version with a numeric triplet prefix.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PackageVersion = Schema.NonEmptyString.pipe(
  Schema.pattern(/^\d+\.\d+\.\d+/),
  Schema.brand("PackageVersion")
)

/**
 * A package version decoded by {@link PackageVersion}.
 *
 * @since 0.1.0
 * @category type-level
 */
export type PackageVersion = typeof PackageVersion.Type

/**
 * Non-empty logical component path.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ComponentPath = Schema.NonEmptyArray(Schema.NonEmptyString)

/**
 * A component path decoded by {@link ComponentPath}.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ComponentPath = typeof ComponentPath.Type

/**
 * Artifact identity within one run.
 *
 * @since 0.1.0
 * @category models
 */
export class Id extends Schema.Class<Id>("effect-study/Artifact/Id")({
  runId: RunId,
  sequence: Schema.NonNegativeInt
}) {}

/**
 * Open source provenance. Consumers may compose a narrower source schema when
 * constructing lineage.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Source = Schema.Struct({
  origin: Schema.NonEmptyString,
  domain: Schema.NonEmptyString,
  segments: Schema.NonEmptyArray(Schema.NonEmptyString)
})

/**
 * Source provenance decoded by {@link Source}.
 *
 * @since 0.1.0
 * @category type-level
 */
export type Source = typeof Source.Type

const LineageMetadata = Schema.Struct({
  artifactId: Id,
  emittedAt: Schema.DateTimeUtc,
  derivedFrom: Schema.optional(Schema.Array(Id)),
  integrity: Schema.optional(ContentDigest)
})

/**
 * Builds artifact lineage around a caller-selected source schema. The wire
 * field remains `sourceRef` so existing envelopes retain their protocol shape.
 *
 * @since 0.1.0
 * @category schema factories
 */
export const Lineage = <SourceSchema extends Schema.Schema.All>(sourceSchema: SourceSchema) =>
  Schema.Struct({
    ...LineageMetadata.fields,
    sourceRef: sourceSchema
  })

/**
 * Artifact lineage decoded from the canonical factory.
 *
 * @since 0.1.0
 * @category type-level
 */
export type Lineage<SourceValue> = Schema.Schema.Type<
  Schema.extend<typeof LineageMetadata, Schema.Struct<{ sourceRef: Schema.Schema<SourceValue> }>>
>

/**
 * Generic artifact associations. Domain-specific relation vocabularies should
 * be composed by their owning package rather than added here.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Relation = Schema.Union(
  Schema.TaggedStruct("Run", { ref: RunId }),
  Schema.TaggedStruct("External", { ref: Schema.NonEmptyString, namespace: Schema.NonEmptyString })
)

/**
 * An artifact association decoded by {@link Relation}.
 *
 * @since 0.1.0
 * @category models
 */
export type Relation = typeof Relation.Type

const Relations = Data.taggedEnum<Relation>()

/** Constructs a run association. @since 0.1.0 @category constructors */
export const Run = Relations.Run

/** Constructs a namespaced external association. @since 0.1.0 @category constructors */
export const External = Relations.External

/** Narrows an association by tag. @since 0.1.0 @category guards */
export const isRelation = Relations.$is

/** Exhaustively dispatches an association. @since 0.1.0 @category pattern matching */
export const matchRelation = Relations.$match

/**
 * Version discriminator for canonical artifact envelopes.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Version = Schema.Literal("artifact-envelope/v1")

/**
 * An artifact envelope version decoded by {@link Version}.
 *
 * @since 0.1.0
 * @category type-level
 */
export type Version = typeof Version.Type

const EnvelopeMetadata = Schema.Struct({
  schemaVersion: Version,
  relations: Schema.optional(Schema.Array(Relation))
})

/**
 * Composes caller-owned producer, lineage, and payload schemas. Encoded forms
 * and schema requirements from every component are retained.
 *
 * @since 0.1.0
 * @category schema factories
 */
export const Envelope = <
  Producer extends Schema.Schema.Any,
  LineageSchema extends Schema.Schema.Any,
  Payload extends Schema.Schema.Any
>(producerSchema: Producer, lineageSchema: LineageSchema, payloadSchema: Payload) =>
  payloadSchema.pipe(
    Schema.extend(Schema.Struct({
      ...EnvelopeMetadata.fields,
      producer: producerSchema,
      lineage: lineageSchema
    }))
  )

/**
 * An artifact envelope decoded from the canonical factory.
 *
 * @since 0.1.0
 * @category type-level
 */
export type Envelope<ProducerValue, LineageValue, PayloadValue> = Schema.Schema.Type<
  Schema.extend<
    Schema.extend<
      typeof EnvelopeMetadata,
      Schema.Struct<{
        producer: Schema.Schema<ProducerValue>
        lineage: Schema.Schema<LineageValue>
      }>
    >,
    Schema.Schema<PayloadValue>
  >
>
