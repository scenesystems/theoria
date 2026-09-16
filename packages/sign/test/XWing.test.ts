/**
 * Hybrid classical + post-quantum algorithm contract tests.
 *
 * Verifies:
 * - XWing key agreement roundtrip (encapsulate → decapsulate)
 * - Shared secret symmetry for XWing
 * - 32-byte combined shared secret output
 * - Different key pairs produce different shared secrets
 * - Encapsulated ciphertext is well-formed
 */
import { describe, expect, it } from "@effect/vitest"
import { Entropy, XWing } from "@scenesystems/sign"
import { Array as Arr, Effect, Encoding, Number as N, Schema } from "effect"

describe("XWing — KEM algorithm contracts", () => {
  it.effect("matches the independent draft-06 known-answer shared secret", () =>
    Effect.gen(function*() {
      // First vector from the draft authors' independent Python specification:
      // https://github.com/dconnolly/draft-connolly-cfrg-xwing-kem/blob/5cb311dc7c7761c2b82d2f4a0037da2c2c7af8f3/spec/test-vectors.txt
      const seed = yield* Encoding.decodeHex("7f9c2ba4e88f827d616045507605853ed73b8093f6efbc88eb1a6eacfa66ef26")
      const randomness = yield* Encoding.decodeHex(
        "3cb1eea988004b93103cfb0aeefd2a686e01fa4a58e8a3639ca8a1e3f9ae57e235b8cc873c23dc62b8d260169afa2f75ab916a58d974918835d25e6a435085b2"
      )
      const keys = yield* XWing.generateKeyPair().pipe(Effect.provideService(Entropy.Entropy, {
        bytes: () => Effect.succeed(seed)
      }))
      const encapsulated = yield* XWing.encapsulate(keys.publicKey).pipe(Effect.provideService(Entropy.Entropy, {
        bytes: () => Effect.succeed(randomness)
      }))
      const expected = "d2df0522128f09dd8e2c92b1e905c793d8f57a54c3da25861f10bf4ca613e384"
      expect(Encoding.encodeHex(encapsulated.sharedSecret)).toBe(expected)
      expect(Encoding.encodeHex(yield* XWing.decapsulate(encapsulated.ciphertext, keys.secretKey))).toBe(expected)
    }))

  it.effect("encapsulate → decapsulate roundtrip", () =>
    Effect.gen(function*() {
      const kp = yield* XWing.generateKeyPair()
      const encap = yield* XWing.encapsulate(kp.publicKey)
      const sharedSecret = yield* XWing.decapsulate(encap.ciphertext, kp.secretKey)
      expect(sharedSecret).toEqual(encap.sharedSecret)
      expect(encap.algorithm).toBe("xwing")
      expect(kp.algorithm).toBe("xwing")
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("shared secret is 32 bytes", () =>
    Effect.gen(function*() {
      const kp = yield* XWing.generateKeyPair()
      const encap = yield* XWing.encapsulate(kp.publicKey)
      expect(encap.sharedSecret.length).toBe(32)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("different key pairs produce different shared secrets", () =>
    Effect.gen(function*() {
      const kp1 = yield* XWing.generateKeyPair()
      const kp2 = yield* XWing.generateKeyPair()
      const encap1 = yield* XWing.encapsulate(kp1.publicKey)
      const encap2 = yield* XWing.encapsulate(kp2.publicKey)
      expect(encap1.sharedSecret).not.toEqual(encap2.sharedSecret)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("modified well-sized ciphertext derives a different secret instead of authenticating the sender", () =>
    Effect.gen(function*() {
      const kp = yield* XWing.generateKeyPair()
      const encap = yield* XWing.encapsulate(kp.publicKey)
      const changed = yield* Schema.decode(Schema.Uint8Array)(
        Arr.modify(encap.ciphertext, 0, (byte) => N.remainder(N.increment(byte), 256))
      )
      expect(yield* XWing.decapsulate(changed, kp.secretKey)).not.toEqual(encap.sharedSecret)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("produces the draft profile's exact public-key, seed, and ciphertext widths", () =>
    Effect.gen(function*() {
      const kp = yield* XWing.generateKeyPair()
      const encap = yield* XWing.encapsulate(kp.publicKey)
      expect(kp.publicKey.length).toBe(1216)
      expect(kp.secretKey.length).toBe(32)
      expect(encap.ciphertext.length).toBe(1120)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("rejects truncated and oversized ciphertext through the typed failure channel", () =>
    Effect.gen(function*() {
      const kp = yield* XWing.generateKeyPair()
      const encap = yield* XWing.encapsulate(kp.publicKey)
      yield* Effect.forEach(
        Arr.make(Arr.dropRight(encap.ciphertext, 1), Arr.append(encap.ciphertext, 0)),
        (bytes) =>
          Effect.gen(function*() {
            const invalid = yield* Schema.decode(Schema.Uint8Array)(bytes)
            expect(yield* Effect.flip(XWing.decapsulate(invalid, kp.secretKey))).toBeInstanceOf(XWing.Failed)
          })
      )
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("each keygen produces unique keys", () =>
    Effect.gen(function*() {
      const kp1 = yield* XWing.generateKeyPair()
      const kp2 = yield* XWing.generateKeyPair()
      expect(kp1.secretKey).not.toEqual(kp2.secretKey)
      expect(kp1.publicKey).not.toEqual(kp2.publicKey)
    }).pipe(Effect.provide(Entropy.layer)))
})
