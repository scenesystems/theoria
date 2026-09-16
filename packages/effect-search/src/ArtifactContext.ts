/**
 * Search artifact provenance and atomic identity allocation.
 *
 * @since 0.4.4
 * @module
 */
import * as StudyArtifact from "@scenesystems/effect-study/Artifact"
import { Data, Effect, Layer, Number as Num, Ref } from "effect"

/**
 * Construction options for an artifact context.
 *
 * @since 0.4.4
 * @category models
 */
export class Options extends Data.Class<{
  readonly packageVersion: StudyArtifact.PackageVersion
  readonly runId: StudyArtifact.RunId
  readonly studyId: string
}> {}

/**
 * Allocates artifact identities for one search run.
 *
 * @since 0.4.4
 * @category services
 */
export class ArtifactContext extends Effect.Tag("effect-search/ArtifactContext")<
  ArtifactContext,
  {
    readonly packageVersion: StudyArtifact.PackageVersion
    readonly runId: StudyArtifact.RunId
    readonly studyId: string
    readonly nextId: Effect.Effect<StudyArtifact.Id>
  }
>() {}

/**
 * Builds a context whose identity sequence starts at zero and allocates atomically.
 *
 * @since 0.4.4
 * @category layers
 */
export const layer = (options: Options): Layer.Layer<ArtifactContext> =>
  Layer.effect(
    ArtifactContext,
    Ref.make(0).pipe(
      Effect.map((sequence) => ({
        packageVersion: options.packageVersion,
        runId: options.runId,
        studyId: options.studyId,
        nextId: Ref.getAndUpdate(sequence, Num.increment).pipe(
          Effect.map((value) => new StudyArtifact.Id({ runId: options.runId, sequence: value }))
        )
      }))
    )
  )
