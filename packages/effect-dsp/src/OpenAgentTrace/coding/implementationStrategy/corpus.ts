/**
 * Package-owned checked-in Amp corpus for the implementation-strategy surface.
 *
 * @since 0.2.0
 */
import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Option, Schema } from "effect"

import { normalizeCapture } from "../../adapter.js"
import {
  loadPluginAdapterCapture,
  loadStreamJsonAdapterCapture,
  pluginAdapter,
  streamJsonAdapter
} from "../../amp/index.js"
import { importDataset } from "./importer.js"
import { CaseLabel, CorpusManifest } from "./importerSchema.js"

const decodeUnknownJson = Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))
const moduleDirectoryUrl = new URL(".", import.meta.url)
const corpusRootSegments = Arr.make("fixtures", "open-agent-trace", "amp", "implementationStrategy")
const ampFixtureRootSegments = Arr.make("fixtures", "open-agent-trace", "amp")
const manifestFileName = "manifest.json"

/**
 * Canonical dataset identifier for the checked-in Amp implementation-strategy corpus.
 *
 * @since 0.2.0
 * @category constants
 */
export const datasetId = "amp-implementation-strategy"

/**
 * Typed read failure for the checked-in Amp implementation-strategy corpus.
 *
 * @since 0.2.0
 */
export class CorpusReadError extends Schema.TaggedError<CorpusReadError>()(
  "ImplementationStrategy/CorpusReadError",
  { path: Schema.String, message: Schema.String }
) {}

/**
 * Typed decode failure for the checked-in Amp implementation-strategy corpus.
 *
 * @since 0.2.0
 */
export class CorpusDecodeError extends Schema.TaggedError<CorpusDecodeError>()(
  "ImplementationStrategy/CorpusDecodeError",
  { path: Schema.String, message: Schema.String }
) {}

const joinSegments = (path: Path.Path, directory: string, segments: ReadonlyArray<string>): string =>
  Arr.reduce(segments, directory, (current, segment) => path.join(current, segment))

const rootExists = (options: {
  readonly candidate: string
  readonly label: string
  readonly requiredChildren: ReadonlyArray<string>
}): Effect.Effect<boolean, CorpusReadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const childExistence = yield* Effect.forEach(
      options.requiredChildren,
      (child) =>
        fileSystem.exists(path.join(options.candidate, child)).pipe(
          Effect.mapError(() =>
            new CorpusReadError({
              path: options.candidate,
              message: `failed to resolve ${options.label}`
            })
          )
        ),
      { concurrency: 1 }
    )

    return Arr.every(childExistence, Boolean)
  })

const resolveRoot = (
  directory: string,
  segments: ReadonlyArray<string>,
  label: string,
  requiredChildren: ReadonlyArray<string>
): Effect.Effect<string, CorpusReadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const candidate = joinSegments(path, directory, segments)
    const exists = yield* rootExists({ candidate, label, requiredChildren })

    if (exists) {
      return candidate
    }

    const parent = path.dirname(directory)

    return parent === directory
      ? yield* Effect.fail(
        new CorpusReadError({ path: candidate, message: `failed to resolve ${label}` })
      )
      : yield* resolveRoot(parent, segments, label, requiredChildren)
  })

const readFileString = (
  filePath: string
): Effect.Effect<string, CorpusReadError, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem

    return yield* fileSystem.readFileString(filePath).pipe(
      Effect.mapError(() =>
        new CorpusReadError({
          path: filePath,
          message: "failed to read implementation-strategy corpus file"
        })
      )
    )
  })

const readJsonFile = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  filePath: string
): Effect.Effect<
  A,
  CorpusReadError | CorpusDecodeError,
  FileSystem.FileSystem | R
> =>
  Effect.gen(function*() {
    const raw = yield* readFileString(filePath)
    const decoded = yield* decodeUnknownJson(raw).pipe(
      Effect.mapError(() =>
        new CorpusDecodeError({
          path: filePath,
          message: "failed to parse implementation-strategy corpus json"
        })
      )
    )

    return yield* Schema.decodeUnknown(schema)(decoded).pipe(
      Effect.mapError(() =>
        new CorpusDecodeError({
          path: filePath,
          message: "failed to decode implementation-strategy corpus file"
        })
      )
    )
  })

const loadNormalizedRecord = (ampFixtureRoot: string, label: CaseLabel) => {
  if (label.captureLane === "plugin") {
    return Effect.flatMap(
      loadPluginAdapterCapture(ampFixtureRoot, label.threadId),
      (capture) => normalizeCapture(pluginAdapter, capture).pipe(Effect.map((normalized) => normalized.record))
    )
  }

  return Effect.flatMap(
    loadStreamJsonAdapterCapture(ampFixtureRoot, label.threadId),
    (capture) => normalizeCapture(streamJsonAdapter, capture).pipe(Effect.map((normalized) => normalized.record))
  )
}

const loadCorpusSources = (corpusRoot: string, ampFixtureRoot: string, caseFiles: ReadonlyArray<string>) =>
  Effect.gen(function*() {
    const path = yield* Path.Path

    return yield* Effect.forEach(
      caseFiles,
      (caseFile) =>
        Effect.gen(function*() {
          const filePath = path.join(corpusRoot, caseFile)
          const label = yield* readJsonFile(CaseLabel, filePath)
          const record = yield* loadNormalizedRecord(ampFixtureRoot, label)

          return { label, record }
        }),
      { concurrency: 1 }
    )
  })

/**
 * Load the checked-in Amp implementation-strategy corpus through the deterministic importer.
 *
 * @since 0.2.0
 * @category constructors
 */
export const loadDataset = () =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const moduleDirectory = yield* path.fromFileUrl(moduleDirectoryUrl).pipe(
      Effect.mapError(() =>
        new CorpusReadError({
          path: moduleDirectoryUrl.href,
          message: "failed to resolve implementation-strategy corpus module directory"
        })
      )
    )
    const corpusRoot = yield* resolveRoot(
      moduleDirectory,
      corpusRootSegments,
      "implementation-strategy corpus root",
      Arr.make(manifestFileName)
    )
    const ampFixtureRoot = yield* resolveRoot(
      moduleDirectory,
      ampFixtureRootSegments,
      "Amp fixture root",
      Arr.make("raw", "derived")
    )
    const manifestPath = path.join(corpusRoot, manifestFileName)
    const manifest = yield* readJsonFile(CorpusManifest, manifestPath)
    const sources = yield* loadCorpusSources(corpusRoot, ampFixtureRoot, manifest.caseFiles)

    return yield* Option.fromNullable(sources[0]).pipe(
      Option.match({
        onNone: () =>
          Effect.fail(
            new CorpusDecodeError({
              path: manifestPath,
              message: "implementation-strategy corpus manifest produced no cases"
            })
          ),
        onSome: (firstSource) =>
          importDataset({
            datasetId: manifest.datasetId,
            sources: [firstSource, ...sources.slice(1)]
          })
      })
    )
  })
