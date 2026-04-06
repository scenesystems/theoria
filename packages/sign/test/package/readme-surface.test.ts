import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import packageJson from "../../package.json" with { type: "json" }

import {
  batchVerify,
  BatchVerifyDetachedSignatureRequest,
  BatchVerifyReport,
  BatchVerifySignatureRequest,
  decapsulate,
  deriveSharedSecret,
  DetachedSignature,
  encapsulate,
  fromBase64Url,
  signDetached,
  toBase64Url,
  verifyDetached
} from "../../src/index.js"

const PackageManifestSchema = Schema.Struct({
  scripts: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String }))
})

const manifest = Schema.decodeUnknownSync(PackageManifestSchema)(packageJson)
const packageRootUrl = new URL("../../", import.meta.url)

describe("package/readme-surface", () => {
  it.effect("documents only the shipped signing, agreement, kem, codec, and detached portability surface", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const packageEntries = yield* fileSystem.readDirectory(root).pipe(Effect.orDie)
      const readme = yield* fileSystem.readFileString(path.join(root, "README.md")).pipe(Effect.orDie)

      expect(typeof signDetached).toBe("function")
      expect(typeof verifyDetached).toBe("function")
      expect(typeof batchVerify).toBe("function")
      expect(typeof deriveSharedSecret).toBe("function")
      expect(typeof encapsulate).toBe("function")
      expect(typeof decapsulate).toBe("function")
      expect(typeof toBase64Url).toBe("function")
      expect(typeof fromBase64Url).toBe("function")
      expect(DetachedSignature).toBeDefined()
      expect(BatchVerifySignatureRequest).toBeDefined()
      expect(BatchVerifyDetachedSignatureRequest).toBeDefined()
      expect(BatchVerifyReport).toBeDefined()

      expect(readme).toContain("### Signatures")
      expect(readme).toContain("### Key agreement")
      expect(readme).toContain("### Key encapsulation (KEM)")
      expect(readme).toContain("Detached signatures")
      expect(readme).toContain("Batch verification")
      expect(readme).toContain("signDetached")
      expect(readme).toContain("verifyDetached")
      expect(readme).toContain("batchVerify")
      expect(readme).toContain("toBase64Url")
      expect(readme).toContain("fromBase64Url")
      expect(readme).toContain("examples/04-detached-signature.ts")
      expect(readme).toContain("examples/05-batch-verify.ts")
      expect(readme).toContain("explicit-key verification")
      expect(readme).toContain("per-item outcomes")

      expect(manifest.scripts?.["release-snapshots:stamp"]).toBe("bun ../../scripts/stamp-release-snapshot.ts")
      expect(packageEntries).not.toContain("stamp-release-snapshot.ts")
    }).pipe(Effect.provide(BunContext.layer)))
})
