import { describe, expect, it } from "@effect/vitest"
import { p256 } from "@noble/curves/nist.js"
import {
  ed25519Keygen,
  ed25519Sign,
  ed25519Verify,
  InvalidVerificationInput,
  mlDsa65Keygen,
  mlDsa65SignDeterministic,
  mlDsa65SignHedged,
  mlDsa65Verify,
  p256Sha256P1363LowSVerify,
  SigningFailed,
  utf8ToBytes
} from "@scenesystems/sign"
import { Array as Arr, BigInt as BI, Effect, Encoding, Schema, Tuple } from "effect"
import { P256Fixture } from "../../scripts/fixture-contract.js"
import p256Corpus from "../fixtures/conformance/p256.json" with { type: "json" }

const EMPTY_CONTEXT = utf8ToBytes("")
const message = utf8ToBytes("strict direct verification")

describe("strict direct verification suites", () => {
  it.effect("rejects malformed Ed25519 input and does not mutate admitted input", () =>
    Effect.gen(function*() {
      const keyPair = yield* ed25519Keygen()
      const signed = yield* ed25519Sign(message, keyPair.secretKey, keyPair.publicKey)
      const signature = signed.signature
      const publicKey = keyPair.publicKey
      const inputs = Tuple.make(signature, message, publicKey)
      const before = yield* Schema.encode(Schema.Array(Schema.Uint8Array))(inputs)
      const smallOrderKey = yield* Schema.decode(Schema.Uint8Array)(Arr.prepend(Arr.replicate(0, 31), 1))
      const smallOrderR = yield* Schema.decode(Schema.Uint8Array)(Arr.appendAll(
        Arr.fromIterable(smallOrderKey),
        Arr.drop(Arr.fromIterable(signature), 32)
      ))
      const shortSignature = yield* Schema.decode(Schema.Uint8Array)(Arr.drop(Arr.fromIterable(signature), 1))

      expect(yield* ed25519Verify(signature, message, publicKey)).toBe(true)
      expect(yield* ed25519Verify(signature, utf8ToBytes("different message"), publicKey)).toBe(false)
      yield* Effect.forEach(
        Arr.make(
          ed25519Verify(shortSignature, message, publicKey),
          ed25519Verify(signature, message, smallOrderKey),
          ed25519Verify(smallOrderR, message, publicKey)
        ),
        (verification) =>
          Effect.gen(function*() {
            expect(yield* Effect.flip(verification)).toEqual(new InvalidVerificationInput({}))
          })
      )
      expect(yield* Schema.encode(Schema.Array(Schema.Uint8Array))(inputs)).toEqual(before)
    }))

  it.effect("rejects P-256 alternate encodings, out-of-range scalars, and high-S", () =>
    Effect.gen(function*() {
      const vector = Arr.headNonEmpty(
        (yield* Schema.decodeUnknown(Schema.typeSchema(P256Fixture))(p256Corpus)).cases
      )
      const publicKey = yield* Encoding.decodeHex(vector.publicKey.uncompressed)
      const message = yield* Encoding.decodeHex(vector.message)
      const signature = yield* Encoding.decodeHex(vector.signature)
      const compressedPublicKey = p256.Point.fromBytes(publicKey).toBytes(true)
      const parsedSignature = p256.Signature.fromBytes(signature, "compact")
      const forcedHighSignature = new p256.Signature(
        parsedSignature.r,
        BI.subtract(p256.Point.Fn.ORDER, parsedSignature.s)
      ).toBytes("compact")
      const derSignature = parsedSignature.toBytes("der")
      const offCurvePublicKey = yield* Schema.decode(Schema.Uint8Array)(Arr.prepend(Arr.replicate(0, 64), 0x04))
      const zeroR = yield* Schema.decode(Schema.Uint8Array)(Arr.appendAll(
        Arr.replicate(0, 32),
        Arr.drop(Arr.fromIterable(signature), 32)
      ))
      const shortSignature = yield* Schema.decode(Schema.Uint8Array)(Arr.drop(Arr.fromIterable(signature), 1))
      const inputs = Tuple.make(signature, message, publicKey)
      const before = yield* Schema.encode(Schema.Array(Schema.Uint8Array))(inputs)

      expect(yield* p256Sha256P1363LowSVerify(signature, message, publicKey)).toBe(true)
      expect(yield* p256Sha256P1363LowSVerify(signature, utf8ToBytes("different message"), publicKey)).toBe(false)
      yield* Effect.forEach(
        Arr.make(
          p256Sha256P1363LowSVerify(signature, message, compressedPublicKey),
          p256Sha256P1363LowSVerify(shortSignature, message, publicKey),
          p256Sha256P1363LowSVerify(derSignature, message, publicKey),
          p256Sha256P1363LowSVerify(signature, message, offCurvePublicKey),
          p256Sha256P1363LowSVerify(zeroR, message, publicKey),
          p256Sha256P1363LowSVerify(forcedHighSignature, message, publicKey)
        ),
        (verification) =>
          Effect.gen(function*() {
            expect(yield* Effect.flip(verification)).toEqual(new InvalidVerificationInput({}))
          })
      )
      expect(yield* Schema.encode(Schema.Array(Schema.Uint8Array))(inputs)).toEqual(before)
    }))

  it.effect("freezes explicit ML-DSA-65 context, canonical hints, and signing entropy", () =>
    Effect.gen(function*() {
      const keyPair = yield* mlDsa65Keygen()
      const entropy = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0x42, 32))
      const otherEntropy = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0x24, 32))
      const first = yield* mlDsa65SignHedged(
        message,
        keyPair.secretKey,
        keyPair.publicKey,
        EMPTY_CONTEXT,
        entropy
      )
      const repeated = yield* mlDsa65SignHedged(
        message,
        keyPair.secretKey,
        keyPair.publicKey,
        EMPTY_CONTEXT,
        entropy
      )
      const changedEntropy = yield* mlDsa65SignHedged(
        message,
        keyPair.secretKey,
        keyPair.publicKey,
        EMPTY_CONTEXT,
        otherEntropy
      )
      const deterministicA = yield* mlDsa65SignDeterministic(message, keyPair.secretKey, keyPair.publicKey)
      const deterministicB = yield* mlDsa65SignDeterministic(message, keyPair.secretKey, keyPair.publicKey)
      const malformedHint = yield* Schema.decode(Schema.Uint8Array)(
        Arr.replace(Arr.fromIterable(first.signature), 3_303, 56)
      )
      const context = yield* Schema.decode(Schema.Uint8Array)(Arr.of(0x11))
      const contextSignature = yield* mlDsa65SignHedged(
        message,
        keyPair.secretKey,
        keyPair.publicKey,
        context,
        entropy
      )
      const inputs = Tuple.make(contextSignature.signature, message, keyPair.publicKey, context)
      const before = yield* Schema.encode(Schema.Array(Schema.Uint8Array))(inputs)

      expect(first.signature).toEqual(repeated.signature)
      expect(first.signature).not.toEqual(changedEntropy.signature)
      expect(deterministicA.signature).toEqual(deterministicB.signature)
      expect(yield* mlDsa65Verify(contextSignature.signature, message, keyPair.publicKey, context)).toBe(true)
      expect(yield* mlDsa65Verify(contextSignature.signature, message, keyPair.publicKey, EMPTY_CONTEXT)).toBe(false)
      expect(yield* mlDsa65Verify(first.signature, message, keyPair.publicKey, EMPTY_CONTEXT)).toBe(true)
      expect(yield* Effect.flip(mlDsa65Verify(malformedHint, message, keyPair.publicKey, EMPTY_CONTEXT)))
        .toEqual(new InvalidVerificationInput({}))
      expect(yield* Schema.encode(Schema.Array(Schema.Uint8Array))(inputs)).toEqual(before)

      const maximumMessage = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0x37, 8_192))
      const maximumContext = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0x19, 255))
      const maximum = yield* mlDsa65SignHedged(
        maximumMessage,
        keyPair.secretKey,
        keyPair.publicKey,
        maximumContext,
        entropy
      )
      expect(yield* mlDsa65Verify(maximum.signature, maximumMessage, keyPair.publicKey, maximumContext)).toBe(true)
      const excessContext = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0x19, 256))
      const excessMessage = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0x37, 8_193))
      expect(yield* Effect.flip(mlDsa65Verify(maximum.signature, maximumMessage, keyPair.publicKey, excessContext)))
        .toEqual(new InvalidVerificationInput({}))
      yield* Effect.forEach(
        Arr.make(
          mlDsa65SignHedged(excessMessage, keyPair.secretKey, keyPair.publicKey, context, entropy),
          mlDsa65SignHedged(message, keyPair.secretKey, keyPair.publicKey, excessContext, entropy),
          mlDsa65SignHedged(
            message,
            keyPair.secretKey,
            keyPair.publicKey,
            context,
            yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0x42, 31))
          ),
          mlDsa65SignHedged(
            message,
            keyPair.secretKey,
            keyPair.publicKey,
            context,
            yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0x42, 33))
          )
        ),
        (signing) =>
          Effect.gen(function*() {
            expect(yield* Effect.flip(signing)).toEqual(
              new SigningFailed({ algorithm: "ml-dsa-65", reason: "invalid input" })
            )
          })
      )
    }), 30_000)
})
