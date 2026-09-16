/**
 * Search artifact provenance, payloads, and versioned envelopes.
 *
 * @since 0.4.4
 * @module
 */
import * as StudyArtifact from "@scenesystems/effect-study/Artifact"
import { Data, Effect, ParseResult, Predicate, Record, Schema, type SchemaAST, Tuple } from "effect"

import { Event } from "./StudyEvent.js"
import { Snapshot } from "./StudySnapshot.js"
import * as Trial from "./Trial.js"

/**
 * Search-owned source provenance composed from the open study source fields.
 *
 * @since 0.4.4
 * @category schemas
 */
export const Source = StudyArtifact.Source.pipe(
  Schema.extend(Schema.Struct({ origin: Schema.Literal("effect-search", "effect-dsp", "external") }))
)

/** Search source provenance decoded by {@link Source}. @since 0.4.4 @category models */
export type Source = typeof Source.Type

/**
 * Search artifact producer metadata.
 *
 * @since 0.4.4
 * @category schemas
 */
export const Producer = Schema.Union(
  Schema.TaggedStruct("EffectSearch", {
    packageVersion: StudyArtifact.PackageVersion,
    component: StudyArtifact.ComponentPath,
    runId: StudyArtifact.RunId
  }),
  Schema.TaggedStruct("EffectDsp", {
    packageVersion: StudyArtifact.PackageVersion,
    component: StudyArtifact.ComponentPath,
    runId: StudyArtifact.RunId,
    optimizer: Schema.NonEmptyString,
    metricName: Schema.NonEmptyString,
    exampleName: Schema.NonEmptyString
  }),
  Schema.TaggedStruct("External", {
    name: Schema.NonEmptyString,
    version: Schema.NonEmptyString
  })
)

/** Search artifact producer decoded by {@link Producer}. @since 0.4.4 @category models */
export type Producer = typeof Producer.Type

const producers = Data.taggedEnum<Producer>()

/** Constructs effect-search producer metadata. @since 0.4.4 @category constructors */
export const EffectSearch = producers.EffectSearch
/** Constructs effect-dsp producer metadata. @since 0.4.4 @category constructors */
export const EffectDsp = producers.EffectDsp
/** Constructs external producer metadata. @since 0.4.4 @category constructors */
export const External = producers.External
/** Narrows producer metadata by tag. @since 0.4.4 @category guards */
export const isProducer = producers.$is
/** Exhaustively matches producer metadata. @since 0.4.4 @category pattern-matching */
export const matchProducer = producers.$match

/**
 * Search artifact lineage over the package-owned source vocabulary.
 *
 * @since 0.4.4
 * @category schemas
 */
export const Lineage = StudyArtifact.Lineage(Source)

/** Search artifact lineage decoded by {@link Lineage}. @since 0.4.4 @category models */
export type Lineage = typeof Lineage.Type

const payloadArray = Schema.Array(Schema.suspend((): Schema.Schema<Payload> => Payload))
const payloadRecord = Schema.Record({
  key: Schema.String,
  value: Schema.suspend((): Schema.Schema<Payload> => Payload)
})

interface PayloadArray extends Schema.Schema.Type<typeof payloadArray> {}
interface PayloadRecord extends Schema.Schema.Type<typeof payloadRecord> {}

const recordInput = Schema.declare(Predicate.isRecord)
const payloadEntries = Schema.Array(Schema.Tuple(payloadRecord.key, payloadRecord.value))

const parseRecord = (input: unknown, options: SchemaAST.ParseOptions) =>
  ParseResult.decodeUnknown(recordInput)(input, options).pipe(
    Effect.map(Record.toEntries),
    Effect.flatMap((entries) => ParseResult.decodeUnknown(payloadEntries)(entries, options)),
    Effect.map(Record.fromEntries)
  )

const payloadRecordCodec = Schema.declare<PayloadRecord, PayloadRecord, []>(Tuple.make(), {
  decode: () => parseRecord,
  encode: () => parseRecord
})

const payload = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
  Schema.suspend((): Schema.Schema<PayloadArray> => payloadArray),
  Schema.suspend((): Schema.Schema<PayloadRecord> => payloadRecordCodec)
)

/**
 * Recursive custom artifact payload. Numeric leaves may be non-finite.
 *
 * @since 0.4.4
 * @category models
 */
export type Payload = typeof payload.Type

/**
 * Decodes recursive primitive, array, and own-key record payloads.
 *
 * @since 0.4.4
 * @category schemas
 */
export const Payload: Schema.Schema<Payload> = payload

const envelopePayload = Schema.Union(
  Schema.TaggedStruct("TrialLog", { trial: Trial.Trial(Schema.Unknown) }),
  Schema.TaggedStruct("StudySnapshot", { snapshot: Snapshot }),
  Schema.TaggedStruct("StudyEvent", { event: Event }),
  Schema.TaggedStruct("Custom", { payload: Payload })
)

const envelope = StudyArtifact.Envelope(Producer, Lineage, envelopePayload)

/** Search artifact envelope decoded by {@link Envelope}. @since 0.4.4 @category models */
export type Envelope = typeof envelope.Type

/**
 * Versioned search artifact envelope with a requirement-free codec.
 *
 * @since 0.4.4
 * @category schemas
 */
export const Envelope = Schema.make<Envelope, typeof envelope.Encoded>(envelope.ast)

const envelopes = Data.taggedEnum<Envelope>()

/** Constructs a persisted trial envelope. @since 0.4.4 @category constructors */
export const TrialLog = envelopes.TrialLog
/** Constructs a persisted study snapshot envelope. @since 0.4.4 @category constructors */
export const StudySnapshot = envelopes.StudySnapshot
/** Constructs a study event envelope. @since 0.4.4 @category constructors */
export const StudyEvent = envelopes.StudyEvent
/** Constructs a recursive custom payload envelope. @since 0.4.4 @category constructors */
export const Custom = envelopes.Custom
/** Narrows an envelope by payload tag. @since 0.4.4 @category guards */
export const is = envelopes.$is
/** Exhaustively matches an envelope payload. @since 0.4.4 @category pattern-matching */
export const match = envelopes.$match
