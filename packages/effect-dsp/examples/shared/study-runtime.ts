/**
 * Reusable effect-search runtime composition for examples.
 */
import { Effect, Layer, Option } from "effect"
import type { Stream } from "effect"
import { Contracts, Study } from "effect-search"
import type * as StudyEvent from "effect-search/StudyEvent"

const DEFAULT_CACHE_PREFIX = "effect-dsp/examples"

export type StudyRuntimeOptions = Readonly<{
  readonly storageDirectory: string
  readonly envelopeContextLayer: Layer.Layer<Contracts.EnvelopeContext>
  readonly cachePrefix?: string
}>

export type StudyProgressOptions = Readonly<{
  readonly sink?: Study.TerminalSink
}>

const resolveCachePrefix = (options: StudyRuntimeOptions): string =>
  Option.getOrElse(Option.fromNullable(options.cachePrefix), () => DEFAULT_CACHE_PREFIX)

export const studyCacheLayer = (cachePrefix: string = DEFAULT_CACHE_PREFIX) =>
  Study.StudyObjectiveCacheMemory(Study.studyObjectiveCacheOptions(cachePrefix))

export const studyStorageLayer = (directory: string) => Study.StudyStorageLive(Study.studyStorageOptions(directory))

export const noopArtifactSinkLayer = Layer.succeed(Contracts.ArtifactSink, { emit: () => Effect.void })

export const studyRuntimeLayer = (options: StudyRuntimeOptions) =>
  Layer.provideMerge(
    Layer.merge(
      studyStorageLayer(options.storageDirectory),
      studyCacheLayer(resolveCachePrefix(options))
    ),
    options.envelopeContextLayer
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
    Effect.provide(studyRuntimeLayer(options)),
    Effect.provide(noopArtifactSinkLayer)
  )

const progressOptions = (options: StudyProgressOptions) =>
  Option.match(Option.fromNullable(options.sink), {
    onNone: () => undefined,
    onSome: (sink) => ({ sink })
  })

export const withStudyProgress = <E, R>(
  stream: Stream.Stream<StudyEvent.StudyEvent, E, R>,
  options: StudyProgressOptions = {}
) =>
  stream.pipe(
    Study.tapTerminalProgress(progressOptions(options))
  )
