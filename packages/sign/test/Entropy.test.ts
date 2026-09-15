import { describe, expect, it } from "@effect/vitest"
import { Bytes, Ed25519, Entropy, KeyPair, MlDsa, Secp256k1, SlhDsa, X25519, XWing } from "@scenesystems/sign"
import { Array as Arr, Data, Effect, Encoding, Ref, Tuple } from "effect"

describe("Entropy", () => {
  it.effect("draws on each execution from the provided service, reconstructing independent RFC 8032 identities", () =>
    Effect.gen(function*() {
      const seeds = yield* Effect.forEach(
        Arr.make(
          "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60",
          "4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb"
        ),
        Encoding.decodeHex
      )
      const remaining = yield* Ref.make<ReadonlyArray<Uint8Array>>(seeds)
      const requests = yield* Ref.make(Arr.empty<number>())
      const generate = Ed25519.generateKeyPair().pipe(Effect.provideService(Entropy.Entropy, {
        bytes: (length) =>
          Ref.update(requests, Arr.append(length)).pipe(
            Effect.zipRight(
              Ref.modify(remaining, (values) => Tuple.make(Arr.unsafeGet(values, 0), Arr.drop(values, 1)))
            )
          )
      }))
      expect(yield* Ref.get(requests)).toEqual([])
      const first = yield* generate
      const second = yield* generate
      expect(Encoding.encodeHex(first.publicKey))
        .toBe("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a")
      expect(Encoding.encodeHex(second.publicKey))
        .toBe("3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c")
      expect(yield* Ref.get(requests)).toEqual([32, 32])
    }))

  it.effect("requests each suite's seed width and fails closed when the entropy provider fails", () =>
    Effect.forEach(
      Arr.make(
        Tuple.make(Ed25519.generateKeyPair(), "ed25519", 32),
        Tuple.make(X25519.generateKeyPair(), "x25519", 32),
        Tuple.make(XWing.generateKeyPair(), "xwing", 32),
        Tuple.make(Secp256k1.generateEcdsaKeyPair(), "secp256k1-ecdsa", 48),
        Tuple.make(Secp256k1.generateSchnorrKeyPair(), "secp256k1-schnorr", 48),
        Tuple.make(MlDsa.generateKeyPair44(), "ml-dsa-44", 32),
        Tuple.make(MlDsa.generateKeyPair65(), "ml-dsa-65", 32),
        Tuple.make(MlDsa.generateKeyPair87(), "ml-dsa-87", 32),
        Tuple.make(SlhDsa.generateSha2128fKeyPair(), "slh-dsa-sha2-128f", 48),
        Tuple.make(SlhDsa.generateSha2128sKeyPair(), "slh-dsa-sha2-128s", 48),
        Tuple.make(SlhDsa.generateSha2192fKeyPair(), "slh-dsa-sha2-192f", 72),
        Tuple.make(SlhDsa.generateSha2256fKeyPair(), "slh-dsa-sha2-256f", 96)
      ),
      ([generate, algorithm, expectedLength]) =>
        Effect.gen(function*() {
          const requests = yield* Ref.make(Arr.empty<number>())
          const error = yield* Effect.flip(generate.pipe(Effect.provideService(Entropy.Entropy, {
            bytes: (length) =>
              Ref.update(requests, Arr.append(length)).pipe(
                Effect.zipRight(
                  Effect.fail(new Entropy.GenerationFailed({ length, reason: "test source unavailable" }))
                )
              )
          })))
          expect(error).toBeInstanceOf(KeyPair.GenerationFailed)
          expect(error.algorithm).toBe(algorithm)
          expect(yield* Ref.get(requests)).toEqual([expectedLength])
        })
    ))

  it.effect("randomized signatures depend on supplied entropy, not ambient defaults", () =>
    Effect.gen(function*() {
      const message = Bytes.fromString("asymmetric signing entropy fixture")
      yield* Effect.forEach(
        Arr.make(
          Tuple.make(Secp256k1.generateSchnorrKeyPair, Secp256k1.signSchnorr, Secp256k1.verifySchnorr, 32),
          Tuple.make(MlDsa.generateKeyPair44, MlDsa.sign44, MlDsa.verify44, 32),
          Tuple.make(MlDsa.generateKeyPair87, MlDsa.sign87, MlDsa.verify87, 32),
          Tuple.make(SlhDsa.generateSha2128fKeyPair, SlhDsa.signSha2128f, SlhDsa.verifySha2128f, 16),
          Tuple.make(SlhDsa.generateSha2128sKeyPair, SlhDsa.signSha2128s, SlhDsa.verifySha2128s, 16),
          Tuple.make(SlhDsa.generateSha2192fKeyPair, SlhDsa.signSha2192f, SlhDsa.verifySha2192f, 24),
          Tuple.make(SlhDsa.generateSha2256fKeyPair, SlhDsa.signSha2256f, SlhDsa.verifySha2256f, 32)
        ),
        ([generate, sign, verify, expectedLength]) =>
          Effect.gen(function*() {
            const keys = yield* generate().pipe(Effect.provideService(Entropy.Entropy, {
              bytes: (length) => Effect.succeed(Uint8Array.from(Arr.replicate(0x31, length)))
            }))
            const signWith = (byte: number) =>
              sign(message, keys.secretKey, keys.publicKey).pipe(
                Effect.provideService(Entropy.Entropy, {
                  bytes: (length) =>
                    Effect.sync(() => {
                      expect(length).toBe(expectedLength)
                      return Uint8Array.from(Arr.replicate(byte, length))
                    })
                })
              )
            const first = yield* signWith(0x42)
            const repeated = yield* signWith(0x42)
            const changed = yield* signWith(0x73)
            expect(first.signature).toEqual(repeated.signature)
            expect(changed.signature).not.toEqual(first.signature)
            expect(yield* verify(first.signature, message, keys.publicKey)).toBe(true)
            expect(yield* verify(changed.signature, message, keys.publicKey)).toBe(true)
          })
      )
    }), { timeout: 30_000 })

  it.effect("X-Wing uses exactly 64 supplied bytes for reproducible encapsulation", () =>
    Effect.gen(function*() {
      const keys = yield* XWing.generateKeyPair().pipe(Effect.provideService(Entropy.Entropy, {
        bytes: (length) => Effect.succeed(Uint8Array.from(Arr.replicate(0x31, length)))
      }))
      const encapsulate = (byte: number) =>
        XWing.encapsulate(keys.publicKey).pipe(
          Effect.provideService(Entropy.Entropy, {
            bytes: (length) =>
              Effect.sync(() => {
                expect(length).toBe(64)
                return Uint8Array.from(Arr.replicate(byte, length))
              })
          })
        )
      const first = yield* encapsulate(0x42)
      const repeated = yield* encapsulate(0x42)
      const changed = yield* encapsulate(0x73)
      expect(first.ciphertext).toEqual(repeated.ciphertext)
      expect(first.sharedSecret).toEqual(repeated.sharedSecret)
      expect(changed.ciphertext).not.toEqual(first.ciphertext)
      expect(changed.sharedSecret).not.toEqual(first.sharedSecret)
      expect(yield* XWing.decapsulate(changed.ciphertext, keys.secretKey)).toEqual(changed.sharedSecret)
    }))

  it.effect("produces the explicitly requested number of fresh bytes", () =>
    Effect.gen(function*() {
      const first = yield* Entropy.bytes(32)
      const second = yield* Entropy.bytes(32)
      expect(first.length).toBe(32)
      expect(second.length).toBe(32)
      expect(Bytes.equal(first, second)).toBe(false)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("preserves the rejected length and source diagnostic in GenerationFailed", () =>
    Effect.forEach(
      Arr.make(
        Data.struct({ length: -1, reason: "RangeError: \"bytesLength\" expected integer >= 0, got -1" }),
        Data.struct({ length: 1.5, reason: "RangeError: \"bytesLength\" expected integer >= 0, got 1.5" }),
        Data.struct({ length: 65_537, reason: "RangeError: \"bytesLength\" expected <= 65536, got 65537" })
      ),
      ({ length, reason }) =>
        Effect.gen(function*() {
          const error = yield* Effect.flip(Entropy.bytes(length).pipe(Effect.provide(Entropy.layer)))
          expect(error).toBeInstanceOf(Entropy.GenerationFailed)
          expect(error.length).toBe(length)
          expect(error.reason).toBe(reason)
        })
    ))
})
