import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Record } from "effect"

import { buildPackedManifestFixture, loadPublishReadinessManifest, resolveRootFrom } from "@theoria/source-proof"

const packageRootUrl = new URL("../../", import.meta.url)

describe("package/publish-contract", () => {
  it.effect("keeps the packed artifact limited to the intended root surface and root-governed release assets", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* resolveRootFrom(packageRootUrl)
      const rootManifest = yield* loadPublishReadinessManifest(path.join(root, "package.json"))
      const packedManifest = buildPackedManifestFixture(rootManifest)
      const readme = yield* fileSystem.readFileString(path.join(root, "README.md")).pipe(Effect.orDie)
      const rootExports = Option.getOrElse(Option.fromNullable(rootManifest.exports), () => ({}))
      const packedExports = Option.getOrElse(Option.fromNullable(packedManifest.exports), () => ({}))

      expect(Record.keys(rootExports)).toEqual(["."])
      expect(Record.keys(packedExports)).toEqual(["."])
      expect(rootManifest.exports?.["."]).toBe("./src/index.ts")
      expect(packedManifest.exports?.["."]).toEqual({
        types: "./dist/dts/index.d.ts",
        import: "./dist/esm/index.js",
        default: "./dist/cjs/index.js"
      })

      expect(rootManifest.scripts?.["release-snapshots:stamp"]).toBe("bun ../../scripts/stamp-release-snapshot.ts")
      expect(rootManifest.scripts?.docgen).toBe("docgen")
      expect(rootManifest.scripts?.["publish:check"]).toBeUndefined()
      expect(rootManifest.scripts?.["changeset-publish"]).toBeUndefined()

      expect(readme).toContain("@scenesystems/seal")
      expect(readme).toContain("`SealedEnvelope`")
      expect(readme).toContain("examples/03-envelope-metadata.ts")
      expect(readme).not.toContain("@scenesystems/seal/internal")
      expect(readme).not.toContain("stamp-release-snapshot.ts")
    }).pipe(Effect.provide(BunContext.layer)))
})
