import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Layer } from "effect"
import { Application } from "typedoc"

import { type DocsManifest, type DocsSearchIndex } from "@theoria/docs-model"
import { convertApiPackages } from "./convert-packages.js"
import { generateApiPackage } from "./generate-package.js"
import { makeApiDocLinks } from "./links.js"
import { type ApiReferenceManifest } from "./model.js"
import {
  generatedOutputsLayer,
  pruneStaleOutputs,
  writeApiManifest,
  writeApiSearchIndex,
  writeDocsManifest
} from "./output.js"
import { typeDocReflectionsLayer } from "./revive.js"
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
    const browserVersionRoot = path.join(input.browserOutputRoot, input.revision)
    // The committed `api-reference/` tree is fully regenerated. The browser root under `public/` is
    // written in place and pruned afterwards so a running Vite dev server
    // keeps serving it; see `GeneratedOutputs` in ./output.ts.
    yield* fileSystem.remove(input.outputRoot, { recursive: true, force: true })
    yield* Effect.forEach(
      [input.outputRoot, browserVersionRoot],
      (directory) => fileSystem.makeDirectory(directory, { recursive: true }),
      { discard: true }
    )

    // Each package is converted by a process of its own (see ./conversion.ts);
    // the serialized reflections are handed back through a temporary directory
    // that lives for the rest of the generation.
    const conversionRoot = yield* fileSystem.makeTempDirectoryScoped({ prefix: "theoria-api-reference-" })
    const convertedPackages = yield* convertApiPackages({ ...input, conversionRoot })
    const links = makeApiDocLinks(convertedPackages)
    const generatedPackages = yield* Effect.forEach(
      convertedPackages,
      (converted) => generateApiPackage({ ...input, browserVersionRoot, conversionRoot, links, converted })
    )
    const packages = Arr.map(generatedPackages, (generated) => generated.package)
    const manifest: ApiReferenceManifest = {
      schemaVersion: 3,
      typedocVersion: Application.VERSION,
      revision: input.revision,
      packages
    }
    const searchIndex: DocsSearchIndex = {
      schemaVersion: 1,
      entries: Arr.flatMap(generatedPackages, (generated) => generated.searchEntries)
    }
    const docsManifest: DocsManifest = {
      schemaVersion: 3,
      revision: input.revision,
      searchIndexAsset: `/docs-data/${input.revision}/search-index.json`,
      packages: Arr.map(generatedPackages, (generated) => generated.docsPackage)
    }
    yield* writeApiManifest(input.outputRoot, manifest)
    yield* writeApiSearchIndex(input.outputRoot, searchIndex)
    yield* writeApiSearchIndex(browserVersionRoot, searchIndex)
    yield* writeDocsManifest(input.browserOutputRoot, docsManifest)
    yield* pruneStaleOutputs(input.browserOutputRoot)

    return manifest
  }).pipe(
    Effect.scoped,
    Effect.provide(Layer.merge(generatedOutputsLayer, typeDocReflectionsLayer(input.repositoryRoot)))
  )
