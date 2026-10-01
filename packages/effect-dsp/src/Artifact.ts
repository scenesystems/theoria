/**
 * DSP artifact provenance and custom payload envelopes.
 *
 * @since 0.4.0
 * @module
 */
import * as StudyArtifact from "@scenesystems/effect-study/Artifact"
import { Data, Schema } from "effect"

/** DSP-owned artifact source provenance. @since 0.4.0 @category schemas */
export const Source = StudyArtifact.Source.pipe(
  Schema.omit("origin"),
  Schema.extend(Schema.Struct({ origin: Schema.Literal("effect-dsp") })),
  Schema.annotations({ identifier: "@scenesystems/effect-dsp/Artifact/Source" })
)

/** DSP-owned artifact source provenance. @since 0.4.0 @category models */
export type Source = typeof Source.Type

/** Metadata identifying the DSP operation that produced an artifact. @since 0.4.0 @category schemas */
export const Producer = Schema.TaggedStruct("EffectDsp", {
  packageVersion: StudyArtifact.PackageVersion,
  component: StudyArtifact.ComponentPath,
  runId: StudyArtifact.RunId,
  optimizer: Schema.String,
  metricName: Schema.String,
  exampleName: Schema.String
}).annotations({ identifier: "@scenesystems/effect-dsp/Artifact/Producer" })

/** DSP artifact producer metadata. @since 0.4.0 @category models */
export type Producer = typeof Producer.Type

/** Constructs DSP artifact producer metadata. @since 0.4.0 @category constructors */
export const EffectDsp = Data.tagged<Producer>("EffectDsp")

/** DSP artifact lineage. @since 0.4.0 @category schemas */
export const Lineage = StudyArtifact.Lineage(Source).annotations({
  identifier: "@scenesystems/effect-dsp/Artifact/Lineage"
})

/** DSP artifact lineage. @since 0.4.0 @category models */
export type Lineage = typeof Lineage.Type

/** Versionless DSP custom artifact envelope. @since 0.4.0 @category schemas */
export const Envelope = StudyArtifact.Envelope(
  Producer,
  Lineage,
  Schema.TaggedStruct("Custom", { payload: StudyArtifact.Payload })
).annotations({ identifier: "@scenesystems/effect-dsp/Artifact/Envelope" })

/** A DSP custom artifact envelope. @since 0.4.0 @category models */
export type Envelope = typeof Envelope.Type

const artifacts = Data.taggedEnum<Envelope>()

/** Constructs a DSP custom artifact envelope. @since 0.4.0 @category constructors */
export const Custom = artifacts.Custom

/** Narrows a DSP artifact by payload tag. @since 0.4.0 @category guards */
export const is = artifacts.$is

/** Exhaustively matches DSP artifact payloads. @since 0.4.0 @category pattern-matching */
export const match = artifacts.$match
