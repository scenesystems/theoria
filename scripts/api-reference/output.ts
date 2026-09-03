import { FileSystem, Path } from "@effect/platform"
import { Effect, Schema } from "effect"

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

export const sha256File = (filePath: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const bytes = yield* fileSystem.readFile(filePath).pipe(Effect.orDie)

    return yield* Effect.sync(() => new Bun.CryptoHasher("sha256").update(bytes).digest("hex"))
  })

const writeJson = <A>(
  outputRoot: string,
  relativeOutput: string,
  schema: Schema.Schema<A, string>,
  value: A
) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const absoluteOutput = path.join(outputRoot, relativeOutput)
    const temporaryOutput = `${absoluteOutput}.${crypto.randomUUID()}.tmp`
    const json = yield* Schema.encode(schema)(value).pipe(Effect.orDie)
    yield* fileSystem.makeDirectory(path.dirname(absoluteOutput), { recursive: true }).pipe(Effect.orDie)
    yield* fileSystem.writeFileString(temporaryOutput, `${json}\n`).pipe(Effect.orDie)
    yield* fileSystem.rename(temporaryOutput, absoluteOutput).pipe(Effect.orDie)
  })

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
