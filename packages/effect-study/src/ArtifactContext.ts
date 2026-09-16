/**
 * Run-scoped artifact provenance and atomic identity allocation.
 *
 * @since 0.1.0
 * @module
 */
import { Data, Effect, Layer, Number as Num, Ref } from "effect"
import type * as Context from "effect/Context"

import * as Artifact from "./Artifact.js"

/**
 * Run provenance used by an artifact producer.
 *
 * @since 0.1.0
 * @category models
 */
export class Options extends Data.Class<{
  readonly packageVersion: Artifact.PackageVersion
  readonly runId: Artifact.RunId
}> {}

/**
 * Allocates monotonic artifact identities for one run.
 *
 * @since 0.1.0
 * @category services
 */
export class ArtifactContext extends Effect.Tag("effect-study/ArtifactContext")<
  ArtifactContext,
  {
    readonly packageVersion: Artifact.PackageVersion
    readonly runId: Artifact.RunId
    readonly nextId: Effect.Effect<Artifact.Id>
  }
>() {}

/**
 * Builds an artifact context whose sequence begins at zero and is allocated atomically.
 *
 * @since 0.1.0
 * @category constructors
 */
export const make = (options: Options): Effect.Effect<Context.Tag.Service<typeof ArtifactContext>> =>
  Ref.make(0).pipe(
    Effect.map((sequence) => ({
      packageVersion: options.packageVersion,
      runId: options.runId,
      nextId: Ref.getAndUpdate(sequence, Num.increment).pipe(
        Effect.map((value) => new Artifact.Id({ runId: options.runId, sequence: value }))
      )
    }))
  )

/**
 * Provides a fresh artifact context for one run.
 *
 * @since 0.1.0
 * @category layers
 */
export const layer = (options: Options): Layer.Layer<ArtifactContext> => Layer.effect(ArtifactContext, make(options))
