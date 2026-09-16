/**
 * X25519 ECDH key agreement contract tests.
 *
 * Verifies:
 * - Shared secret symmetry (A→B == B→A)
 * - 32-byte shared secret output shape
 * - Different key pairs produce different shared secrets
 * - Key pair generation produces valid 32-byte keys
 */
import { describe, expect, it } from "@effect/vitest"
import { Entropy, X25519 } from "@scenesystems/sign"
import { Array as Arr, Effect, Encoding, FastCheck, Schema, Tuple } from "effect"

describe("X25519 ECDH — algorithm contracts", () => {
  it.effect.prop(
    "agreement is symmetric for distinct generated scalars",
    Tuple.make(
      FastCheck.uint8Array({ minLength: 32, maxLength: 32 }),
      FastCheck.uint8Array({ minLength: 32, maxLength: 32 })
    ),
    ([a, b]) =>
      Effect.gen(function*() {
        // Reproducible test-only entropy, never the production Entropy.layer.
        const alice = yield* X25519.generateKeyPair().pipe(Effect.provideService(Entropy.Entropy, {
          bytes: () => Effect.succeed(a)
        }))
        const bob = yield* X25519.generateKeyPair().pipe(Effect.provideService(Entropy.Entropy, {
          bytes: () => Effect.succeed(b)
        }))
        const ssAB = yield* X25519.deriveSharedSecret(alice.secretKey, bob.publicKey)
        const ssBA = yield* X25519.deriveSharedSecret(bob.secretKey, alice.publicKey)
        expect(ssAB.sharedSecret).toEqual(ssBA.sharedSecret)
      }),
    { fastCheck: { seed: 7748, numRuns: 30 } }
  )

  it.effect("matches RFC 7748 section 6.1 and rejects an all-zero peer", () =>
    Effect.gen(function*() {
      const seed = yield* Encoding.decodeHex("77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a")
      const peer = yield* Encoding.decodeHex("de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f")
      const alice = yield* X25519.generateKeyPair().pipe(Effect.provideService(Entropy.Entropy, {
        bytes: () => Effect.succeed(seed)
      }))
      expect(Encoding.encodeHex(alice.publicKey))
        .toBe("8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a")
      const result = yield* X25519.deriveSharedSecret(alice.secretKey, peer)
      expect(Encoding.encodeHex(result.sharedSecret))
        .toBe("4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742")
      const allZeroPeer = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0, 32))
      const error = yield* Effect.flip(X25519.deriveSharedSecret(alice.secretKey, allZeroPeer))
      expect(error).toBeInstanceOf(X25519.AgreementFailed)
    }))

  it.effect("produces 32-byte shared secret", () =>
    Effect.gen(function*() {
      const alice = yield* X25519.generateKeyPair()
      const bob = yield* X25519.generateKeyPair()
      const ss = yield* X25519.deriveSharedSecret(alice.secretKey, bob.publicKey)
      expect(ss.sharedSecret.length).toBe(32)
      expect(ss.algorithm).toBe("x25519")
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("different key pairs produce different shared secrets", () =>
    Effect.gen(function*() {
      const alice = yield* X25519.generateKeyPair()
      const bob = yield* X25519.generateKeyPair()
      const carol = yield* X25519.generateKeyPair()
      const ssAB = yield* X25519.deriveSharedSecret(alice.secretKey, bob.publicKey)
      const ssAC = yield* X25519.deriveSharedSecret(alice.secretKey, carol.publicKey)
      expect(ssAB.sharedSecret).not.toEqual(ssAC.sharedSecret)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("generates 32-byte keys", () =>
    Effect.gen(function*() {
      const kp = yield* X25519.generateKeyPair()
      expect(kp.secretKey.length).toBe(32)
      expect(kp.publicKey.length).toBe(32)
      expect(kp.algorithm).toBe("x25519")
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("each keygen produces unique keys", () =>
    Effect.gen(function*() {
      const kp1 = yield* X25519.generateKeyPair()
      const kp2 = yield* X25519.generateKeyPair()
      expect(kp1.secretKey).not.toEqual(kp2.secretKey)
      expect(kp1.publicKey).not.toEqual(kp2.publicKey)
    }).pipe(Effect.provide(Entropy.layer)))
})
