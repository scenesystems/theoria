import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import packageJson from "../../package.json" with { type: "json" }

import {
  aesgcmDecrypt,
  aesgcmEncrypt,
  aesgcmsivDecrypt,
  aesgcmsivEncrypt,
  DecryptionFailed,
  EnvelopeKeyMetadata,
  equalBytes,
  generateKey,
  InvalidAssociatedData,
  InvalidKey,
  seal,
  SealAlgorithm,
  SealedEnvelope,
  unseal,
  utf8FromBytes,
  utf8ToBytes,
  xchacha20Decrypt,
  xchacha20Encrypt
} from "../../src/index.js"

const PackageManifestSchema = Schema.Struct({
  scripts: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String }))
})

const manifest = Schema.decodeUnknownSync(PackageManifestSchema)(packageJson)
const packageRootUrl = new URL("../../", import.meta.url)

describe("package/readme-surface", () => {
  it.effect("documents only the shipped envelope, algorithm, aad, and error surfaces", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const packageEntries = yield* fileSystem.readDirectory(root).pipe(Effect.orDie)
      const readme = yield* fileSystem.readFileString(path.join(root, "README.md")).pipe(Effect.orDie)
      const metadataExample = yield* fileSystem
        .readFileString(path.join(root, "examples/03-envelope-metadata.ts"))
        .pipe(Effect.orDie)
      const aadExample = yield* fileSystem
        .readFileString(path.join(root, "examples/04-associated-data.ts"))
        .pipe(Effect.orDie)

      expect(typeof seal).toBe("function")
      expect(typeof unseal).toBe("function")
      expect(typeof xchacha20Encrypt).toBe("function")
      expect(typeof xchacha20Decrypt).toBe("function")
      expect(typeof aesgcmsivEncrypt).toBe("function")
      expect(typeof aesgcmsivDecrypt).toBe("function")
      expect(typeof aesgcmEncrypt).toBe("function")
      expect(typeof aesgcmDecrypt).toBe("function")
      expect(typeof generateKey).toBe("function")
      expect(typeof utf8ToBytes).toBe("function")
      expect(typeof utf8FromBytes).toBe("function")
      expect(typeof equalBytes).toBe("function")
      expect(SealAlgorithm).toBeDefined()
      expect(SealedEnvelope).toBeDefined()
      expect(EnvelopeKeyMetadata).toBeDefined()
      expect(InvalidKey).toBeDefined()
      expect(InvalidAssociatedData).toBeDefined()
      expect(DecryptionFailed).toBeDefined()

      expect(readme).toContain("Associated data (AAD)")
      expect(readme).toContain("Envelope key metadata")
      expect(readme).toContain("Runtime interoperability proof")
      expect(readme).toContain("seal(algorithm, key, plaintext, metadata?, associatedData?)")
      expect(readme).toContain("unseal(key, envelope, associatedData?)")
      expect(readme).toContain("xchacha20Encrypt(key, plaintext, associatedData?)")
      expect(readme).toContain("aesgcmsivEncrypt(key, plaintext, associatedData?)")
      expect(readme).toContain("aesgcmEncrypt(key, plaintext, associatedData?)")
      expect(readme).toContain("InvalidAssociatedData")
      expect(readme).toContain("transport-only envelope hints")
      expect(readme).toContain("authenticated but not encrypted")
      expect(readme).toContain("examples/01-encrypt-decrypt.ts")
      expect(readme).toContain("examples/02-algorithm-comparison.ts")
      expect(readme).toContain("examples/03-envelope-metadata.ts")
      expect(readme).toContain("examples/04-associated-data.ts")

      expect(metadataExample).toContain("BunRuntime.runMain(program)")
      expect(aadExample).toContain("BunRuntime.runMain(program)")

      expect(manifest.scripts?.["release-snapshots:stamp"]).toBe("bun ../../scripts/stamp-release-snapshot.ts")
      expect(packageEntries).not.toContain("stamp-release-snapshot.ts")
    }).pipe(Effect.provide(BunContext.layer)))
})
