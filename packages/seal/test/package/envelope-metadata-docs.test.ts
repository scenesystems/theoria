import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

const packageRootUrl = new URL("../../", import.meta.url)

describe("package/envelope-metadata-docs", () => {
  it.effect("keeps the public envelope story explicit about transport-only key metadata", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const readme = yield* fileSystem.readFileString(path.join(root, "README.md")).pipe(Effect.orDie)

      expect(readme).toContain("keyId")
      expect(readme).toContain("keyVersion")
      expect(readme).toContain("transport-only")
      expect(readme).toContain("not cryptographically authenticated")
      expect(readme).toContain("examples/03-envelope-metadata.ts")
    }).pipe(Effect.provide(BunContext.layer)))
})
