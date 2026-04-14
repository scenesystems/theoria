import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

const packageRootUrl = new URL("../../", import.meta.url)

describe("package/docgen-surface", () => {
  it.effect("keeps docgen aligned with the released envelope, algorithm, and error surfaces", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const indexDoc = yield* fileSystem.readFileString(path.join(root, "docs/modules/index.ts.md")).pipe(
        Effect.orDie
      )
      const sealDoc = yield* fileSystem.readFileString(path.join(root, "docs/modules/seal.ts.md")).pipe(
        Effect.orDie
      )
      const envelopeDoc = yield* fileSystem.readFileString(
        path.join(root, "docs/modules/schemas/SealedEnvelope.ts.md")
      ).pipe(Effect.orDie)
      const errorsDoc = yield* fileSystem.readFileString(path.join(root, "docs/modules/schemas/errors.ts.md")).pipe(
        Effect.orDie
      )
      const xchachaDoc = yield* fileSystem.readFileString(
        path.join(root, "docs/modules/algorithms/xchacha20.ts.md")
      ).pipe(Effect.orDie)
      const gcmsivDoc = yield* fileSystem.readFileString(
        path.join(root, "docs/modules/algorithms/aesgcmsiv.ts.md")
      ).pipe(Effect.orDie)
      const gcmDoc = yield* fileSystem.readFileString(path.join(root, "docs/modules/algorithms/aesgcm.ts.md")).pipe(
        Effect.orDie
      )

      expect(indexDoc).toContain("./seal.js")
      expect(indexDoc).toContain("./schemas/errors.js")
      expect(indexDoc).toContain("./schemas/SealedEnvelope.js")

      expect(sealDoc).toContain("metadata?: EnvelopeKeyMetadataType")
      expect(sealDoc).toContain("associatedData?: Uint8Array")
      expect(sealDoc).toContain("InvalidAssociatedData")

      expect(envelopeDoc).toContain("EnvelopeKeyMetadata")
      expect(envelopeDoc).toContain("encrypted or cryptographically authenticated by the envelope itself")
      expect(envelopeDoc).toContain("Added in v0.2.0")

      expect(errorsDoc).toContain("InvalidAssociatedData")
      expect(errorsDoc).toContain("Added in v0.2.0")

      expect(xchachaDoc).toContain("associatedData?: Uint8Array")
      expect(gcmsivDoc).toContain("associatedData?: Uint8Array")
      expect(gcmDoc).toContain("associatedData?: Uint8Array")
    }).pipe(Effect.provide(BunContext.layer)))
})
