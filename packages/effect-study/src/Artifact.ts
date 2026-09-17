/**
 * Artifact identity, provenance, relations, and schema composition.
 *
 * @since 0.1.0
 * @module
 */
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import { Data, Effect, ParseResult, Predicate, Record, Schema, type SchemaAST, Tuple } from "effect"

/**
 * Canonical ULID execution identifier.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RunId = Schema.ULID.pipe(
  Schema.brand("@scenesystems/effect-study/Artifact/RunId")
).annotations({ identifier: "@scenesystems/effect-study/Artifact/RunId" })

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
  Schema.pattern(/^\d+\.\d+\.\d+/),
  Schema.brand("@scenesystems/effect-study/Artifact/PackageVersion")
).annotations({ identifier: "@scenesystems/effect-study/Artifact/PackageVersion" })

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
export const ComponentPath = Schema.NonEmptyArray(Schema.NonEmptyString).annotations({
  identifier: "@scenesystems/effect-study/Artifact/ComponentPath"
})

/**
 * A component path decoded by {@link ComponentPath}.
 *
 * @since 0.1.0
 * @category models
 */
export type ComponentPath = typeof ComponentPath.Type

const payloadArray = Schema.Array(Schema.suspend((): Schema.Schema<Payload> => Payload)).annotations({
  identifier: "@scenesystems/effect-study/Artifact/PayloadArray"
})
const payloadRecord = Schema.Record({
  key: Schema.String,
  value: Schema.suspend((): Schema.Schema<Payload> => Payload)
}).annotations({ identifier: "@scenesystems/effect-study/Artifact/PayloadRecord" })

/** Recursive payload sequence. @since 0.1.0 @category models */
export interface PayloadArray extends Schema.Schema.Type<typeof payloadArray> {}

/** Recursive own-key payload record. @since 0.1.0 @category models */
export interface PayloadRecord extends Schema.Schema.Type<typeof payloadRecord> {}

const recordInput = Schema.declare(Predicate.isRecord).annotations({
  identifier: "@scenesystems/effect-study/Artifact/RecordInput"
})
const payloadEntries = Schema.Array(Schema.Tuple(payloadRecord.key, payloadRecord.value)).annotations({
  identifier: "@scenesystems/effect-study/Artifact/PayloadEntries"
})

const parseRecord = (input: unknown, options: SchemaAST.ParseOptions) =>
  ParseResult.decodeUnknown(recordInput)(input, options).pipe(
    Effect.map(Record.toEntries),
    Effect.flatMap((entries) => ParseResult.decodeUnknown(payloadEntries)(entries, options)),
    Effect.map(Record.fromEntries)
  )

const payloadRecordCodec = Schema.declare<PayloadRecord, PayloadRecord, []>(Tuple.make(), {
  decode: () => parseRecord,
  encode: () => parseRecord
}).annotations({ identifier: "@scenesystems/effect-study/Artifact/PayloadRecordCodec" })

const payload = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
  Schema.suspend((): Schema.Schema<PayloadArray> => payloadArray),
  Schema.suspend((): Schema.Schema<PayloadRecord> => payloadRecordCodec)
).annotations({ identifier: "@scenesystems/effect-study/Artifact/Payload" })

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
export const Payload: Schema.Schema<Payload> = payload

/**
 * Artifact identity within one run.
 *
 * @since 0.1.0
 * @category models
 */
export class Id extends Schema.Class<Id>("@scenesystems/effect-study/Artifact/Id")({
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
}).annotations({ identifier: "@scenesystems/effect-study/Artifact/Source" })

/**
 * Source provenance decoded by {@link Source}.
 *
 * @since 0.1.0
 * @category models
 */
export type Source = typeof Source.Type

const LineageMetadata = Schema.Struct({
  artifactId: Id,
  emittedAt: Schema.DateTimeUtc,
  derivedFrom: Schema.optional(Schema.Array(Id)),
  integrity: Schema.optional(ContentDigest.ContentDigest)
}).annotations({ identifier: "@scenesystems/effect-study/Artifact/LineageMetadata" })

/**
 * Builds artifact lineage around a caller-selected source schema.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Lineage = <SourceSchema extends Schema.Schema.All>(sourceSchema: SourceSchema) =>
  Schema.Struct({
    ...LineageMetadata.fields,
    sourceRef: sourceSchema
  }).annotations({ identifier: "@scenesystems/effect-study/Artifact/Lineage" })

/**
 * Artifact lineage decoded from the canonical factory.
 *
 * @since 0.1.0
 * @category models
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
).annotations({ identifier: "@scenesystems/effect-study/Artifact/Relation" })

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
}).annotations({ identifier: "@scenesystems/effect-study/Artifact/EnvelopeMetadata" })

/**
 * Composes caller-owned producer, lineage, and payload schemas. Encoded forms
 * and schema requirements from every component are retained.
 *
 * @since 0.1.0
 * @category schemas
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
    })),
    Schema.annotations({ identifier: "@scenesystems/effect-study/Artifact/Envelope" })
  )

/**
 * An artifact envelope decoded from the canonical factory.
 *
 * @since 0.1.0
 * @category models
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
