/**
 * Shared output artifact persistence helpers for examples.
 *
 * Emits structured data (summary, events, module-state) as Custom artifact
 * envelopes through ArtifactSink. Markdown reports are written directly to
 * disk as derived presentation.
 */
import { FileSystem, Path } from "@effect/platform"
import { Clock, DateTime, Effect, Layer, Schema } from "effect"
import {
  ArtifactLineage,
  type ArtifactPayload,
  ArtifactSink,
  type ComponentPath,
  Custom,
  emit,
  EnvelopeContext,
  EnvelopeContextLive,
  fileSystemSink,
  PackageVersion,
  RunId,
  SourceRef
} from "effect-search/Contracts"

export type ExampleArtifacts = Readonly<{
  readonly runId: string
  readonly rootDir: string
  readonly reportsDir: string
  readonly dataDir: string
  readonly storageDir: string
  readonly envelopeContextLayer: Layer.Layer<EnvelopeContext>
}>

const PACKAGE_VERSION = "0.2.0"
const DSP_DOMAIN = "dsp"
const EXAMPLE_COMPONENT: ComponentPath = ["examples", "artifacts"]

const artifactsBaseDirectory = (path: Path.Path): string => path.join("examples", "artifacts")

const normalizeSegment = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/g, "-")
    .replaceAll(/(^-+|-+$)/g, "")

export const artifactDirectoryForExample = (exampleName: string): string =>
  `examples/artifacts/optimizers/${normalizeSegment(exampleName)}`

export const createExampleArtifacts = (exampleName: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const timestampMs = yield* Clock.currentTimeMillis
    const runId = `${timestampMs}`
    const exampleSegment = normalizeSegment(exampleName)
    const rootDir = path.join(
      artifactsBaseDirectory(path),
      "optimizers",
      exampleSegment,
      runId
    )
    const reportsDir = path.join(rootDir, "reports")
    const dataDir = path.join(rootDir, "data")
    const storageDir = path.join(rootDir, "storage")

    yield* Effect.forEach(
      [rootDir, reportsDir, dataDir, storageDir],
      (directory) => fileSystem.makeDirectory(directory, { recursive: true }),
      { discard: true }
    )

    const packageVersion = yield* Schema.decode(PackageVersion)(PACKAGE_VERSION)
    const brandedRunId = yield* Schema.decode(RunId)("01HZ0000000000000000000000")
    const envelopeContextLayer = EnvelopeContextLive({
      packageVersion,
      runId: brandedRunId,
      studyId: exampleName
    })

    return {
      runId,
      rootDir,
      reportsDir,
      dataDir,
      storageDir,
      envelopeContextLayer
    }
  })

const DSP_SOURCE_REF = new SourceRef({
  origin: "effect-dsp",
  domain: DSP_DOMAIN,
  segments: ["examples", "artifacts"]
})

export const emitCustomEnvelope = (options: {
  readonly optimizer: string
  readonly metricName: string
  readonly exampleName: string
  readonly payload: ArtifactPayload
}) =>
  EnvelopeContext.pipe(
    Effect.flatMap((ctx) =>
      ctx.nextArtifactId.pipe(
        Effect.map((artifactId) =>
          Custom({
            schemaVersion: "artifact-envelope/v1",
            producer: {
              _tag: "EffectDsp",
              packageVersion: ctx.packageVersion,
              component: EXAMPLE_COMPONENT,
              runId: ctx.runId,
              optimizer: options.optimizer,
              metricName: options.metricName,
              exampleName: options.exampleName
            },
            lineage: new ArtifactLineage({
              sourceRef: DSP_SOURCE_REF,
              artifactId,
              emittedAt: DateTime.unsafeNow()
            }),
            payload: options.payload
          })
        )
      )
    ),
    Effect.flatMap(emit),
    Effect.catchAll(() => Effect.void)
  )

export const exampleArtifactSinkLayer = (directory: string) => fileSystemSink(directory)

export const noopArtifactSinkLayer = Layer.succeed(ArtifactSink, { emit: () => Effect.void })
