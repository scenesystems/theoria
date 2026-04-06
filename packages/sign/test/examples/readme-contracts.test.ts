import { describe, expect, it } from "@effect/vitest"
import { Effect, Either } from "effect"

import {
  decapsulate,
  deriveSharedSecret,
  encapsulate,
  equalBytes,
  fromBase64Url,
  generateKeyPair,
  sign,
  signDetached,
  toBase64Url,
  utf8ToBytes,
  verify,
  verifyDetached
} from "../../src/index.js"

const signingExample = Effect.gen(function*() {
  const keys = yield* generateKeyPair("ed25519")
  const message = utf8ToBytes("transfer 100 tokens")
  const signature = yield* sign("ed25519", message, keys.secretKey, keys.publicKey)
  const valid = yield* verify(signature, message)

  return { valid, signatureBytes: signature.signature.length }
})

const agreementExample = Effect.gen(function*() {
  const alice = yield* generateKeyPair("x25519")
  const bob = yield* generateKeyPair("x25519")
  const secretA = yield* deriveSharedSecret("x25519", alice.secretKey, bob.publicKey)
  const secretB = yield* deriveSharedSecret("x25519", bob.secretKey, alice.publicKey)

  return equalBytes(secretA.sharedSecret, secretB.sharedSecret)
})

const kemExample = Effect.gen(function*() {
  const recipient = yield* generateKeyPair("xwing")
  const ciphertext = yield* encapsulate("xwing", recipient.publicKey)
  const recipientSecret = yield* decapsulate("xwing", ciphertext.ciphertext, recipient.secretKey)

  return equalBytes(ciphertext.sharedSecret, recipientSecret)
})

const detachedCodecExample = Effect.gen(function*() {
  const keys = yield* generateKeyPair("ed25519")
  const message = utf8ToBytes("release artifact v1")
  const detached = yield* signDetached("ed25519", message, keys.secretKey, keys.publicKey)
  const encodedPublicKey = toBase64Url(keys.publicKey)
  const decodedPublicKey = yield* Either.match(fromBase64Url(encodedPublicKey), {
    onLeft: Effect.fail,
    onRight: Effect.succeed
  })
  const valid = yield* verifyDetached(detached, message, decodedPublicKey)

  return { encodedPublicKey, valid }
})

describe("examples/readme-contracts", () => {
  it.effect("keeps the signing example runnable", () =>
    Effect.gen(function*() {
      const result = yield* signingExample

      expect(result.valid).toBe(true)
      expect(result.signatureBytes).toBe(64)
    }))

  it.effect("keeps the agreement example runnable", () =>
    Effect.gen(function*() {
      expect(yield* agreementExample).toBe(true)
    }))

  it.effect("keeps the KEM example runnable", () =>
    Effect.gen(function*() {
      expect(yield* kemExample).toBe(true)
    }))

  it.effect("keeps the detached-signature codec example runnable", () =>
    Effect.gen(function*() {
      const result = yield* detachedCodecExample

      expect(result.encodedPublicKey.includes("+")).toBe(false)
      expect(result.encodedPublicKey.includes("/")).toBe(false)
      expect(result.encodedPublicKey.includes("=")).toBe(false)
      expect(result.valid).toBe(true)
    }))
})
