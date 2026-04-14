import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { seal, unseal } from "../src/seal.js"
import { plaintext, validKey } from "./helpers/keys.js"

describe("seal metadata", () => {
  it.effect("stamps keyId and keyVersion metadata without changing ciphertext recovery", () =>
    Effect.gen(function*() {
      const envelope = yield* seal("xchacha20-poly1305", validKey, plaintext, {
        keyId: "current-primary-key",
        keyVersion: 4
      })
      const recovered = yield* unseal(validKey, envelope)

      expect(envelope.keyId).toBe("current-primary-key")
      expect(envelope.keyVersion).toBe(4)
      expect(recovered).toEqual(plaintext)
    }))

  it.effect("keeps metadata-free envelopes backward-compatible", () =>
    Effect.gen(function*() {
      const envelope = yield* seal("aes-256-gcm", validKey, plaintext)
      const recovered = yield* unseal(validKey, envelope)

      expect(envelope.keyId).toBeUndefined()
      expect(envelope.keyVersion).toBeUndefined()
      expect(recovered).toEqual(plaintext)
    }))
})
