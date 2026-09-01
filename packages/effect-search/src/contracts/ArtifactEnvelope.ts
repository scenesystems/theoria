/**
 * Canonical artifact envelope — tagged union of provenance-bearing output records.
 *
 * @remarks
 * The envelope is the shared contract between effect-search, effect-dsp, and
 * downstream adapters. Each variant carries typed payload specific to its kind,
 * with branded identity fields, structured lineage, and ontology-compatible relations.
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
 * Schema version literal for the canonical artifact envelope.
 *
 * @remarks
 * All envelopes carry this version in their `schemaVersion` field. When the
 * envelope shape changes in a breaking way, a new literal is introduced —
 * consumers can branch on version to support migration.
 *
 * @see {@link ArtifactEnvelopeSchema} — the schema that uses this version
 * @see {@link ArtifactEnvelope} — the type that carries this version
 *
 * @since 0.1.0
 * @category schemas
 */
export const ArtifactEnvelopeVersion = Schema.Literal("artifact-envelope/v1")

/**
 * The literal `"artifact-envelope/v1"` — extracted for use in type-level
 * constraints and version-branching logic.
 *
 * @see {@link ArtifactEnvelopeVersion} — schema definition
 *
 * @since 0.1.0
 * @category type-level
 */
export type ArtifactEnvelopeVersion = Schema.Schema.Type<typeof ArtifactEnvelopeVersion>

/**
 * JSON-safe recursive payload value for custom artifacts.
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
 * Recursive schema for custom artifact payload values.
 *
 * @remarks
 * Accepts any JSON-safe tree (strings, numbers, booleans, null, arrays,
 * and records) via `Schema.suspend` to handle arbitrary nesting depth.
 *
 * @see {@link ArtifactEnvelopeSchema} — uses this as the `Custom` variant payload
 * @see {@link Custom} — constructor for custom envelopes
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
 * Codec for serializing and deserializing {@link ArtifactEnvelope} values.
 *
 * @remarks
 * Encodes the four-variant tagged union to JSON and back. Every variant
 * shares base fields (`schemaVersion`, `producer`, `lineage`, `relations`)
 * and adds a variant-specific payload. Use with `Schema.decodeUnknown` /
 * `Schema.encode` at persistence and transport boundaries.
 *
 * @see {@link ArtifactEnvelope} — the type this schema produces
 * @see {@link ArtifactProducerSchema} — nested producer codec
 * @see {@link ArtifactRelationSchema} — nested relation codec
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
 * Transport contract projected into effect-dsp, combining producer/lineage
 * metadata with a trial, snapshot, event, or custom payload.
 *
 * @remarks
 * `relations` is optional; `schemaVersion` is `artifact-envelope/v1`.
 * Use `matchEnvelope` exhaustively; decode with {@link ArtifactEnvelopeSchema} first.
 *
 * @see {@link ArtifactEnvelopeSchema} — codec for serialization
 * @see {@link matchEnvelope} — exhaustive pattern match
 * @see {@link isEnvelope} — type guard
 *
 * @since 0.1.0
 * @category models
 */
export type ArtifactEnvelope = Schema.Schema.Type<typeof ArtifactEnvelopeSchema>

const ArtifactEnvelopes = Data.taggedEnum<ArtifactEnvelope>()

/**
 * Wraps a single trial result from an optimization run.
 *
 * @remarks
 * Contains the full {@link SnapshotTrialSchema} payload — parameter values,
 * objective measurements, and trial status — alongside provenance metadata.
 *
 * @see {@link ArtifactEnvelope} — parent union
 * @see {@link StudySnapshotEnvelope} — companion for full study snapshots
 *
 * @since 0.1.0
 * @category constructors
 */
export const TrialLog = ArtifactEnvelopes.TrialLog

/**
 * Wraps a point-in-time snapshot of an entire study.
 *
 * @remarks
 * Captures the full {@link StudySnapshot} — all trials, search space state,
 * and study metadata — enabling study replay and comparison across runs.
 *
 * @see {@link ArtifactEnvelope} — parent union
 * @see {@link TrialLog} — companion for individual trial results
 *
 * @since 0.1.0
 * @category constructors
 */
export const StudySnapshotEnvelope = ArtifactEnvelopes.StudySnapshot

/**
 * Wraps a discrete study lifecycle event (started, paused, completed, failed).
 *
 * @remarks
 * Carries a {@link StudyEventSchema} payload for event-sourced study history,
 * enabling reconstruction of study state from an ordered event stream.
 *
 * @see {@link ArtifactEnvelope} — parent union
 * @see {@link StudySnapshotEnvelope} — companion for full state snapshots
 *
 * @since 0.1.0
 * @category constructors
 */
export const StudyEventEnvelope = ArtifactEnvelopes.StudyEvent

/**
 * Wraps an arbitrary JSON-safe payload for extension points.
 *
 * @remarks
 * Use when none of the typed variants (TrialLog, StudySnapshot, StudyEvent)
 * apply — e.g. third-party adapter outputs or experimental artifact kinds.
 * The payload is validated by {@link ArtifactPayload}.
 *
 * @see {@link ArtifactEnvelope} — parent union
 * @see {@link ArtifactPayload} — recursive schema for the payload field
 *
 * @since 0.1.0
 * @category constructors
 */
export const Custom = ArtifactEnvelopes.Custom

/**
 * Exhaustive pattern match on envelope variants.
 *
 * @remarks
 * Provide a handler for each of the four envelope kinds. Adding a new
 * variant to {@link ArtifactEnvelope} causes a compile error at every
 * uncovered match site.
 *
 * @see {@link ArtifactEnvelope} — the union being matched
 * @see {@link isEnvelope} — non-exhaustive type guard alternative
 *
 * @since 0.1.0
 * @category pattern-matching
 */
export const matchEnvelope = ArtifactEnvelopes.$match

/**
 * Builds a type guard that narrows an artifact envelope by its envelope tag.
 *
 * @remarks
 * The returned predicate selects one of `TrialLog`, `StudySnapshot`,
 * `StudyEvent`, or `Custom` while preserving that variant's payload type.
 *
 * @see {@link ArtifactEnvelope} — the union being narrowed
 * @see {@link matchEnvelope} — exhaustive alternative
 *
 * @since 0.1.0
 * @category guards
 */
export const isEnvelope = ArtifactEnvelopes.$is
