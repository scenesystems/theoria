/**
 * Unified sign/verify pipeline contract tests.
 *
 * Verifies:
 * - Algorithm dispatch routes to correct signature implementation
 * - sign("ed25519", ...) produces Ed25519 signatures
 * - sign("ml-dsa-65", ...) produces ML-DSA-65 signatures
 * - sign("secp256k1-ecdsa", ...) produces ECDSA signatures
 * - sign("secp256k1-schnorr", ...) produces Schnorr signatures
 * - Algorithm-tagged Signature output carries correct algorithm field
 * - Verify dispatches based on signature algorithm tag
 * - Roundtrip sign/verify for every supported signature algorithm
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { ed25519Keygen } from "../src/algorithms/ed25519.js"
import { mlDsa44Keygen, mlDsa65Keygen, mlDsa87Keygen } from "../src/algorithms/mlDsa.js"
import { secp256k1EcdsaKeygen, secp256k1SchnorrKeygen } from "../src/algorithms/secp256k1.js"
import { slhDsaSha2128fKeygen } from "../src/algorithms/slhDsa.js"
import { sign, verify } from "../src/sign.js"

const message = new TextEncoder().encode("unified pipeline test")

describe("Unified sign/verify pipeline", () => {
  it.effect("sign('ed25519') → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* ed25519Keygen()
      const sig = yield* sign("ed25519", message, kp.secretKey, kp.publicKey)
      expect(sig.algorithm).toBe("ed25519")
      const valid = yield* verify(sig, message)
      expect(valid).toBe(true)
    }))

  it.effect("sign('secp256k1-ecdsa') → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* secp256k1EcdsaKeygen()
      const sig = yield* sign("secp256k1-ecdsa", message, kp.secretKey, kp.publicKey)
      expect(sig.algorithm).toBe("secp256k1-ecdsa")
      const valid = yield* verify(sig, message)
      expect(valid).toBe(true)
    }))

  it.effect("sign('secp256k1-schnorr') → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* secp256k1SchnorrKeygen()
      const sig = yield* sign("secp256k1-schnorr", message, kp.secretKey, kp.publicKey)
      expect(sig.algorithm).toBe("secp256k1-schnorr")
      const valid = yield* verify(sig, message)
      expect(valid).toBe(true)
    }))

  it.effect("sign('ml-dsa-44') → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* mlDsa44Keygen()
      const sig = yield* sign("ml-dsa-44", message, kp.secretKey, kp.publicKey)
      expect(sig.algorithm).toBe("ml-dsa-44")
      const valid = yield* verify(sig, message)
      expect(valid).toBe(true)
    }))

  it.effect("sign('ml-dsa-65') → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* mlDsa65Keygen()
      const sig = yield* sign("ml-dsa-65", message, kp.secretKey, kp.publicKey)
      expect(sig.algorithm).toBe("ml-dsa-65")
      const valid = yield* verify(sig, message)
      expect(valid).toBe(true)
    }))

  it.effect("sign('ml-dsa-87') → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* mlDsa87Keygen()
      const sig = yield* sign("ml-dsa-87", message, kp.secretKey, kp.publicKey)
      expect(sig.algorithm).toBe("ml-dsa-87")
      const valid = yield* verify(sig, message)
      expect(valid).toBe(true)
    }))

  it.effect("sign('slh-dsa-sha2-128f') → verify roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* slhDsaSha2128fKeygen()
      const sig = yield* sign("slh-dsa-sha2-128f", message, kp.secretKey, kp.publicKey)
      expect(sig.algorithm).toBe("slh-dsa-sha2-128f")
      const valid = yield* verify(sig, message)
      expect(valid).toBe(true)
    }), { timeout: 30_000 })

  it.effect("verify rejects wrong message", () =>
    Effect.gen(function*() {
      const kp = yield* ed25519Keygen()
      const sig = yield* sign("ed25519", message, kp.secretKey, kp.publicKey)
      const wrongMessage = new TextEncoder().encode("wrong message")
      const valid = yield* verify(sig, wrongMessage)
      expect(valid).toBe(false)
    }))
})
