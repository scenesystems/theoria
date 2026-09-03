/**
 * Run metadata and artifact sequence allocation shared by envelope producers.
 *
 * @since 0.1.0
 */
import { Effect, Layer, Ref } from "effect"

import { ArtifactId, type PackageVersion, type RunId } from "./identity.js"

/**
 * Exposes declared study provenance and atomic artifact ID allocation for one Layer instance.
 *
 * @remarks
 * `nextArtifactId` starts at sequence zero and increments on every allocation. Concurrent
 * calls receive distinct sequence values, although consumer completion order may differ
 * from numeric order. The service does not persist its counter.
 *
 * @since 0.1.0
 * @category services
 */
export class EnvelopeContext extends Effect.Tag("effect-search/EnvelopeContext")<
  EnvelopeContext,
  {
    /** Declared version of the package producing envelopes. */
    readonly packageVersion: PackageVersion
    /** Execution identifier copied into each allocated artifact ID. */
    readonly runId: RunId
    /** Caller-defined study identity copied into envelope metadata. */
    readonly studyId: string
    /** Atomically allocates the next artifact sequence for this Layer instance. */
    readonly nextArtifactId: Effect.Effect<ArtifactId>
  }
>() {}

/**
 * Creates a shared in-memory artifact sequence for the supplied run metadata.
 *
 * @remarks
 * Building the Layer allocates a fresh counter at zero. The Layer has no requirements,
 * typed acquisition failures, or release action. `studyId` is retained without validation.
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
