import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

const packageRootUrl = new URL("../../", import.meta.url)

describe("package/docgen-surface", () => {
  it.effect("keeps docgen aligned with the released signing, agreement, kem, portable codec, detached-signature, and verify-many surfaces", () =>
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
      const algorithmMatrixDoc = yield* fileSystem.readFileString(
        path.join(root, "docs/modules/algorithmMatrix.ts.md")
      ).pipe(Effect.orDie)
      const codecDoc = yield* fileSystem.readFileString(path.join(root, "docs/modules/codecs.ts.md")).pipe(
        Effect.orDie
      )
      const detachedDoc = yield* fileSystem.readFileString(
        path.join(root, "docs/modules/schemas/DetachedSignature.ts.md")
      ).pipe(Effect.orDie)
      const verifyManyDoc = yield* fileSystem.readFileString(
        path.join(root, "docs/modules/schemas/VerifyMany.ts.md")
      ).pipe(Effect.orDie)
      const portableDoc = yield* fileSystem.readFileString(
        path.join(root, "docs/modules/schemas/PortableArtifacts.ts.md")
      ).pipe(Effect.orDie)

      expect(indexDoc).toContain("agreement")
      expect(indexDoc).toContain("kem")
      expect(indexDoc).toContain("DetachedSignature")
      expect(indexDoc).toContain("./algorithmMatrix.js")

      expect(algorithmMatrixDoc).toContain("AlgorithmSupportMatrix")
      expect(algorithmMatrixDoc).toContain("SignatureSupportMatrix")

      expect(signDoc).toContain("signDetached")
      expect(signDoc).toContain("verifyDetached")
      expect(signDoc).toContain("verifyMany")

      expect(encodingDoc).toContain("toBase64Url")
      expect(encodingDoc).toContain("fromBase64Url")
      expect(codecDoc).toContain("encodeKeyPair")
      expect(codecDoc).toContain("decodeKeyPair")
      expect(codecDoc).toContain("encodeSharedSecret")
      expect(codecDoc).toContain("Added in v0.2.0")

      expect(detachedDoc).toContain("Portable detached digital signature")
      expect(detachedDoc).toContain("Added in v0.2.0")

      expect(verifyManyDoc).toContain("Aggregate report for ordered multi-item verification")
      expect(verifyManyDoc).toContain("VerifyManyReport")

      expect(portableDoc).toContain("PortableKeyPair")
      expect(portableDoc).toContain("PortableSharedSecret")
      expect(portableDoc).toContain("Added in v0.2.0")
    }).pipe(Effect.provide(BunContext.layer)))
})
