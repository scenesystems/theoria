import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import {
  decodeKeyPair,
  decodeSharedSecret,
  decodeSignature,
  deriveSharedSecret,
  encodeKeyPair,
  encodeSharedSecret,
  encodeSignature,
  equalBytes,
  generateKeyPair,
  sign,
  utf8ToBytes,
  verify
} from "../../src/index.js"

describe("examples/key-codec-contracts", () => {
  it.effect("keeps the portable signing codec workflow runnable", () =>
    Effect.gen(function*() {
      const keyPair = yield* generateKeyPair("ed25519")
      const portableKeys = encodeKeyPair(keyPair)
      const decodedKeys = yield* decodeKeyPair(portableKeys)
      const message = utf8ToBytes("portable signature workflow")
      const signature = yield* sign("ed25519", message, decodedKeys.secretKey, decodedKeys.publicKey)
      const portableSignature = encodeSignature(signature)
      const decodedSignature = yield* decodeSignature(portableSignature)

      expect(portableKeys.publicKey.includes("+")).toBe(false)
      expect(portableKeys.publicKey.includes("/")).toBe(false)
      expect(portableKeys.publicKey.includes("=")).toBe(false)
      expect(portableSignature.signature.includes("+")).toBe(false)
      expect(portableSignature.signature.includes("/")).toBe(false)
      expect(portableSignature.signature.includes("=")).toBe(false)
      expect(equalBytes(decodedKeys.publicKey, keyPair.publicKey)).toBe(true)
      expect(yield* verify(decodedSignature, message)).toBe(true)
    }))

  it.effect("keeps the portable shared-secret codec workflow runnable", () =>
    Effect.gen(function*() {
      const alice = yield* generateKeyPair("x25519")
      const bob = yield* generateKeyPair("x25519")
      const sharedSecret = yield* deriveSharedSecret("x25519", alice.secretKey, bob.publicKey)
      const portable = encodeSharedSecret(sharedSecret)
      const decoded = yield* decodeSharedSecret(portable)

      expect(portable.sharedSecret.includes("+")).toBe(false)
      expect(portable.sharedSecret.includes("/")).toBe(false)
      expect(portable.sharedSecret.includes("=")).toBe(false)
      expect(equalBytes(decoded.sharedSecret, sharedSecret.sharedSecret)).toBe(true)
    }))
})
