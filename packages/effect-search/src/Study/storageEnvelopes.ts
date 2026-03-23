/**
 * Envelope construction for study storage — builds TrialLog and StudySnapshot envelopes.
 *
 * @since 0.1.0
 */
import { DateTime, Effect, Schema } from "effect"
import type * as Context from "effect/Context"

import {
  type ArtifactEnvelope,
  ArtifactEnvelopeSchema,
  type ArtifactEnvelopeVersion,
  StudySnapshotEnvelope,
  TrialLog
} from "../contracts/ArtifactEnvelope.js"
import { ArtifactLineage } from "../contracts/ArtifactLineage.js"
import { RunRelation } from "../contracts/ArtifactRelation.js"
import { EnvelopeContext } from "../contracts/EnvelopeContext.js"
import { type ArtifactId, type ComponentPath, SourceRef } from "../contracts/identity.js"
import type { SnapshotTrial } from "./snapshot/stateCodec.js"
import type { StudySnapshot } from "./snapshot/versioning.js"

/**
 * JSON-encoded schema for artifact envelopes used in JSONL storage files.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ArtifactEnvelopeJsonSchema = Schema.parseJson(ArtifactEnvelopeSchema)

const SCHEMA_VERSION: ArtifactEnvelopeVersion = "artifact-envelope/v1"

const STUDY_COMPONENT: ComponentPath = ["Study"]

const TRIAL_SOURCE_REF = new SourceRef({ origin: "effect-search", domain: "study", segments: ["trial"] })
const SNAPSHOT_SOURCE_REF = new SourceRef({ origin: "effect-search", domain: "study", segments: ["snapshot"] })

/**
 * Constructs a TrialLog artifact envelope with lineage metadata from the envelope context.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeTrialLogEnvelope = (trial: SnapshotTrial) =>
  EnvelopeContext.pipe(
    Effect.flatMap((ctx) =>
      ctx.nextArtifactId.pipe(
        Effect.map((artifactId) =>
          TrialLog({
            schemaVersion: SCHEMA_VERSION,
            producer: {
              _tag: "EffectSearch",
              packageVersion: ctx.packageVersion,
              component: STUDY_COMPONENT,
              runId: ctx.runId
            },
            lineage: new ArtifactLineage({
              sourceRef: TRIAL_SOURCE_REF,
              artifactId,
              emittedAt: DateTime.unsafeNow()
            }),
            relations: [RunRelation({ ref: ctx.runId })],
            trial
          })
        )
      )
    )
  )

/**
 * Constructs a StudySnapshot artifact envelope with lineage metadata from the envelope context.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeSnapshotEnvelope = (snapshot: StudySnapshot) =>
  EnvelopeContext.pipe(
    Effect.flatMap((ctx) =>
      ctx.nextArtifactId.pipe(
        Effect.map((artifactId) =>
          StudySnapshotEnvelope({
            schemaVersion: SCHEMA_VERSION,
            producer: {
              _tag: "EffectSearch",
              packageVersion: ctx.packageVersion,
              component: STUDY_COMPONENT,
              runId: ctx.runId
            },
            lineage: new ArtifactLineage({
              sourceRef: SNAPSHOT_SOURCE_REF,
              artifactId,
              emittedAt: DateTime.unsafeNow()
            }),
            relations: [RunRelation({ ref: ctx.runId })],
            snapshot
          })
        )
      )
    )
  )

type EnvelopeContextApi = Context.Tag.Service<typeof EnvelopeContext>

/**
 * Pure TrialLog envelope construction from pre-resolved context values.
 * Use when the `EnvelopeContext` has already been yielded in a generator.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeTrialLogEnvelopeFrom = (
  ctx: EnvelopeContextApi,
  artifactId: ArtifactId,
  trial: SnapshotTrial
): ArtifactEnvelope =>
  TrialLog({
    schemaVersion: SCHEMA_VERSION,
    producer: {
      _tag: "EffectSearch",
      packageVersion: ctx.packageVersion,
      component: STUDY_COMPONENT,
      runId: ctx.runId
    },
    lineage: new ArtifactLineage({
      sourceRef: TRIAL_SOURCE_REF,
      artifactId,
      emittedAt: DateTime.unsafeNow()
    }),
    relations: [RunRelation({ ref: ctx.runId })],
    trial
  })

/**
 * Pure StudySnapshot envelope construction from pre-resolved context values.
 * Use when the `EnvelopeContext` has already been yielded in a generator.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeSnapshotEnvelopeFrom = (
  ctx: EnvelopeContextApi,
  artifactId: ArtifactId,
  snapshot: StudySnapshot
): ArtifactEnvelope =>
  StudySnapshotEnvelope({
    schemaVersion: SCHEMA_VERSION,
    producer: {
      _tag: "EffectSearch",
      packageVersion: ctx.packageVersion,
      component: STUDY_COMPONENT,
      runId: ctx.runId
    },
    lineage: new ArtifactLineage({
      sourceRef: SNAPSHOT_SOURCE_REF,
      artifactId,
      emittedAt: DateTime.unsafeNow()
    }),
    relations: [RunRelation({ ref: ctx.runId })],
    snapshot
  })
