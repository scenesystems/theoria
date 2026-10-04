import * as Digest from "@scenesystems/digest/Digest"
import {
  Array as Arr,
  Boolean as Bool,
  Context,
  Effect,
  FileSystem,
  HashSet,
  Layer,
  Match,
  Path,
  Ref,
  Schema
} from "effect"
import { Hex } from "effect/encoding"
import type { PlatformError } from "effect/PlatformError"

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
    const bytes = yield* fileSystem.readFile(filePath)

    return Hex.encode(yield* Digest.hash("sha256", bytes))
  })

/**
 * Absolute paths of every JSON file written during one generation run. Outputs
 * are written in place and stale files are pruned afterwards (see
 * {@link pruneStaleOutputs}) instead of clearing the output tree up front:
 * Vite's dev server tracks `public/` through a file watcher, and deleting a
 * watched directory that is immediately recreated loses the watch on the new
 * inode, so files written afterwards are never served until a restart.
 */
export class GeneratedOutputs extends Context.Service<
  GeneratedOutputs,
  Ref.Ref<HashSet.HashSet<string>>
>()("@theoria/scripts/api-reference/GeneratedOutputs") {}

export const generatedOutputsLayer = Layer.effect(GeneratedOutputs, Ref.make(HashSet.empty<string>()))

const writeJson = <A, R>(
  outputRoot: string,
  relativeOutput: string,
  schema: Schema.Codec<A, string, never, R>,
  value: A
) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const outputs = yield* GeneratedOutputs
    const absoluteOutput = path.join(outputRoot, relativeOutput)
    const outputDirectory = path.dirname(absoluteOutput)
    const json = yield* Schema.encodeEffect(schema)(value)
    yield* fileSystem.makeDirectory(outputDirectory, { recursive: true })
    // Written beside its destination so the final rename stays on one filesystem and is atomic.
    const temporaryOutput = yield* fileSystem.makeTempFileScoped({ directory: outputDirectory, prefix: ".writing-" })

    yield* fileSystem.writeFileString(temporaryOutput, `${json}\n`)
    yield* fileSystem.rename(temporaryOutput, absoluteOutput)
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
): Effect.Effect<boolean, PlatformError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const entries = yield* fileSystem.readDirectory(directory)
    const kept = yield* Effect.forEach(entries, (entry) =>
      Effect.gen(function*() {
        const absolute = path.join(directory, entry)
        const info = yield* fileSystem.stat(absolute)
        return yield* Match.value(info.type).pipe(
          Match.when("Directory", () =>
            Effect.gen(function*() {
              const empty = yield* pruneDirectory(absolute, keep)
              yield* (empty ? fileSystem.remove(absolute, { recursive: true }) : Effect.void)
              return Bool.not(empty)
            })),
          Match.orElse(() =>
            HashSet.has(keep, absolute)
              ? Effect.succeed(true)
              : fileSystem.remove(absolute).pipe(Effect.as(false))
          )
        )
      }))
    return Bool.not(Arr.some(kept, (value) => value))
  })

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
