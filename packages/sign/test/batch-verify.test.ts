import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { ed25519Keygen } from "../src/algorithms/ed25519.js"
import { mlDsa65Keygen } from "../src/algorithms/mlDsa.js"
import { secp256k1EcdsaKeygen } from "../src/algorithms/secp256k1.js"
import { VerifyManyDetachedSignatureRequest, VerifyManySignatureRequest } from "../src/schemas/VerifyMany.js"
import { sign, signDetached, verifyMany } from "../src/sign.js"

const message = new TextEncoder().encode("verify many contract")

describe("verifyMany", () => {
  it.effect("preserves input order across mixed self-describing and detached requests", () =>
    Effect.gen(function*() {
      const ed25519Keys = yield* ed25519Keygen()
      const secp256k1Keys = yield* secp256k1EcdsaKeygen()
      const mlDsaKeys = yield* mlDsa65Keygen()

      const ed25519Signature = yield* sign("ed25519", message, ed25519Keys.secretKey, ed25519Keys.publicKey)
      const secp256k1Signature = yield* signDetached(
        "secp256k1-ecdsa",
        message,
        secp256k1Keys.secretKey,
        secp256k1Keys.publicKey
      )
      const mlDsaSignature = yield* signDetached("ml-dsa-65", message, mlDsaKeys.secretKey, mlDsaKeys.publicKey)

      const report = yield* verifyMany([
        new VerifyManySignatureRequest({
          kind: "self-describing",
          message,
          signature: ed25519Signature
        }),
        new VerifyManyDetachedSignatureRequest({
          kind: "detached",
          message,
          signature: secp256k1Signature,
          publicKey: secp256k1Keys.publicKey
        }),
        new VerifyManyDetachedSignatureRequest({
          kind: "detached",
          message,
          signature: mlDsaSignature,
          publicKey: mlDsaKeys.publicKey
        })
      ])

      expect(report.allValid).toBe(true)
      expect(report.verifiedCount).toBe(3)
      expect(report.failedCount).toBe(0)
      expect(report.results.map((result) => result.index)).toEqual([0, 1, 2])
      expect(report.results.map((result) => result.algorithm)).toEqual([
        "ed25519",
        "secp256k1-ecdsa",
        "ml-dsa-65"
      ])
      expect(report.results.map((result) => result._tag)).toEqual([
        "VerifyManyPass",
        "VerifyManyPass",
        "VerifyManyPass"
      ])
    }), { timeout: 30_000 })

  it.effect("reports aggregate pass and fail counts without hiding valid items", () =>
    Effect.gen(function*() {
      const keys = yield* ed25519Keygen()
      const goodSignature = yield* sign("ed25519", message, keys.secretKey, keys.publicKey)
      const badMessage = new TextEncoder().encode("tampered verify many contract")

      const report = yield* verifyMany([
        new VerifyManySignatureRequest({
          kind: "self-describing",
          message,
          signature: goodSignature
        }),
        new VerifyManySignatureRequest({
          kind: "self-describing",
          message: badMessage,
          signature: goodSignature
        })
      ])

      expect(report.allValid).toBe(false)
      expect(report.verifiedCount).toBe(1)
      expect(report.failedCount).toBe(1)
      expect(report.results.map((result) => result._tag)).toEqual([
        "VerifyManyPass",
        "VerifyManyMismatch"
      ])
    }))
})
