import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect } from "effect"
import { Application } from "typedoc"

import {
  type DocsManifest,
  type DocsSearchIndex
} from "@theoria/docs-model"
import { generateApiPackage } from "./generate-package.js"
import { makeApiDocLinks } from "./links.js"
import { type ApiReferenceManifest } from "./model.js"
import {
  writeApiManifest,
  writeApiSearchIndex,
  writeDocsManifest
} from "./output.js"
import { type ApiSourcePackage } from "./source.js"

export const generateApiReference = (input: {
  readonly browserOutputRoot: string
  readonly repositoryRoot: string
  readonly outputRoot: string
  readonly revision: string
  readonly sourcePackages: ReadonlyArray<ApiSourcePackage>
}) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const links = makeApiDocLinks(input.sourcePackages)
    const browserVersionRoot = path.join(input.browserOutputRoot, input.revision)
    yield* Effect.forEach(
      [input.outputRoot, input.browserOutputRoot],
      (directory) => fileSystem.remove(directory, { recursive: true, force: true }).pipe(Effect.orDie),
      { discard: true }
    )
    yield* Effect.forEach(
      [input.outputRoot, browserVersionRoot],
      (directory) => fileSystem.makeDirectory(directory, { recursive: true }).pipe(Effect.orDie),
      { discard: true }
    )

    const generatedPackages = yield* Effect.forEach(
      input.sourcePackages,
      (sourcePackage) => generateApiPackage({ ...input, browserVersionRoot, links, sourcePackage }),
      { concurrency: 1 }
    )
    const packages = Arr.map(generatedPackages, (generated) => generated.package)
    const manifest: ApiReferenceManifest = {
      schemaVersion: 2,
      typedocVersion: Application.VERSION,
      revision: input.revision,
      packages
    }
    const searchIndex: DocsSearchIndex = {
      schemaVersion: 1,
      entries: Arr.flatMap(generatedPackages, (generated) => generated.searchEntries)
    }
    const docsManifest: DocsManifest = {
      schemaVersion: 1,
      revision: input.revision,
      searchIndexAsset: `/docs-data/${input.revision}/search-index.json`,
      packages: Arr.map(generatedPackages, (generated) => generated.docsPackage)
    }
    yield* writeApiManifest(input.outputRoot, manifest)
    yield* writeApiSearchIndex(input.outputRoot, searchIndex)
    yield* writeApiSearchIndex(browserVersionRoot, searchIndex)
    yield* writeDocsManifest(input.browserOutputRoot, docsManifest)

    return manifest
  })
