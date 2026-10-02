import { describe, expect, it } from "@effect/vitest"
import { p256 } from "@noble/curves/nist.js"
import { Bytes, Ed25519, Entropy, MlDsa, P256, Signature, Verification } from "@scenesystems/sign"
import { Array as Arr, BigInt as BI, Effect, Number as N, Schema, Tuple } from "effect"
import * as Encoding from "effect/encoding"

const decodeHex = (value: string) => Effect.fromResult(Encoding.Hex.decode(value))
import { P256Fixture } from "../../scripts/fixture-contract.js"
import p256Corpus from "../fixtures/conformance/p256.json" with { type: "json" }

const EMPTY_CONTEXT = Bytes.fromString("")
const message = Bytes.fromString("strict direct verification")

describe("strict direct verification suites", () => {
  it.effect("rejects malformed Ed25519 input and does not mutate admitted input", () =>
    Effect.gen(function*() {
      const keyPair = yield* Ed25519.generateKeyPair
      const signed = yield* Ed25519.sign(message, keyPair.secretKey, keyPair.publicKey)
      const signature = signed.signature
      const publicKey = keyPair.publicKey
      const inputs = Tuple.make(signature, message, publicKey)
      const before = Arr.map(inputs, Arr.fromIterable)
      const smallOrderKey = new Uint8Array(Arr.prepend(Arr.replicate(0, 31), 1))
      const smallOrderR = new Uint8Array(Arr.appendAll(
        Arr.fromIterable(smallOrderKey),
        Arr.drop(Arr.fromIterable(signature), 32)
      ))
      const shortSignature = new Uint8Array(Arr.drop(Arr.fromIterable(signature), 1))

      expect(yield* Ed25519.verify(signature, message, publicKey)).toBe(true)
      expect(yield* Ed25519.verify(signature, Bytes.fromString("different message"), publicKey)).toBe(false)
      yield* Effect.forEach(
        Arr.make(
          Ed25519.verify(shortSignature, message, publicKey),
          Ed25519.verify(signature, message, smallOrderKey),
          Ed25519.verify(smallOrderR, message, publicKey)
        ),
        (verification) =>
          Effect.gen(function*() {
            expect(yield* Effect.flip(verification)).toEqual(new Verification.InvalidInput({}))
          })
      )
      expect(Arr.map(inputs, Arr.fromIterable)).toEqual(before)
    }).pipe(Effect.provide(Entropy.layer)))

  it.effect("rejects P-256 alternate encodings, out-of-range scalars, and high-S", () =>
    Effect.gen(function*() {
      const vector = Arr.headNonEmpty(
        (yield* Schema.decodeUnknownEffect(Schema.toType(P256Fixture))(p256Corpus)).cases
      )
      const publicKey = yield* decodeHex(vector.publicKey.uncompressed)
      const message = yield* decodeHex(vector.message)
      const signature = yield* decodeHex(vector.signature)
      const compressedPublicKey = p256.Point.fromBytes(publicKey).toBytes(true)
      const parsedSignature = p256.Signature.fromBytes(signature, "compact")
      const forcedHighSignature = new p256.Signature(
        parsedSignature.r,
        BI.subtract(p256.Point.Fn.ORDER, parsedSignature.s)
      ).toBytes("compact")
      const derSignature = parsedSignature.toBytes("der")
      const offCurvePublicKey = new Uint8Array(Arr.prepend(Arr.replicate(0, 64), 0x04))
      const zeroR = new Uint8Array(Arr.appendAll(
        Arr.replicate(0, 32),
        Arr.drop(Arr.fromIterable(signature), 32)
      ))
      const shortSignature = new Uint8Array(Arr.drop(Arr.fromIterable(signature), 1))
      const inputs = Tuple.make(signature, message, publicKey)
      const before = Arr.map(inputs, Arr.fromIterable)

      expect(yield* P256.verify(signature, message, publicKey)).toBe(true)
      expect(yield* P256.verify(signature, Bytes.fromString("different message"), publicKey)).toBe(false)
      yield* Effect.forEach(
        Arr.make(
          P256.verify(signature, message, compressedPublicKey),
          P256.verify(shortSignature, message, publicKey),
          P256.verify(derSignature, message, publicKey),
          P256.verify(signature, message, offCurvePublicKey),
          P256.verify(zeroR, message, publicKey),
          P256.verify(forcedHighSignature, message, publicKey)
        ),
        (verification) =>
          Effect.gen(function*() {
            expect(yield* Effect.flip(verification)).toEqual(new Verification.InvalidInput({}))
          })
      )
      expect(Arr.map(inputs, Arr.fromIterable)).toEqual(before)
    }))

  it.effect("freezes explicit ML-DSA-65 context, canonical hints, and signing entropy", () =>
    Effect.gen(function*() {
      const keyPair = yield* MlDsa.generateKeyPair65
      const entropy = new Uint8Array(Arr.replicate(0x42, MlDsa.entropyBytes))
      const otherEntropy = new Uint8Array(Arr.replicate(0x24, MlDsa.entropyBytes))
      const first = yield* MlDsa.sign65Hedged(
        message,
        keyPair.secretKey,
        keyPair.publicKey,
        EMPTY_CONTEXT,
        entropy
      )
      const repeated = yield* MlDsa.sign65Hedged(
        message,
        keyPair.secretKey,
        keyPair.publicKey,
        EMPTY_CONTEXT,
        entropy
      )
      const changedEntropy = yield* MlDsa.sign65Hedged(
        message,
        keyPair.secretKey,
        keyPair.publicKey,
        EMPTY_CONTEXT,
        otherEntropy
      )
      const deterministicA = yield* MlDsa.sign65Deterministic(message, keyPair.secretKey, keyPair.publicKey)
      const deterministicB = yield* MlDsa.sign65Deterministic(message, keyPair.secretKey, keyPair.publicKey)
      const malformedHint = new Uint8Array(
        yield* Effect.fromOption(Arr.replace(Arr.fromIterable(first.signature), 3_303, 56))
      )
      const context = new Uint8Array(Arr.of(0x11))
      const contextSignature = yield* MlDsa.sign65Hedged(
        message,
        keyPair.secretKey,
        keyPair.publicKey,
        context,
        entropy
      )
      const inputs = Tuple.make(contextSignature.signature, message, keyPair.publicKey, context)
      const before = Arr.map(inputs, Arr.fromIterable)

      expect(first.signature).toEqual(repeated.signature)
      expect(first.signature).not.toEqual(changedEntropy.signature)
      expect(deterministicA.signature).toEqual(deterministicB.signature)
      expect(yield* MlDsa.verify65(contextSignature.signature, message, keyPair.publicKey, context)).toBe(true)
      expect(yield* MlDsa.verify65(contextSignature.signature, message, keyPair.publicKey, EMPTY_CONTEXT)).toBe(false)
      expect(yield* MlDsa.verify65(first.signature, message, keyPair.publicKey, EMPTY_CONTEXT)).toBe(true)
      expect(yield* Effect.flip(MlDsa.verify65(malformedHint, message, keyPair.publicKey, EMPTY_CONTEXT)))
        .toEqual(new Verification.InvalidInput({}))
      expect(Arr.map(inputs, Arr.fromIterable)).toEqual(before)

      const maximumMessage = new Uint8Array(
        Arr.replicate(0x37, Verification.maxMessageBytes)
      )
      const maximumContext = new Uint8Array(Arr.replicate(0x19, MlDsa.maxContextBytes))
      const maximum = yield* MlDsa.sign65Hedged(
        maximumMessage,
        keyPair.secretKey,
        keyPair.publicKey,
        maximumContext,
        entropy
      )
      expect(yield* MlDsa.verify65(maximum.signature, maximumMessage, keyPair.publicKey, maximumContext)).toBe(true)
      const excessContext = new Uint8Array(
        Arr.replicate(0x19, N.increment(MlDsa.maxContextBytes))
      )
      const excessMessage = new Uint8Array(
        Arr.replicate(0x37, N.increment(Verification.maxMessageBytes))
      )
      expect(yield* Effect.flip(MlDsa.verify65(maximum.signature, maximumMessage, keyPair.publicKey, excessContext)))
        .toEqual(new Verification.InvalidInput({}))
      yield* Effect.forEach(
        Arr.make(
          MlDsa.sign65Hedged(excessMessage, keyPair.secretKey, keyPair.publicKey, context, entropy),
          MlDsa.sign65Hedged(message, keyPair.secretKey, keyPair.publicKey, excessContext, entropy),
          MlDsa.sign65Hedged(
            message,
            keyPair.secretKey,
            keyPair.publicKey,
            context,
            new Uint8Array(Arr.replicate(0x42, N.decrement(MlDsa.entropyBytes)))
          ),
          MlDsa.sign65Hedged(
            message,
            keyPair.secretKey,
            keyPair.publicKey,
            context,
            new Uint8Array(Arr.replicate(0x42, N.increment(MlDsa.entropyBytes)))
          )
        ),
        (signing) =>
          Effect.gen(function*() {
            expect(yield* Effect.flip(signing)).toEqual(
              new Signature.SigningFailed({ algorithm: "ml-dsa-65", reason: "invalid input" })
            )
          })
      )
    }).pipe(Effect.provide(Entropy.layer)), 30_000)
})
