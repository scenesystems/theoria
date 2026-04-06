import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { ed25519Keygen } from "../src/algorithms/ed25519.js"
import { mlDsa65Keygen } from "../src/algorithms/mlDsa.js"
import { secp256k1EcdsaKeygen } from "../src/algorithms/secp256k1.js"
import { slhDsaSha2128fKeygen } from "../src/algorithms/slhDsa.js"
import { signDetached, verifyDetached } from "../src/sign.js"

const message = new TextEncoder().encode("detached signature contract")

describe("detached signing pipeline", () => {
  it.effect("round-trips Ed25519 without embedding the public key", () =>
    Effect.gen(function*() {
      const keys = yield* ed25519Keygen()
      const detached = yield* signDetached("ed25519", message, keys.secretKey, keys.publicKey)

      expect(detached.algorithm).toBe("ed25519")
      expect(Reflect.has(detached, "publicKey")).toBe(false)

      const valid = yield* verifyDetached(detached, message, keys.publicKey)
      expect(valid).toBe(true)
    }))

  it.effect("round-trips secp256k1 ECDSA with explicit-key verification", () =>
    Effect.gen(function*() {
      const keys = yield* secp256k1EcdsaKeygen()
      const detached = yield* signDetached("secp256k1-ecdsa", message, keys.secretKey, keys.publicKey)
      const valid = yield* verifyDetached(detached, message, keys.publicKey)

      expect(valid).toBe(true)
    }))

  it.effect("round-trips ML-DSA detached signatures", () =>
    Effect.gen(function*() {
      const keys = yield* mlDsa65Keygen()
      const detached = yield* signDetached("ml-dsa-65", message, keys.secretKey, keys.publicKey)
      const valid = yield* verifyDetached(detached, message, keys.publicKey)

      expect(valid).toBe(true)
    }))

  it.effect("round-trips SLH-DSA detached signatures", () =>
    Effect.gen(function*() {
      const keys = yield* slhDsaSha2128fKeygen()
      const detached = yield* signDetached("slh-dsa-sha2-128f", message, keys.secretKey, keys.publicKey)
      const valid = yield* verifyDetached(detached, message, keys.publicKey)

      expect(valid).toBe(true)
    }), { timeout: 30_000 })

  it.effect("rejects detached verification with the wrong public key", () =>
    Effect.gen(function*() {
      const signer = yield* ed25519Keygen()
      const verifier = yield* ed25519Keygen()
      const detached = yield* signDetached("ed25519", message, signer.secretKey, signer.publicKey)
      const valid = yield* verifyDetached(detached, message, verifier.publicKey)

      expect(valid).toBe(false)
    }))
})
