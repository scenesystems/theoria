/**
 * Search artifact provenance, payloads, and envelopes.
 *
 * @since 0.4.4
 * @module
 */
import * as StudyArtifact from "@scenesystems/effect-study/Artifact"
import { Data, Schema } from "effect"

import * as Events from "./OptimizationEvent.js"
import * as Snapshots from "./OptimizationSnapshot.js"
import * as Trial from "./Trial.js"

/**
 * Search-owned source provenance composed from the open artifact source fields.
 *
 * @since 0.4.4
 * @category schemas
 */
export const Source = StudyArtifact.Source.pipe(
  Schema.omit("origin"),
  Schema.extend(Schema.Struct({ origin: Schema.Literal("effect-search", "external") }))
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

const envelopePayload = Schema.Union(
  Schema.TaggedStruct("TrialLog", { trial: Trial.Trial(Schema.Unknown) }),
  Schema.TaggedStruct("OptimizationSnapshot", { snapshot: Snapshots.OptimizationSnapshot }),
  Schema.TaggedStruct("OptimizationEvent", { event: Events.OptimizationEvent }),
  Schema.TaggedStruct("Custom", { payload: StudyArtifact.Payload })
)

/**
 * Search artifact envelope composed from shared artifact schemas.
 *
 * @since 0.4.4
 * @category schemas
 */
export const Envelope = StudyArtifact.Envelope(Producer, Lineage, envelopePayload)

/** Search artifact envelope decoded by {@link Envelope}. @since 0.4.4 @category models */
export type Envelope = typeof Envelope.Type

const envelopes = Data.taggedEnum<Envelope>()

/** Constructs a persisted trial envelope. @since 0.4.4 @category constructors */
export const TrialLog = envelopes.TrialLog
/** Constructs an optimization snapshot envelope. @since 0.4.4 @category constructors */
export const OptimizationSnapshot = envelopes.OptimizationSnapshot
/** Constructs an optimization event envelope. @since 0.4.4 @category constructors */
export const OptimizationEvent = envelopes.OptimizationEvent
/** Constructs a recursive custom payload envelope. @since 0.4.4 @category constructors */
export const Custom = envelopes.Custom
/** Narrows an envelope by payload tag. @since 0.4.4 @category guards */
export const is = envelopes.$is
/** Exhaustively matches an envelope payload. @since 0.4.4 @category pattern-matching */
export const match = envelopes.$match
