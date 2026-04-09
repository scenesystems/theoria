/**
 * Canonical artifact envelope — tagged union of provenance-bearing output records.
 *
 * The envelope is the shared contract between effect-search, effect-dsp, and
 * downstream adapters. Each variant carries typed payload specific to its kind,
 * with branded identity fields, structured lineage, and ontology-compatible relations.
 *
 * @since 0.1.0
 */
import { Data, DateTime, Effect, Schema } from "effect"
import type * as Context from "effect/Context"

import type { SnapshotTrial } from "../Study/snapshot/stateCodec.js"
import { SnapshotTrialSchema } from "../Study/snapshot/stateCodec.js"
import { StudySnapshot } from "../Study/snapshot/versioning.js"
import { StudyEventSchema } from "../StudyEvent/model/schemas.js"
import { ArtifactLineage } from "./ArtifactLineage.js"
import { ArtifactProducerSchema, EffectSearch } from "./ArtifactProducer.js"
import { ArtifactRelationSchema, RunRelation } from "./ArtifactRelation.js"
import { EnvelopeContext } from "./EnvelopeContext.js"
import { type ArtifactId, type ComponentPath, SourceRef } from "./identity.js"

/**
 * Schema version literal for the canonical artifact envelope.
 *
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

const _TrialLogFieldsSchema = Schema.Struct({
  ...envelopeBaseFields,
  trial: SnapshotTrialSchema
})

const _StudySnapshotEnvelopeFieldsSchema = Schema.Struct({
  ...envelopeBaseFields,
  snapshot: StudySnapshot
})

/**
 * Tagged union of artifact envelope variants.
 *
 * Each variant carries typed payload specific to its kind. Consumers use
 * `matchEnvelope` for exhaustive processing — adding a new variant is a
 * compile error at every uncovered match site.
 *
 * @see {@link ArtifactEnvelopeSchema} — codec for serialization
 * @see {@link matchEnvelope} — exhaustive pattern match
 * @see {@link isEnvelope} — type guard
 *
 * @since 0.1.0
 * @category models
 */
export type ArtifactEnvelope = Schema.Schema.Type<typeof ArtifactEnvelopeSchema>
type TrialLogEnvelope = Extract<ArtifactEnvelope, { readonly _tag: "TrialLog" }>
type TrialLogFields = Schema.Schema.Type<typeof _TrialLogFieldsSchema>
type StudySnapshotEnvelopeModel = Extract<ArtifactEnvelope, { readonly _tag: "StudySnapshot" }>
type StudySnapshotEnvelopeFields = Schema.Schema.Type<typeof _StudySnapshotEnvelopeFieldsSchema>

const ArtifactEnvelopes = Data.taggedEnum<ArtifactEnvelope>()
type EnvelopeContextApi = Context.Tag.Service<typeof EnvelopeContext>

const SCHEMA_VERSION: ArtifactEnvelopeVersion = "artifact-envelope/v1"

const STUDY_COMPONENT: ComponentPath = ["Study"]

const TRIAL_SOURCE_REF = new SourceRef({ origin: "effect-search", domain: "study", segments: ["trial"] })
const SNAPSHOT_SOURCE_REF = new SourceRef({ origin: "effect-search", domain: "study", segments: ["snapshot"] })

const producerFromContext = (ctx: EnvelopeContextApi) =>
  EffectSearch({
    packageVersion: ctx.packageVersion,
    component: STUDY_COMPONENT,
    runId: ctx.runId
  })

const trialLogConstructor = ArtifactEnvelopes.TrialLog
const studySnapshotEnvelopeConstructor = ArtifactEnvelopes.StudySnapshot

const trialLogFromContext = (
  ctx: EnvelopeContextApi,
  artifactId: ArtifactId,
  trial: SnapshotTrial
): TrialLogEnvelope =>
  trialLogConstructor({
    schemaVersion: SCHEMA_VERSION,
    producer: producerFromContext(ctx),
    lineage: new ArtifactLineage({
      sourceRef: TRIAL_SOURCE_REF,
      artifactId,
      emittedAt: DateTime.unsafeNow()
    }),
    relations: [RunRelation({ ref: ctx.runId })],
    trial
  })

