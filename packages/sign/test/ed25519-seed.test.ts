import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Encoding, Schema } from "effect"
import { ed25519KeyPairFromSeed, ed25519Sign, ed25519Verify, InvalidEd25519Seed } from "../src/index.js"

describe("Ed25519 seed reconstruction", () => {
  it.effect("reconstructs RFC 8032 section 7.1 identities without changing their seed", () =>
    Effect.forEach(
      Arr.make(
        {
          seed: "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60",
          publicKey: "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
          message: ""
        },
        {
          seed: "4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb",
          publicKey: "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c",
          message: "72"
        }
      ),
      (vector) =>
        Effect.gen(function*() {
          const seed = yield* Encoding.decodeHex(vector.seed)
          const keys = yield* ed25519KeyPairFromSeed(seed)
          expect(Encoding.encodeHex(keys.publicKey)).toBe(vector.publicKey)
          expect(Encoding.encodeHex(keys.secretKey)).toBe(vector.seed)
          expect(keys.secretKey).not.toBe(seed)
          const message = yield* Encoding.decodeHex(vector.message)
          const signed = yield* ed25519Sign(message, keys.secretKey, keys.publicKey)
          expect(yield* ed25519Verify(signed.signature, message, keys.publicKey)).toBe(true)
        })
    ))

  it.effect("rejects seeds on both sides of the exact 32-byte boundary", () =>
    Effect.forEach(Arr.make(0, 31, 33, 64), (length) =>
      Effect.gen(function*() {
        const seed = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0, length))
        expect(yield* Effect.flip(ed25519KeyPairFromSeed(seed))).toEqual(new InvalidEd25519Seed({}))
      })))

  it.effect("rejects a public key that does not belong to the signing seed", () =>
    Effect.gen(function*() {
      const seed = yield* Encoding.decodeHex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")
      const wrongKey = yield* Encoding.decodeHex("3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c")
      const message = yield* Encoding.decodeHex("72")
      const failure = yield* Effect.flip(ed25519Sign(message, seed, wrongKey))
      expect(failure.reason).toBe("Invalid Ed25519 signing input")
    }))
})
