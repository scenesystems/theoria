import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import packageJson from "../../package.json" with { type: "json" }

import {
  AgreementSupportMatrix,
  AlgorithmSupportMatrix,
  decapsulate,
  decodeKeyPair,
  decodeSharedSecret,
  decodeSignature,
  deriveSharedSecret,
  DetachedSignature,
  encapsulate,
  encodeKeyPair,
  encodeSharedSecret,
  encodeSignature,
  fromBase64Url,
  PortableKeyPair,
  PortableSharedSecret,
  PortableSignature,
  SignatureSupportMatrix,
  signDetached,
  toBase64Url,
  verifyDetached,
  verifyMany,
  VerifyManyDetachedSignatureRequest,
  VerifyManyReport,
  VerifyManySignatureRequest
} from "../../src/index.js"

const PackageManifestSchema = Schema.Struct({
  scripts: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String }))
})

const manifest = Schema.decodeUnknownSync(PackageManifestSchema)(packageJson)
const packageRootUrl = new URL("../../", import.meta.url)

describe("package/readme-surface", () => {
  it.effect("documents only the shipped signing, agreement, kem, portable codec, and detached portability surface", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const packageEntries = yield* fileSystem.readDirectory(root).pipe(Effect.orDie)
      const readme = yield* fileSystem.readFileString(path.join(root, "README.md")).pipe(Effect.orDie)

      expect(typeof signDetached).toBe("function")
      expect(typeof verifyDetached).toBe("function")
      expect(typeof verifyMany).toBe("function")
      expect(typeof deriveSharedSecret).toBe("function")
      expect(typeof encapsulate).toBe("function")
      expect(typeof decapsulate).toBe("function")
      expect(typeof encodeKeyPair).toBe("function")
      expect(typeof decodeKeyPair).toBe("function")
      expect(typeof encodeSignature).toBe("function")
      expect(typeof decodeSignature).toBe("function")
      expect(typeof encodeSharedSecret).toBe("function")
      expect(typeof decodeSharedSecret).toBe("function")
      expect(typeof toBase64Url).toBe("function")
      expect(typeof fromBase64Url).toBe("function")
      expect(SignatureSupportMatrix.length).toBeGreaterThan(0)
      expect(AgreementSupportMatrix.length).toBe(1)
      expect(AlgorithmSupportMatrix.length).toBeGreaterThan(SignatureSupportMatrix.length)
      expect(DetachedSignature).toBeDefined()
      expect(PortableKeyPair).toBeDefined()
      expect(PortableSignature).toBeDefined()
      expect(PortableSharedSecret).toBeDefined()
      expect(VerifyManySignatureRequest).toBeDefined()
      expect(VerifyManyDetachedSignatureRequest).toBeDefined()
      expect(VerifyManyReport).toBeDefined()

      expect(readme).toContain("### Signatures")
      expect(readme).toContain("### Key agreement")
      expect(readme).toContain("### Key encapsulation (KEM)")
      expect(readme).toContain("Detached signatures")
      expect(readme).toContain("Verify many signatures")
      expect(readme).toContain("Portable codecs")
      expect(readme).toContain("signDetached")
      expect(readme).toContain("verifyDetached")
      expect(readme).toContain("verifyMany")
      expect(readme).toContain("encodeKeyPair")
      expect(readme).toContain("decodeKeyPair")
      expect(readme).toContain("PortableKeyPair")
      expect(readme).toContain("PortableSignature")
      expect(readme).toContain("PortableSharedSecret")
      expect(readme).toContain("toBase64Url")
      expect(readme).toContain("fromBase64Url")
      expect(readme).toContain("examples/04-detached-signature.ts")
      expect(readme).toContain("examples/05-verify-many.ts")
      expect(readme).toContain("examples/06-key-codecs.ts")
      expect(readme).toContain("explicit-key verification")
      expect(readme).toContain("per-item outcomes")

      expect(manifest.scripts?.["release-snapshots:stamp"]).toBe("bun ../../scripts/stamp-release-snapshot.ts")
      expect(packageEntries).not.toContain("stamp-release-snapshot.ts")
    }).pipe(Effect.provide(BunContext.layer)))
})