const studySnapshotEnvelopeFromContext = (
  ctx: EnvelopeContextApi,
  artifactId: ArtifactId,
  snapshot: StudySnapshot
): StudySnapshotEnvelopeModel =>
  studySnapshotEnvelopeConstructor({
    schemaVersion: SCHEMA_VERSION,
    producer: producerFromContext(ctx),
    lineage: new ArtifactLineage({
      sourceRef: SNAPSHOT_SOURCE_REF,
      artifactId,
      emittedAt: DateTime.unsafeNow()
    }),
    relations: [RunRelation({ ref: ctx.runId })],
    snapshot
  })

/**
 * Wraps a single trial result from an optimization run.
 *
 * Contains the full {@link SnapshotTrialSchema} payload — parameter values,
 * objective measurements, and trial status — alongside provenance metadata.
 *
 * @see {@link ArtifactEnvelope} — parent union
 * @see {@link StudySnapshotEnvelope} — companion for full study snapshots
 *
 * @since 0.1.0
 * @category constructors
 */
export function TrialLog(
  fields: TrialLogFields
): TrialLogEnvelope {
  return trialLogConstructor(fields)
}

/**
 * Noun-owned projection helpers over TrialLog envelopes.
 *
 * @since 0.3.0
 * @category constructors
 */
export namespace TrialLog {
  /**
   * Projects a TrialLog envelope from already-resolved envelope context values.
   *
   * @since 0.3.0
   * @category constructors
   */
  export const fromContext = (
    ctx: EnvelopeContextApi,
    artifactId: ArtifactId,
    trial: SnapshotTrial
  ): TrialLogEnvelope => trialLogFromContext(ctx, artifactId, trial)

  /**
   * Resolves the current EnvelopeContext service and projects a TrialLog envelope.
   *
   * @since 0.3.0
   * @category constructors
   */
  export const fromEnvelopeContext = (
    trial: SnapshotTrial
  ): Effect.Effect<TrialLogEnvelope, never, EnvelopeContext> =>
    EnvelopeContext.pipe(
      Effect.flatMap((ctx) =>
        ctx.nextArtifactId.pipe(Effect.map((artifactId) => trialLogFromContext(ctx, artifactId, trial)))
      )
    )
}

/**
 * Wraps a point-in-time snapshot of an entire study.
 *
 * Captures the full {@link StudySnapshot} — all trials, search space state,
 * and study metadata — enabling study replay and comparison across runs.
 *
 * @see {@link ArtifactEnvelope} — parent union
 * @see {@link TrialLog} — companion for individual trial results
 *
 * @since 0.1.0
 * @category constructors
 */
export function StudySnapshotEnvelope(
  fields: StudySnapshotEnvelopeFields
): StudySnapshotEnvelopeModel {
  return studySnapshotEnvelopeConstructor(fields)
}

/**
 * Noun-owned projection helpers over StudySnapshot envelopes.
 *
 * @since 0.3.0
 * @category constructors
 */
export namespace StudySnapshotEnvelope {
  /**
   * Projects a StudySnapshot envelope from already-resolved envelope context values.
   *
   * @since 0.3.0
   * @category constructors
   */
  export const fromContext = (
    ctx: EnvelopeContextApi,
    artifactId: ArtifactId,
    snapshot: StudySnapshot
  ): StudySnapshotEnvelopeModel => studySnapshotEnvelopeFromContext(ctx, artifactId, snapshot)

  /**
   * Resolves the current EnvelopeContext service and projects a StudySnapshot envelope.
   *
   * @since 0.3.0
   * @category constructors
   */
  export const fromEnvelopeContext = (
    snapshot: StudySnapshot
  ): Effect.Effect<StudySnapshotEnvelopeModel, never, EnvelopeContext> =>
    EnvelopeContext.pipe(
      Effect.flatMap((ctx) =>
        ctx.nextArtifactId.pipe(Effect.map((artifactId) => studySnapshotEnvelopeFromContext(ctx, artifactId, snapshot)))
      )
    )
}

/**
 * Wraps a discrete study lifecycle event (started, paused, completed, failed).
 *
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
 * Type guard for narrowing a single envelope variant by tag.
 *
 * Returns a predicate that narrows {@link ArtifactEnvelope} to the
 * specified variant — useful in `Array.filter` and conditional branches
 * where exhaustive matching is unnecessary.
 *
 * @see {@link ArtifactEnvelope} — the union being narrowed
 * @see {@link matchEnvelope} — exhaustive alternative
 *
 * @since 0.1.0
 * @category guards
 */
export const isEnvelope = ArtifactEnvelopes.$is
