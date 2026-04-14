import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { ed25519Keygen } from "../src/algorithms/ed25519.js"
import { secp256k1EcdsaKeygen } from "../src/algorithms/secp256k1.js"
import { DetachedSignature } from "../src/schemas/DetachedSignature.js"
import { Signature } from "../src/schemas/Signature.js"
import { VerifyManyDetachedSignatureRequest, VerifyManySignatureRequest } from "../src/schemas/VerifyMany.js"
import { sign, signDetached, verifyMany } from "../src/sign.js"

const message = new TextEncoder().encode("verify many failure contract")

describe("verifyMany failure reporting", () => {
  it.effect("surfaces malformed signatures, wrong messages, and detached key mismatches as per-item outcomes", () =>
    Effect.gen(function*() {
      const signer = yield* ed25519Keygen()
      const wrongVerifier = yield* ed25519Keygen()
      const secp256k1Keys = yield* secp256k1EcdsaKeygen()

      const validSignature = yield* sign("ed25519", message, signer.secretKey, signer.publicKey)
      const detached = yield* signDetached(
        "secp256k1-ecdsa",
        message,
        secp256k1Keys.secretKey,
        secp256k1Keys.publicKey
      )

      const malformedSignature = new Signature({
        algorithm: "ed25519",
        signature: validSignature.signature.subarray(0, 8),
        publicKey: signer.publicKey
      })
      const malformedDetached = new DetachedSignature({
        algorithm: detached.algorithm,
        signature: detached.signature.subarray(0, 8)
      })

      const report = yield* verifyMany([
        new VerifyManySignatureRequest({
          kind: "self-describing",
          message: new TextEncoder().encode("wrong message"),
          signature: validSignature
        }),
        new VerifyManySignatureRequest({
          kind: "self-describing",
          message,
          signature: malformedSignature
        }),
        new VerifyManyDetachedSignatureRequest({
          kind: "detached",
          message,
          signature: malformedDetached,
          publicKey: wrongVerifier.publicKey
        })
      ])

      expect(report.allValid).toBe(false)
      expect(report.verifiedCount).toBe(0)
      expect(report.failedCount).toBe(3)
      expect(report.results.map((result) => result._tag)).toEqual([
        "VerifyManyMismatch",
        "VerifyManyError",
        "VerifyManyError"
      ])
      expect(report.results[0]?.algorithm).toBe("ed25519")
      expect(report.results[1]?._tag).toBe("VerifyManyError")
      expect(report.results[1]?._tag === "VerifyManyError" ? report.results[1].error._tag : undefined).toBe(
        "VerificationFailed"
      )
      expect(report.results[2]?._tag === "VerifyManyError" ? report.results[2].algorithm : undefined).toBe(
        "secp256k1-ecdsa"
      )
    }))
})
