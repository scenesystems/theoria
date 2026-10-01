/** ML-DSA FIPS 204 behavior through the public concern API. */
import { describe, expect, it } from "@effect/vitest"
import { Bytes, Entropy, MlDsa } from "@scenesystems/sign"
import { Array as Arr, Data, Effect, Encoding, Layer, Match, Number as N, Schema } from "effect"
import { PublicSignatureKatFixture } from "../scripts/fixture-contract.js"
import katCorpus from "./fixtures/conformance/sign-public-kat.json" with { type: "json" }

const message = Bytes.fromString("post-quantum hello")
const emptyContext = Bytes.fromString("")

const deterministicEntropy = (entropy: Uint8Array) =>
  Layer.succeed(
    Entropy.Entropy,
    Data.struct({
      bytes: (length: number) =>
        Effect.succeed(entropy).pipe(
          Effect.filterOrFail(
            (bytes) => N.Equivalence(bytes.length, length),
            () => new Entropy.GenerationFailed({ length, reason: "unexpected deterministic entropy request" })
          )
        )
    })
  )

describe("ML-DSA independent ACVP conformance", () => {
  it.effect("reproduces ML-DSA-44 and ML-DSA-87 FIPS 204 key-generation answers", () =>
    Effect.gen(function*() {
      const fixture = yield* Schema.decodeUnknown(Schema.typeSchema(PublicSignatureKatFixture))(katCorpus)
      yield* Effect.forEach(fixture.mlDsa, (vector) =>
        Effect.gen(function*() {
          const entropy = yield* Encoding.decodeHex(vector.entropy)
          const keys = yield* Match.value(vector.parameterSet).pipe(
            Match.when("ML-DSA-44", () => MlDsa.generateKeyPair44()),
            Match.when("ML-DSA-87", () => MlDsa.generateKeyPair87()),
            Match.exhaustive,
            Effect.provide(deterministicEntropy(entropy))
          )
          expect(Encoding.encodeHex(keys.publicKey)).toBe(
            Encoding.encodeHex(yield* Encoding.decodeHex(vector.publicKey))
          )
          expect(Encoding.encodeHex(keys.secretKey)).toBe(
            Encoding.encodeHex(yield* Encoding.decodeHex(vector.secretKey))
          )
        }))
    }))
})

describe("ML-DSA-44", () => {
  it.effect("signs and verifies with the specified carrier sizes", () =>
    Effect.gen(function*() {
      const keys = yield* MlDsa.generateKeyPair44()
      const signed = yield* MlDsa.sign44(message, keys.secretKey, keys.publicKey)
      expect(yield* MlDsa.verify44(signed.signature, message, keys.publicKey)).toBe(true)
      expect(keys.publicKey.length).toBe(1_312)
      expect(keys.secretKey.length).toBe(2_560)
      expect(signed.signature.length).toBe(2_420)
      expect(keys.algorithm).toBe("ml-dsa-44")
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("rejects a signature under another public key", () =>
    Effect.gen(function*() {
      const first = yield* MlDsa.generateKeyPair44()
      const second = yield* MlDsa.generateKeyPair44()
      const signed = yield* MlDsa.sign44(message, first.secretKey, first.publicKey)
      expect(yield* MlDsa.verify44(signed.signature, message, second.publicKey)).toBe(false)
    }).pipe(Effect.provide(Entropy.layer)))
})

describe("ML-DSA-65", () => {
  it.effect("deterministically signs and verifies with the specified carrier sizes", () =>
    Effect.gen(function*() {
      const keys = yield* MlDsa.generateKeyPair65()
      const first = yield* MlDsa.sign65Deterministic(message, keys.secretKey, keys.publicKey)
      const second = yield* MlDsa.sign65Deterministic(message, keys.secretKey, keys.publicKey)
      expect(first.signature).toEqual(second.signature)
      expect(yield* MlDsa.verify65(first.signature, message, keys.publicKey, emptyContext)).toBe(true)
      expect(keys.publicKey.length).toBe(1_952)
      expect(keys.secretKey.length).toBe(4_032)
      expect(first.signature.length).toBe(3_309)
      expect(keys.algorithm).toBe("ml-dsa-65")
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("rejects tampered signatures and a wrong public key", () =>
    Effect.gen(function*() {
      const first = yield* MlDsa.generateKeyPair65()
      const second = yield* MlDsa.generateKeyPair65()
      const signed = yield* MlDsa.sign65Deterministic(message, first.secretKey, first.publicKey)
      const tampered = yield* Schema.decode(Schema.Uint8Array)(
        Arr.modify(Arr.fromIterable(signed.signature), 0, (byte) => N.subtract(255, byte))
      )
      expect(yield* MlDsa.verify65(tampered, message, first.publicKey, emptyContext)).toBe(false)
      expect(yield* MlDsa.verify65(signed.signature, message, second.publicKey, emptyContext)).toBe(false)
    }).pipe(Effect.provide(Entropy.layer)))
})

describe("ML-DSA-87", () => {
  it.effect("signs and verifies with the specified carrier sizes", () =>
    Effect.gen(function*() {
      const keys = yield* MlDsa.generateKeyPair87()
      const signed = yield* MlDsa.sign87(message, keys.secretKey, keys.publicKey)
      expect(yield* MlDsa.verify87(signed.signature, message, keys.publicKey)).toBe(true)
      expect(keys.publicKey.length).toBe(2_592)
      expect(keys.secretKey.length).toBe(4_896)
      expect(signed.signature.length).toBe(4_627)
      expect(keys.algorithm).toBe("ml-dsa-87")
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("generates independent key pairs", () =>
    Effect.gen(function*() {
      const first = yield* MlDsa.generateKeyPair87()
      const second = yield* MlDsa.generateKeyPair87()
      expect(first.secretKey).not.toEqual(second.secretKey)
      expect(first.publicKey).not.toEqual(second.publicKey)
    }).pipe(Effect.provide(Entropy.layer)))
})
