import { describe, expect, it } from "@effect/vitest"
import { p256 } from "@noble/curves/nist.js"
import { Effect } from "effect"
import { ed25519Keygen, ed25519Sign, ed25519Verify } from "../../src/algorithms/ed25519.js"
import {
  mlDsa65Keygen,
  mlDsa65SignDeterministic,
  mlDsa65SignHedged,
  mlDsa65Verify
} from "../../src/algorithms/mlDsa.js"
import { p256Sha256P1363LowSVerify } from "../../src/algorithms/p256.js"
import type { InvalidVerificationInput, VerificationUnavailable } from "../../src/schemas/errors.js"

const EMPTY_CONTEXT = new Uint8Array(0)
const message = new TextEncoder().encode("strict direct verification")

const failureTag = <A>(effect: Effect.Effect<A, InvalidVerificationInput | VerificationUnavailable>) =>
  Effect.flip(effect).pipe(Effect.map((error) => error._tag))

describe("strict direct verification suites", () => {
  it.effect("rejects malformed Ed25519 input and does not mutate admitted input", () =>
    Effect.gen(function*() {
      const keyPair = yield* ed25519Keygen()
      const signed = yield* ed25519Sign(message, keyPair.secretKey, keyPair.publicKey)
      const signature = Uint8Array.from(signed.signature)
      const publicKey = Uint8Array.from(keyPair.publicKey)
      const detachedMessage = Uint8Array.from(message)
      const expectedSignature = Uint8Array.from(signature)
      const expectedPublicKey = Uint8Array.from(publicKey)
      const expectedMessage = Uint8Array.from(detachedMessage)
      const executionMessage = Uint8Array.from(detachedMessage)
      const executionVerification = ed25519Verify(signature, executionMessage, publicKey)
      executionMessage.fill(0, 0, 1)
      const smallOrderKey = new Uint8Array(32)
      smallOrderKey[0] = 1
      const smallOrderR = Uint8Array.from(signature)
      smallOrderR.fill(0, 0, 32)
      smallOrderR[0] = 1

      expect(yield* ed25519Verify(signature, detachedMessage, publicKey)).toBe(true)
      expect(yield* executionVerification).toBe(false)
      executionMessage.set(detachedMessage.subarray(0, 1), 0)
      expect(yield* executionVerification).toBe(true)
      expect(yield* failureTag(ed25519Verify(signature.subarray(1), detachedMessage, publicKey)))
        .toBe("InvalidVerificationInput")
      expect(yield* failureTag(ed25519Verify(signature, detachedMessage, smallOrderKey)))
        .toBe("InvalidVerificationInput")
      expect(yield* failureTag(ed25519Verify(smallOrderR, detachedMessage, publicKey)))
        .toBe("InvalidVerificationInput")
      expect(signature).toEqual(expectedSignature)
      expect(publicKey).toEqual(expectedPublicKey)
      expect(detachedMessage).toEqual(expectedMessage)
    }))

  it.effect("rejects P-256 alternate encodings, out-of-range scalars, and high-S", () =>
    Effect.gen(function*() {
      const privateKey = new Uint8Array(32)
      privateKey[31] = 1
      const publicKey = p256.getPublicKey(privateKey, false)
      const compressedPublicKey = p256.getPublicKey(privateKey, true)
      const executionMessage = Uint8Array.from(message)
      const signature = p256.sign(executionMessage, privateKey, { lowS: true, prehash: true })
      const parsedSignature = p256.Signature.fromBytes(signature, "compact")
      const forcedHighSignature = new p256.Signature(
        parsedSignature.r,
        p256.Point.Fn.ORDER - parsedSignature.s
      ).toBytes("compact")
      const derSignature = parsedSignature.toBytes("der")
      const offCurvePublicKey = new Uint8Array(65)
      offCurvePublicKey[0] = 0x04
      const zeroR = Uint8Array.from(signature)
      zeroR.fill(0, 0, 32)
      const expectedSignature = Uint8Array.from(signature)
      const expectedPublicKey = Uint8Array.from(publicKey)
      const expectedMessage = Uint8Array.from(executionMessage)
      const executionVerification = p256Sha256P1363LowSVerify(signature, executionMessage, publicKey)
      executionMessage.fill(0, 0, 1)

      expect(yield* executionVerification).toBe(false)
      executionMessage.set(message.subarray(0, 1), 0)
      expect(yield* executionVerification).toBe(true)
      expect(yield* failureTag(p256Sha256P1363LowSVerify(signature, executionMessage, compressedPublicKey)))
        .toBe("InvalidVerificationInput")
      expect(yield* failureTag(p256Sha256P1363LowSVerify(signature.subarray(1), executionMessage, publicKey)))
        .toBe("InvalidVerificationInput")
      expect(yield* failureTag(p256Sha256P1363LowSVerify(derSignature, executionMessage, publicKey)))
        .toBe("InvalidVerificationInput")
      expect(yield* failureTag(p256Sha256P1363LowSVerify(signature, executionMessage, offCurvePublicKey)))
        .toBe("InvalidVerificationInput")
      expect(yield* failureTag(p256Sha256P1363LowSVerify(zeroR, executionMessage, publicKey)))
        .toBe("InvalidVerificationInput")
      expect(yield* failureTag(p256Sha256P1363LowSVerify(forcedHighSignature, executionMessage, publicKey)))
        .toBe("InvalidVerificationInput")
      expect(signature).toEqual(expectedSignature)
      expect(publicKey).toEqual(expectedPublicKey)
      expect(executionMessage).toEqual(expectedMessage)
    }))

  it.effect("freezes explicit ML-DSA-65 context, canonical hints, and signing entropy", () =>
    Effect.gen(function*() {
      const keyPair = yield* mlDsa65Keygen()
      const entropy = new Uint8Array(32).fill(0x42)
      const otherEntropy = new Uint8Array(32).fill(0x24)
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
      const malformedHint = Uint8Array.from(first.signature)
      malformedHint[3_303] = 56
      const executionContext = Uint8Array.of(0x11)
      const contextSignature = yield* mlDsa65SignHedged(
        message,
        keyPair.secretKey,
        keyPair.publicKey,
        executionContext,
        entropy
      )
      const executionVerification = mlDsa65Verify(
        contextSignature.signature,
        message,
        keyPair.publicKey,
        executionContext
      )
      const expectedSignature = Uint8Array.from(contextSignature.signature)
      const expectedPublicKey = Uint8Array.from(keyPair.publicKey)
      const expectedMessage = Uint8Array.from(message)
      const expectedContext = Uint8Array.from(executionContext)
      executionContext.fill(0x12)

      expect(first.signature).toEqual(repeated.signature)
      expect(first.signature).not.toEqual(changedEntropy.signature)
      expect(deterministicA.signature).toEqual(deterministicB.signature)
      expect(yield* executionVerification).toBe(false)
      executionContext.fill(0x11)
      expect(yield* executionVerification).toBe(true)
      expect(yield* mlDsa65Verify(first.signature, message, keyPair.publicKey, EMPTY_CONTEXT)).toBe(true)
      expect(yield* mlDsa65Verify(first.signature, message, keyPair.publicKey, Uint8Array.of(1))).toBe(false)
      expect(yield* failureTag(mlDsa65Verify(malformedHint, message, keyPair.publicKey, EMPTY_CONTEXT)))
        .toBe("InvalidVerificationInput")
      expect(
        yield* failureTag(mlDsa65Verify(
          first.signature,
          message,
          keyPair.publicKey,
          new Uint8Array(256)
        ))
      ).toBe("InvalidVerificationInput")
      expect(
        yield* Effect.flip(mlDsa65SignHedged(
          message,
          keyPair.secretKey,
          keyPair.publicKey,
          EMPTY_CONTEXT,
          new Uint8Array(31)
        )).pipe(Effect.map((error) => error._tag))
      ).toBe("SigningFailed")
      expect(contextSignature.signature).toEqual(expectedSignature)
      expect(keyPair.publicKey).toEqual(expectedPublicKey)
      expect(message).toEqual(expectedMessage)
      expect(executionContext).toEqual(expectedContext)
    }), 30_000)
})
