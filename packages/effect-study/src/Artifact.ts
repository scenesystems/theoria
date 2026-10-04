/**
 * Artifact identity, provenance, relations, and schema composition.
 *
 * @since 0.1.0
 * @module
 */
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import { Data, Schema } from "effect"

/**
 * Canonical ULID execution identifier.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RunId = Schema.String.pipe(
  Schema.check(Schema.isULID()),
  Schema.brand("@scenesystems/effect-study/Artifact/RunId"),
  Schema.annotate({ identifier: "@scenesystems/effect-study/Artifact/RunId" })
)

/**
 * An execution identifier decoded by {@link RunId}.
 *
 * @since 0.1.0
 * @category models
 */
export type RunId = typeof RunId.Type

/**
 * Canonical package version with a numeric triplet prefix.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PackageVersion = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isPattern(/^\d+\.\d+\.\d+/)),
  Schema.brand("@scenesystems/effect-study/Artifact/PackageVersion"),
  Schema.annotate({ identifier: "@scenesystems/effect-study/Artifact/PackageVersion" })
)

/**
 * A package version decoded by {@link PackageVersion}.
 *
 * @since 0.1.0
 * @category models
 */
export type PackageVersion = typeof PackageVersion.Type

/**
 * Non-empty logical component path.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ComponentPath = Schema.NonEmptyArray(Schema.NonEmptyString).pipe(
  Schema.annotate({ identifier: "@scenesystems/effect-study/Artifact/ComponentPath" })
)

/**
 * A component path decoded by {@link ComponentPath}.
 *
 * @since 0.1.0
 * @category models
 */
export type ComponentPath = typeof ComponentPath.Type

const payloadArray = Schema.Array(Schema.suspend((): Schema.Codec<Payload> => Payload)).pipe(
  Schema.annotate({ identifier: "@scenesystems/effect-study/Artifact/PayloadArray" })
)
const payloadRecord = Schema.Record(Schema.String, Schema.suspend((): Schema.Codec<Payload> => Payload)).pipe(
  Schema.annotate({ identifier: "@scenesystems/effect-study/Artifact/PayloadRecord" })
)

/** Recursive payload sequence. @since 0.1.0 @category models */
export interface PayloadArray extends Schema.Schema.Type<typeof payloadArray> {}

/** Recursive own-key payload record. @since 0.1.0 @category models */
export interface PayloadRecord extends Schema.Schema.Type<typeof payloadRecord> {}

const payload = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
  Schema.suspend((): Schema.Codec<PayloadArray> => payloadArray),
  Schema.suspend((): Schema.Codec<PayloadRecord> => payloadRecord)
]).pipe(Schema.annotate({ identifier: "@scenesystems/effect-study/Artifact/Payload" }))

/**
 * Recursive artifact payload made from primitive, array, and own-key record
 * values. Numeric leaves retain JavaScript's full number behavior outside a
 * JSON transport.
 *
 * @since 0.1.0
 * @category models
 */
export type Payload = typeof payload.Type

/**
 * Decodes recursive artifact payloads while preserving own keys such as
 * `__proto__`, `constructor`, and `toString`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Payload: Schema.Codec<Payload> = payload

/**
 * Artifact identity within one run.
 *
 * @since 0.1.0
 * @category models
 */
export class Id extends Schema.Class<Id>("@scenesystems/effect-study/Artifact/Id")({
  runId: RunId,
  sequence: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))
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
}).pipe(Schema.annotate({ identifier: "@scenesystems/effect-study/Artifact/Source" }))

/**
 * Source provenance decoded by {@link Source}.
 *
 * @since 0.1.0
 * @category models
 */
export type Source = typeof Source.Type

const LineageMetadata = Schema.Struct({
  artifactId: Id,
  emittedAt: Schema.DateTimeUtcFromString,
  derivedFrom: Schema.optional(Schema.Array(Id)),
  integrity: Schema.optional(ContentDigest.ContentDigest)
}).pipe(Schema.annotate({ identifier: "@scenesystems/effect-study/Artifact/LineageMetadata" }))

/**
 * Builds artifact lineage around a caller-selected source schema.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Lineage = <SourceSchema extends Schema.Constraint>(sourceSchema: SourceSchema) =>
  Schema.Struct({
    ...LineageMetadata.fields,
    sourceRef: sourceSchema
  }).pipe(Schema.annotate({ identifier: "@scenesystems/effect-study/Artifact/Lineage" }))

/**
 * Artifact lineage decoded from the canonical factory.
 *
 * @since 0.1.0
 * @category models
 */
export type Lineage<SourceValue> = Schema.Schema.Type<
  Schema.Struct<typeof LineageMetadata.fields & { readonly sourceRef: Schema.Schema<SourceValue> }>
>

/**
 * Generic artifact associations. Domain-specific relation vocabularies should
 * be composed by their owning package rather than added here.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Relation = Schema.Union([
  Schema.TaggedStruct("Run", { ref: RunId }),
  Schema.TaggedStruct("External", { ref: Schema.NonEmptyString, namespace: Schema.NonEmptyString })
]).pipe(Schema.annotate({ identifier: "@scenesystems/effect-study/Artifact/Relation" }))

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

/** Exhaustively dispatches an association. @since 0.1.0 @category operations */
export const matchRelation = Relations.$match

const EnvelopeMetadata = Schema.Struct({
  relations: Schema.optional(Schema.Array(Relation))
}).pipe(Schema.annotate({ identifier: "@scenesystems/effect-study/Artifact/EnvelopeMetadata" }))

/**
 * Extends a caller-owned payload struct with producer and lineage schemas.
 * Field codecs and payload checks are retained. Payload checks must remain valid
 * with the added metadata; reserve `producer`, `lineage`, and `relations` for the envelope.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Envelope = <
  Producer extends Schema.Constraint,
  LineageSchema extends Schema.Constraint,
  Fields extends Schema.Struct.Fields
>(producerSchema: Producer, lineageSchema: LineageSchema, payloadSchema: Schema.Struct<Fields>) =>
  payloadSchema.mapFields((fields) => ({
    ...fields,
    ...EnvelopeMetadata.fields,
    producer: producerSchema,
    lineage: lineageSchema
  }), { unsafePreserveChecks: true })
    .annotate({ identifier: "@scenesystems/effect-study/Artifact/Envelope" })

/**
 * An artifact envelope decoded from the canonical factory.
 *
 * @since 0.1.0
 * @category models
 */
export type Envelope<ProducerValue, LineageValue, PayloadValue> =
  & PayloadValue
  & Schema.Schema.Type<
    Schema.Struct<
      typeof EnvelopeMetadata.fields & {
        readonly producer: Schema.Schema<ProducerValue>
        readonly lineage: Schema.Schema<LineageValue>
      }
    >
  >
