import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { resolveRootFrom } from "@theoria/source-proof"

const packageRootUrl = new URL("../../", import.meta.url)

describe("package/release-notes", () => {
  it.effect("keeps the changelog, pending release notes, and README aligned with the shipped AEAD, AAD, and envelope story", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* resolveRootFrom(packageRootUrl)
      const workspaceRoot = path.dirname(path.dirname(root))
      const readme = yield* fileSystem.readFileString(path.join(root, "README.md")).pipe(Effect.orDie)
      const changelog = yield* fileSystem.readFileString(path.join(root, "CHANGELOG.md")).pipe(Effect.orDie)
      const changeset = yield* fileSystem.readFileString(
        path.join(workspaceRoot, ".changeset/seal-envelope-metadata.md")
      ).pipe(Effect.orDie)

      expect(changelog).toContain("XChaCha20-Poly1305")
      expect(changelog).toContain("AES-256-GCM-SIV")
      expect(changelog).toContain("AES-256-GCM")
      expect(changelog).toContain("seal")
      expect(changelog).toContain("unseal")
      expect(changelog).toContain("SealedEnvelope")

      expect(changeset).toContain("keyId")
      expect(changeset).toContain("keyVersion")
      expect(changeset).toContain("backward-compatible unsealing")
      expect(changeset).toContain("README guidance")
      expect(changeset).toContain("key-rotation example coverage")

      expect(readme).toContain("Envelope key metadata")
      expect(readme).toContain("Associated data (AAD)")
      expect(readme).toContain("authenticated but not encrypted")
      expect(readme).toContain("it stays external")
      expect(readme).toContain("to the `SealedEnvelope`")
      expect(readme).toContain("transport-only envelope hints")
      expect(readme).toContain("not cryptographically authenticated")
      expect(readme).toContain("examples/03-envelope-metadata.ts")
      expect(readme).toContain("examples/04-associated-data.ts")
      expect(readme).toContain("Runtime interoperability proof")
      expect(readme).toContain("pinned raw `@noble/ciphers` fixtures")
      expect(readme).toContain("`unseal(...)` decrypts externally generated envelopes")
      expect(readme).toContain("`packEnvelope(...)` reconstructs the same released wire format")
    }).pipe(Effect.provide(BunContext.layer)))
})
