import { describe, expect, it } from "@effect/vitest"
import { Effect, Either } from "effect"

import {
  fromBase64Url,
  generateKeyPair,
  signDetached,
  toBase64Url,
  utf8ToBytes,
  verifyDetached
} from "../../src/index.js"

describe("detached-signature example contracts", () => {
  it.effect("keeps detached signatures portable through base64url public-key transport", () =>
    Effect.gen(function*() {
      const keys = yield* generateKeyPair("ed25519")
      const message = utf8ToBytes("release-proof")
      const detached = yield* signDetached("ed25519", message, keys.secretKey, keys.publicKey)
      const encodedPublicKey = toBase64Url(keys.publicKey)

      expect(encodedPublicKey.includes("+")).toBe(false)
      expect(encodedPublicKey.includes("/")).toBe(false)
      expect(encodedPublicKey.includes("=")).toBe(false)

      const decodedPublicKey = Either.match(fromBase64Url(encodedPublicKey), {
        onLeft: Effect.fail,
        onRight: Effect.succeed
      })
      const publicKey = yield* decodedPublicKey
      const valid = yield* verifyDetached(detached, message, publicKey)

      expect(valid).toBe(true)
    }))
})
