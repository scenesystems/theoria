import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { decapsulate, deriveSharedSecret, equalBytes, sign, verify } from "../../src/index.js"
import { agreementKnownVector, kemKnownVector, signatureKnownVectors } from "../helpers/knownVectors.js"

describe("algorithms/known-vectors", () => {
  it.effect(
    "matches deterministic signature known-answer fixtures across the released signature matrix",
    () =>
      Effect.forEach(
        signatureKnownVectors,
        (fixture) =>
          Effect.gen(function*() {
            const signature = yield* sign(fixture.algorithm, fixture.message, fixture.secretKey, fixture.publicKey)
            expect(equalBytes(signature.signature, fixture.expectedSignature)).toBe(true)
            expect(yield* verify(signature, fixture.message)).toBe(true)
          }),
        { discard: true }
      ),
    { timeout: 120_000 }
  )

  it.effect("matches the deterministic X25519 shared-secret fixture", () =>
    Effect.gen(function*() {
      const sharedSecret = yield* deriveSharedSecret(
        agreementKnownVector.algorithm,
        agreementKnownVector.aliceSecretKey,
        agreementKnownVector.bobPublicKey
      )

      expect(equalBytes(sharedSecret.sharedSecret, agreementKnownVector.expectedSharedSecret)).toBe(true)
    }))

  it.effect("matches the deterministic XWing decapsulation fixture", () =>
    Effect.gen(function*() {
      const sharedSecret = yield* decapsulate(
        kemKnownVector.algorithm,
        kemKnownVector.ciphertext,
        kemKnownVector.secretKey
      )

      expect(equalBytes(sharedSecret, kemKnownVector.expectedSharedSecret)).toBe(true)
    }))
})
