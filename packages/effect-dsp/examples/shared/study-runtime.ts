/**
 * Reusable effect-search runtime composition for examples.
 */
import type * as ArtifactContext from "@scenesystems/effect-search/ArtifactContext"
import * as ArtifactSink from "@scenesystems/effect-search/ArtifactSink"
import * as ObjectiveCache from "@scenesystems/effect-search/ObjectiveCache"
import * as Progress from "@scenesystems/effect-search/Progress"
import type * as StudyEvent from "@scenesystems/effect-search/StudyEvent"
import * as StudyStorage from "@scenesystems/effect-search/StudyStorage"
import { Data, Effect, Layer, Option } from "effect"
import type { Stream } from "effect"

const DEFAULT_CACHE_PREFIX = "effect-dsp/examples"

export class StudyRuntimeOptions extends Data.Class<{
  readonly storageDirectory: string
  readonly artifactContextLayer: Layer.Layer<ArtifactContext.ArtifactContext>
  readonly cachePrefix?: string
}> {}

export class StudyProgressOptions extends Data.Class<{
  readonly sink?: Progress.Sink
}> {}

const resolveCachePrefix = (options: StudyRuntimeOptions): string =>
  Option.getOrElse(Option.fromNullable(options.cachePrefix), () => DEFAULT_CACHE_PREFIX)

export const studyCacheLayer = (cachePrefix: string = DEFAULT_CACHE_PREFIX) =>
  ObjectiveCache.layerMemory(new ObjectiveCache.Options({ scope: cachePrefix }))

export const studyStorageLayer = (directory: string) =>
  StudyStorage.layer(new StudyStorage.Options({ directory, fileName: "envelopes.jsonl" }))

export const noopArtifactSinkLayer = ArtifactSink.layer({ emit: () => Effect.void })

export const studyRuntimeLayer = (options: StudyRuntimeOptions) =>
  Layer.provideMerge(
    Layer.merge(
      studyStorageLayer(options.storageDirectory),
      studyCacheLayer(resolveCachePrefix(options))
    ),
    options.artifactContextLayer
  )

export const withStudyCache = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  cachePrefix: string = DEFAULT_CACHE_PREFIX
) =>
  effect.pipe(
    Effect.provide(studyCacheLayer(cachePrefix))
  )

export const withStudyRuntime = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  options: StudyRuntimeOptions
) =>
  effect.pipe(
    Effect.provide(studyRuntimeLayer(options).pipe(Layer.provideMerge(noopArtifactSinkLayer)))
  )

export const withStudyProgress = <E, R>(
  stream: Stream.Stream<StudyEvent.Event, E, R>,
  options: StudyProgressOptions = {}
) =>
  stream.pipe(
    Progress.tap(Option.getOrElse(Option.fromNullable(options.sink), () => Progress.defaultSink))
  )
