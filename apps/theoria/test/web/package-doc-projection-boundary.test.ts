import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { moduleSpecifiers, parseTypeScript, resolveRootFrom } from "@theoria/source-proof"
import { Effect } from "effect"

const repositoryRootUrl = new URL("../../../../", import.meta.url)

const projectionFiles: ReadonlyArray<string> = [
  "apps/theoria/app/contracts/presentation/package-docs.ts",
  "apps/theoria/app/server/routes/package-docs.ts",
  "apps/theoria/app/web/services/PackageDocsClient.ts",
  "apps/theoria/app/web/atoms/package-docs.ts",
  "apps/theoria/app/web/view/packageDocsModel.ts"
]

const forbiddenFragments: ReadonlyArray<string> = [
  ".md",
  "/docs/modules/",
  "/examples/",
  "/test/package/release-snapshots/",
  "../../../../packages/",
  "../../../../../packages/",
  "../../../../../../packages/"
]

describe("web/package-doc-projection-boundary", () => {
  it.effect("keeps projection files free of direct README, docgen, example, or release-snapshot imports so drift surfaces through root corpus contracts", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const repositoryRoot = yield* resolveRootFrom(repositoryRootUrl)

      yield* Effect.forEach(projectionFiles, (relativePath) =>
        Effect.gen(function*() {
          const source = yield* fileSystem.readFileString(path.join(repositoryRoot, relativePath)).pipe(Effect.orDie)
          const parsed = parseTypeScript(relativePath, source)
          const imports = moduleSpecifiers(parsed)

          expect(
            imports.some((specifier) => forbiddenFragments.some((fragment) => specifier.includes(fragment)))
          ).toBe(false)
        }), { discard: true })
    }).pipe(Effect.provide(BunContext.layer)))
})
