/**
 * Shared output artifact persistence helpers for examples.
 *
 * Emits structured data (summary, events, module-state) as Custom artifact
 * envelopes through ArtifactSink. Markdown reports are written directly to
 * disk as derived presentation.
 */
import { FileSystem, Path } from "@effect/platform"
import * as DspArtifact from "@scenesystems/effect-dsp/Artifact"
import * as Artifact from "@scenesystems/effect-study/Artifact"
import * as ArtifactContext from "@scenesystems/effect-study/ArtifactContext"
import * as ArtifactSink from "@scenesystems/effect-study/ArtifactSink"
import { Array as Arr, Data, DateTime, Effect, Schema, String as Str } from "effect"
import type { Layer } from "effect"

export class ExampleArtifacts extends Data.Class<{
  readonly runId: string
  readonly rootDir: string
  readonly reportsDir: string
  readonly dataDir: string
  readonly storageDir: string
  readonly artifactContextLayer: Layer.Layer<ArtifactContext.ArtifactContext>
}> {}

const PACKAGE_VERSION = "0.1.0"
const DSP_DOMAIN = "dsp"
const EXAMPLE_COMPONENT: Artifact.ComponentPath = Arr.make("examples", "artifacts")

const artifactsBaseDirectory = (path: Path.Path): string => path.join("examples", "artifacts")

const normalizeSegment = (value: string): string =>
  Str.replace(/(^-+|-+$)/g, "")(
    Str.replace(/[^a-z0-9-]+/g, "-")(Str.toLowerCase(value))
  )

export const artifactDirectoryForExample = (exampleName: string): string =>
  `examples/artifacts/optimizers/${normalizeSegment(exampleName)}`

export const createExampleArtifacts = (exampleName: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const now = yield* DateTime.now
    const timestampMs = DateTime.toEpochMillis(now)
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

    const packageVersion = yield* Schema.decode(Artifact.PackageVersion)(PACKAGE_VERSION)
    const brandedRunId = yield* Schema.decode(Artifact.RunId)("01HZ0000000000000000000000")
    const artifactContextLayer = ArtifactContext.layer(
      new ArtifactContext.Options({
        packageVersion,
        runId: brandedRunId
      })
    )

    return {
      runId,
      rootDir,
      reportsDir,
      dataDir,
      storageDir,
      artifactContextLayer
    }
  })

const DSP_SOURCE: DspArtifact.Source = {
  origin: "effect-dsp",
  domain: DSP_DOMAIN,
  segments: Arr.make("examples", "artifacts")
}

export const emitCustomEnvelope = (options: {
  readonly optimizer: string
  readonly metricName: string
  readonly exampleName: string
  readonly payload: Artifact.Payload
}) =>
  Effect.gen(function*() {
    const context = yield* ArtifactContext.ArtifactContext
    const artifactId = yield* context.nextId
    const emittedAt = yield* DateTime.now

    yield* ArtifactSink.emit(
      DspArtifact.Envelope,
      DspArtifact.Custom({
        producer: DspArtifact.EffectDsp({
          packageVersion: context.packageVersion,
          component: EXAMPLE_COMPONENT,
          runId: context.runId,
          optimizer: options.optimizer,
          metricName: options.metricName,
          exampleName: options.exampleName
        }),
        lineage: {
          sourceRef: DSP_SOURCE,
          artifactId,
          emittedAt
        },
        payload: options.payload
      })
    )
  })

export const exampleArtifactSinkLayer = (directory: string) => ArtifactSink.layerFileSystem(directory)

export const noopArtifactSinkLayer = ArtifactSink.layer({ emit: () => Effect.void })
