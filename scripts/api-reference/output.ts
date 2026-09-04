import { FileSystem, Path } from "@effect/platform"
import { digestBytesHex } from "@scenesystems/digest"
import { Array as Arr, Context, Effect, HashSet, Layer, Ref, Schema } from "effect"

import {
  type ApiPage,
  ApiPageJson,
  type DocsApiExportPage,
  DocsApiExportPageJson,
  type DocsApiModuleIndex,
  DocsApiModuleIndexJson,
  type DocsManifest,
  DocsManifestJson,
  type DocsSearchIndex,
  DocsSearchIndexJson,
  type GuidePage,
  GuidePageJson
} from "@theoria/docs-model"
import { type ApiReferenceManifest, ApiReferenceManifestJson } from "./model.js"
import { type TypeDocProjectJson, TypeDocProjectJsonText } from "./typedoc-json.js"

export const sha256File = (filePath: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const bytes = yield* fileSystem.readFile(filePath).pipe(Effect.orDie)

    return yield* digestBytesHex("sha256", bytes)
  })

/**
 * Absolute paths of every JSON file written during one generation run. Outputs
 * are written in place and stale files are pruned afterwards (see
 * {@link pruneStaleOutputs}) instead of clearing the output tree up front:
 * Vite's dev server tracks `public/` through a file watcher, and deleting a
 * watched directory that is immediately recreated loses the watch on the new
 * inode, so files written afterwards are never served until a restart.
 */
export class GeneratedOutputs extends Context.Tag("@theoria/api-reference/GeneratedOutputs")<
  GeneratedOutputs,
  Ref.Ref<HashSet.HashSet<string>>
>() {}

export const generatedOutputsLayer = Layer.effect(GeneratedOutputs, Ref.make(HashSet.empty<string>()))

const writeJson = <A>(
  outputRoot: string,
  relativeOutput: string,
  schema: Schema.Schema<A, string>,
  value: A
) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const outputs = yield* GeneratedOutputs
    const absoluteOutput = path.join(outputRoot, relativeOutput)
    const outputDirectory = path.dirname(absoluteOutput)
    const json = yield* Schema.encode(schema)(value).pipe(Effect.orDie)
    yield* fileSystem.makeDirectory(outputDirectory, { recursive: true }).pipe(Effect.orDie)
    // Written beside its destination so the final rename stays on one filesystem and is atomic.
    const temporaryOutput = yield* fileSystem.makeTempFileScoped({ directory: outputDirectory, prefix: ".writing-" })
      .pipe(Effect.orDie)
    yield* fileSystem.writeFileString(temporaryOutput, `${json}\n`).pipe(Effect.orDie)
    yield* fileSystem.rename(temporaryOutput, absoluteOutput).pipe(Effect.orDie)
    yield* Ref.update(outputs, HashSet.add(absoluteOutput))
  }).pipe(Effect.scoped)

/**
 * Removes every file under `root` that this run did not write, then removes
 * directories left empty. Returns whether `root` itself is now empty. Deleting
 * only after the new files exist keeps a running dev server consistent: it sees
 * either the previous tree or the new one, never a half-written one.
 */
const pruneDirectory = (
  directory: string,
  keep: HashSet.HashSet<string>
): Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const entries = yield* fileSystem.readDirectory(directory)
    const kept = yield* Effect.forEach(entries, (entry) =>
      Effect.gen(function*() {
        const absolute = path.join(directory, entry)
        const info = yield* fileSystem.stat(absolute)
        if (info.type === "Directory") {
          const empty = yield* pruneDirectory(absolute, keep)
          if (empty) yield* fileSystem.remove(absolute, { recursive: true })
          return !empty
        }
        if (HashSet.has(keep, absolute)) return true
        yield* fileSystem.remove(absolute)
        return false
      }))
    return !Arr.some(kept, (value) => value)
  }).pipe(Effect.orDie)

export const pruneStaleOutputs = (root: string) =>
  Effect.gen(function*() {
    const outputs = yield* GeneratedOutputs
    const written = yield* Ref.get(outputs)
    yield* pruneDirectory(root, written)
  })

export const writeReflection = (outputRoot: string, relativeOutput: string, project: TypeDocProjectJson) =>
  writeJson(outputRoot, relativeOutput, TypeDocProjectJsonText, project)

export const writeApiPage = (outputRoot: string, relativeOutput: string, page: ApiPage) =>
  writeJson(outputRoot, relativeOutput, ApiPageJson, page)

export const writeDocsApiModuleIndex = (
  outputRoot: string,
  relativeOutput: string,
  page: DocsApiModuleIndex
) => writeJson(outputRoot, relativeOutput, DocsApiModuleIndexJson, page)

export const writeDocsApiExportPage = (
  outputRoot: string,
  relativeOutput: string,
  page: DocsApiExportPage
) => writeJson(outputRoot, relativeOutput, DocsApiExportPageJson, page)

export const writeApiManifest = (outputRoot: string, manifest: ApiReferenceManifest) =>
  writeJson(outputRoot, "manifest.json", ApiReferenceManifestJson, manifest)

export const writeApiSearchIndex = (outputRoot: string, index: DocsSearchIndex) =>
  writeJson(outputRoot, "search-index.json", DocsSearchIndexJson, index)

export const writeGuidePage = (outputRoot: string, relativeOutput: string, page: GuidePage) =>
  writeJson(outputRoot, relativeOutput, GuidePageJson, page)

export const writeDocsManifest = (outputRoot: string, manifest: DocsManifest) =>
  writeJson(outputRoot, "manifest.json", DocsManifestJson, manifest)
