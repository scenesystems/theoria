import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { loadPackageDocsCorpus, type PackageDocsBundle, resolveRootFrom } from "../src/index.js"

const repositoryRootUrl = new URL("../../../", import.meta.url)

const flattenedSourcePaths = (bundle: PackageDocsBundle): ReadonlyArray<string> => [
  bundle.manifestSource.path,
  bundle.readme.source.path,
  ...bundle.moduleDocs.map((document) => document.source.path),
  ...bundle.examples.map((example) => example.source.path),
  ...bundle.releaseSnapshots.map((snapshot) => snapshot.source.path),
  ...bundle.proofCommands.map((command) => command.source.path)
]

describe("package doc source boundary", () => {
  it.effect("reads package-owned files and generated package docs only", () =>
    Effect.gen(function*() {
      const repositoryRoot = yield* resolveRootFrom(repositoryRootUrl)
      const corpus = yield* loadPackageDocsCorpus({ repositoryRoot })

      yield* Effect.forEach(corpus.bundles, (bundle) =>
        Effect.sync(() => {
          expect(bundle.manifestSource.path).toBe(`${bundle.packageDirectory}/package.json`)
          expect(bundle.readme.source.path).toBe(`${bundle.packageDirectory}/README.md`)
          expect(
            bundle.moduleDocs.every((document) =>
              document.source.path.startsWith(`${bundle.packageDirectory}/docs/modules/`)
            )
          ).toBe(true)
          expect(
            bundle.examples.every((example) => example.source.path.startsWith(`${bundle.packageDirectory}/examples/`))
          ).toBe(true)
          expect(
            bundle.releaseSnapshots.every((snapshot) =>
              snapshot.source.path.startsWith(`${bundle.packageDirectory}/test/package/release-snapshots/`)
            )
          ).toBe(true)
          expect(
            bundle.proofCommands.every((command) => command.source.path === `${bundle.packageDirectory}/package.json`)
          ).toBe(true)
          expect(flattenedSourcePaths(bundle).some((path) => path.startsWith("apps/"))).toBe(false)
          expect(flattenedSourcePaths(bundle).some((path) => path.startsWith("docs/"))).toBe(false)
        }), { discard: true })
    }).pipe(Effect.provide(BunContext.layer)))
})
