/**
 * Envelope context — scoped capability for stamping provenance metadata onto artifacts.
 *
 * @since 0.1.0
 */
import { Effect, Layer, Ref } from "effect"

import { ArtifactId, type PackageVersion, type RunId } from "./identity.js"

/**
 * Scoped capability for constructing artifact envelopes within a study run.
 * Carries the provenance fields (package version, run, study) and exposes
 * a monotonic {@link nextArtifactId} that mints unique identifiers.
 *
 * Provide via {@link EnvelopeContextLive} — the `Ref` for sequencing is
 * internal to the layer and never exposed to consumers.
 *
 * @see {@link ArtifactEnvelope} — the envelope type stamped with this context
 * @see {@link ArtifactId} — identifier produced by `nextArtifactId`
 * @see {@link EnvelopeContextLive} — layer constructor
 *
 * @since 0.1.0
 * @category services
 */
export class EnvelopeContext extends Effect.Tag("effect-search/EnvelopeContext")<
  EnvelopeContext,
  {
    readonly packageVersion: PackageVersion
    readonly runId: RunId
    readonly studyId: string
    readonly nextArtifactId: Effect.Effect<ArtifactId>
  }
>() {}

/**
 * Construct an {@link EnvelopeContext} layer for a single study run.
 * The monotonic sequence counter is created internally — consumers
 * interact only through the `nextArtifactId` effect.
 *
 * @see {@link EnvelopeContext} — the service this layer provides
 * @see {@link ArtifactId} — the identifier minted by `nextArtifactId`
 *
 * @since 0.1.0
 * @category layers
 */
export const EnvelopeContextLive = (args: {
  readonly packageVersion: PackageVersion
  readonly runId: RunId
  readonly studyId: string
}): Layer.Layer<EnvelopeContext> =>
  Layer.effect(
    EnvelopeContext,
    Ref.make(0).pipe(
      Effect.map((sequenceRef) => ({
        packageVersion: args.packageVersion,
        runId: args.runId,
        studyId: args.studyId,
        nextArtifactId: Ref.getAndUpdate(sequenceRef, (n) => n + 1).pipe(
          Effect.map((sequence) => new ArtifactId({ runId: args.runId, sequence }))
        )
      }))
    )
  )
