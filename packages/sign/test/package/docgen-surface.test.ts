import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

const packageRootUrl = new URL("../../", import.meta.url)

describe("package/docgen-surface", () => {
  it.effect("keeps docgen aligned with the released signing, agreement, kem, codec, detached-signature, and batch-verification surfaces", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const indexDoc = yield* fileSystem.readFileString(path.join(root, "docs/modules/index.ts.md")).pipe(
        Effect.orDie
      )
      const signDoc = yield* fileSystem.readFileString(path.join(root, "docs/modules/sign.ts.md")).pipe(
        Effect.orDie
      )
      const encodingDoc = yield* fileSystem.readFileString(path.join(root, "docs/modules/encoding.ts.md")).pipe(
        Effect.orDie
      )
      const detachedDoc = yield* fileSystem.readFileString(
        path.join(root, "docs/modules/schemas/DetachedSignature.ts.md")
      ).pipe(Effect.orDie)
      const batchDoc = yield* fileSystem.readFileString(
        path.join(root, "docs/modules/schemas/BatchVerification.ts.md")
      ).pipe(Effect.orDie)

      expect(indexDoc).toContain("agreement")
      expect(indexDoc).toContain("kem")
      expect(indexDoc).toContain("DetachedSignature")

      expect(signDoc).toContain("signDetached")
      expect(signDoc).toContain("verifyDetached")
      expect(signDoc).toContain("batchVerify")

      expect(encodingDoc).toContain("toBase64Url")
      expect(encodingDoc).toContain("fromBase64Url")

      expect(detachedDoc).toContain("Portable detached digital signature")
      expect(detachedDoc).toContain("Added in v0.2.0")

      expect(batchDoc).toContain("Aggregate batch-verification report")
      expect(batchDoc).toContain("Added in v0.2.0")
    }).pipe(Effect.provide(BunContext.layer)))
})
