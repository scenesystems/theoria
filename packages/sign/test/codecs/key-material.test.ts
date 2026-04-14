import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import {
  decodeKemCiphertext,
  decodeKeyPair,
  decodeSharedSecret,
  decodeSignature,
  deriveSharedSecret,
  encapsulate,
  encodeKemCiphertext,
  encodeKeyPair,
  encodeSharedSecret,
  encodeSignature,
  equalBytes,
  generateKeyPair,
  sign,
  utf8ToBytes,
  verify
} from "../../src/index.js"

describe("portable key-material codecs", () => {
  it.effect("round-trips key pairs, signatures, shared secrets, and KEM ciphertexts through portable carriers", () =>
    Effect.gen(function*() {
      const keyPair = yield* generateKeyPair("ed25519")
      const signature = yield* sign("ed25519", utf8ToBytes("portable signature"), keyPair.secretKey, keyPair.publicKey)
      const alice = yield* generateKeyPair("x25519")
      const bob = yield* generateKeyPair("x25519")
      const sharedSecret = yield* deriveSharedSecret("x25519", alice.secretKey, bob.publicKey)
      const recipient = yield* generateKeyPair("xwing")
      const ciphertext = yield* encapsulate("xwing", recipient.publicKey)

      const decodedKeyPair = yield* decodeKeyPair(encodeKeyPair(keyPair))
      const decodedSignature = yield* decodeSignature(encodeSignature(signature))
      const decodedSharedSecret = yield* decodeSharedSecret(encodeSharedSecret(sharedSecret))
      const decodedCiphertext = yield* decodeKemCiphertext(encodeKemCiphertext(ciphertext))

      expect(equalBytes(decodedKeyPair.publicKey, keyPair.publicKey)).toBe(true)
      expect(equalBytes(decodedKeyPair.secretKey, keyPair.secretKey)).toBe(true)
      expect(equalBytes(decodedSignature.signature, signature.signature)).toBe(true)
      expect(equalBytes(decodedSignature.publicKey, signature.publicKey)).toBe(true)
      expect(equalBytes(decodedSharedSecret.sharedSecret, sharedSecret.sharedSecret)).toBe(true)
      expect(equalBytes(decodedCiphertext.ciphertext, ciphertext.ciphertext)).toBe(true)
      expect(equalBytes(decodedCiphertext.sharedSecret, ciphertext.sharedSecret)).toBe(true)
      expect(yield* verify(decodedSignature, utf8ToBytes("portable signature"))).toBe(true)
    }))
})
