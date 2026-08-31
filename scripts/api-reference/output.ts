import { FileSystem, Path } from "@effect/platform"
import { Effect, Schema } from "effect"

import {
  type ApiReferenceManifest,
  ApiReferenceManifestJson
} from "./model.js"
import {
  type ApiPage,
  ApiPageJson,
  type ApiSearchIndex,
  ApiSearchIndexJson
} from "./presentation-model.js"

export const sha256File = (filePath: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const bytes = yield* fileSystem.readFile(filePath).pipe(Effect.orDie)

    return yield* Effect.sync(() => new Bun.CryptoHasher("sha256").update(bytes).digest("hex"))
  })

export const writeApiPage = (outputRoot: string, relativeOutput: string, page: ApiPage) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const absoluteOutput = path.join(outputRoot, relativeOutput)
    const pageJson = yield* Schema.encode(ApiPageJson)(page).pipe(Effect.orDie)
    yield* fileSystem.makeDirectory(path.dirname(absoluteOutput), { recursive: true }).pipe(Effect.orDie)
    yield* fileSystem.writeFileString(absoluteOutput, `${pageJson}\n`).pipe(Effect.orDie)
  })

export const writeApiManifest = (outputRoot: string, manifest: ApiReferenceManifest) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const manifestJson = yield* Schema.encode(ApiReferenceManifestJson)(manifest).pipe(Effect.orDie)
    yield* fileSystem.writeFileString(path.join(outputRoot, "manifest.json"), `${manifestJson}\n`).pipe(Effect.orDie)
  })

export const writeApiSearchIndex = (outputRoot: string, index: ApiSearchIndex) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const indexJson = yield* Schema.encode(ApiSearchIndexJson)(index).pipe(Effect.orDie)
    yield* fileSystem.writeFileString(path.join(outputRoot, "search-index.json"), `${indexJson}\n`).pipe(Effect.orDie)
  })
