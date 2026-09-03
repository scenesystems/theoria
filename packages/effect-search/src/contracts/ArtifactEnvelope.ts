/**
 * Versioned transport records shared by effect-search, effect-dsp, and artifact sinks.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

import { SnapshotTrialSchema } from "../Study/snapshot/stateCodec.js"
import { StudySnapshot } from "../Study/snapshot/versioning.js"
import { StudyEventSchema } from "../StudyEvent/model/schemas.js"
import { ArtifactLineage } from "./ArtifactLineage.js"
import { ArtifactProducerSchema } from "./ArtifactProducer.js"
import { ArtifactRelationSchema } from "./ArtifactRelation.js"

/**
 * Decodes the `"artifact-envelope/v1"` wire-format discriminator.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ArtifactEnvelopeVersion = Schema.Literal("artifact-envelope/v1")

/**
 * Wire-format version carried by every artifact envelope.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ArtifactEnvelopeVersion = Schema.Schema.Type<typeof ArtifactEnvelopeVersion>

/**
 * Recursive custom payload made from primitive values, arrays, and string-keyed records.
 * Numbers are not constrained to finite values by this type.
 *
 * @since 0.1.0
 * @category models
 */
export type ArtifactPayload =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<ArtifactPayload>
  | { readonly [key: string]: ArtifactPayload }

const ArtifactPayloadSchema: Schema.Schema<ArtifactPayload, ArtifactPayload, never> = Schema.suspend(
  (): Schema.Schema<ArtifactPayload, ArtifactPayload, never> =>
    Schema.Union(
      Schema.String,
      Schema.Number,
      Schema.Boolean,
      Schema.Null,
      Schema.Array(ArtifactPayloadSchema),
      Schema.Record({ key: Schema.String, value: ArtifactPayloadSchema })
    )
)

/**
 * Decodes recursively nested custom payloads without imposing a depth limit.
 *
 * @remarks
 * Accepted leaves are strings, numbers, booleans, and null. Numeric leaves may be
 * non-finite even though JSON serialization cannot preserve those values faithfully.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ArtifactPayload = ArtifactPayloadSchema

const envelopeBaseFields = {
  schemaVersion: ArtifactEnvelopeVersion,
  producer: ArtifactProducerSchema,
  lineage: ArtifactLineage,
  relations: Schema.optional(Schema.Array(ArtifactRelationSchema))
}

/**
 * Decodes version-one trial, study snapshot, study event, and custom artifact records.
 *
 * @remarks
 * Decoding validates the nested producer declaration, lineage, optional relations, and
 * variant payload. It does not authenticate provenance, verify integrity digests, or
 * establish referential consistency among relations.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ArtifactEnvelopeSchema = Schema.Union(
  Schema.TaggedStruct("TrialLog", {
    ...envelopeBaseFields,
    trial: SnapshotTrialSchema
  }),
  Schema.TaggedStruct("StudySnapshot", {
    ...envelopeBaseFields,
    snapshot: StudySnapshot
  }),
  Schema.TaggedStruct("StudyEvent", {
    ...envelopeBaseFields,
    event: StudyEventSchema
  }),
  Schema.TaggedStruct("Custom", {
    ...envelopeBaseFields,
    payload: ArtifactPayload
  })
)

/**
 * Version-one artifact record with declared provenance and a tagged payload.
 *
 * @remarks
 * Every variant includes a producer and lineage. `relations` may be absent. Callers
 * receiving unknown data should decode it with {@link ArtifactEnvelopeSchema} before
 * using the tagged constructors or matchers.
 *
 * @since 0.1.0
 * @category models
 */
export type ArtifactEnvelope = Schema.Schema.Type<typeof ArtifactEnvelopeSchema>

const ArtifactEnvelopes = Data.taggedEnum<ArtifactEnvelope>()

/**
 * Constructs an envelope containing one serializable trial record.
 *
 * @remarks
 * The constructor performs no decoding. Use {@link ArtifactEnvelopeSchema} when the
 * trial or provenance fields cross an untrusted or serialized boundary.
 *
 * @since 0.1.0
 * @category constructors
 */
export const TrialLog = ArtifactEnvelopes.TrialLog

/**
 * Constructs an envelope containing a persisted study snapshot.
 *
 * @since 0.1.0
 * @category constructors
 */
export const StudySnapshotEnvelope = ArtifactEnvelopes.StudySnapshot

/**
 * Constructs an envelope containing one public study event.
 * Event envelopes record notifications and do not by themselves constitute a replay log.
 *
 * @since 0.1.0
 * @category constructors
 */
export const StudyEventEnvelope = ArtifactEnvelopes.StudyEvent

/**
 * Constructs an envelope containing a recursive custom payload.
 *
 * @remarks
 * Use this branch for data that has no trial, snapshot, or study-event representation.
 * Construction relies on the static payload type; decode unknown data with
 * {@link ArtifactPayload} or {@link ArtifactEnvelopeSchema}.
 *
 * @since 0.1.0
 * @category constructors
 */
export const Custom = ArtifactEnvelopes.Custom

/**
 * Dispatches an artifact envelope to the handler for its tagged payload variant.
 *
 * @typeParam Cases - Exhaustive handler record whose return values determine the result union.
 *
 * @since 0.1.0
 * @category pattern-matching
 */
export const matchEnvelope = ArtifactEnvelopes.$match

/**
 * Builds a predicate that narrows an artifact envelope by `_tag`.
 *
 * @typeParam Tag - Envelope discriminator selected for narrowing.
 *
 * @since 0.1.0
 * @category guards
 */
export const isEnvelope = ArtifactEnvelopes.$is
