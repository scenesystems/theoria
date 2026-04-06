import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { ed25519Keygen } from "../src/algorithms/ed25519.js"
import * as Sign from "../src/index.js"
import { BatchVerifyDetachedSignatureRequest, BatchVerifySignatureRequest } from "../src/schemas/BatchVerification.js"

const message = new TextEncoder().encode("batch verification surface")

describe("batchVerify surface", () => {
  it.effect("exports the additive batch surface without changing single-item verify semantics", () =>
    Effect.gen(function*() {
      const keys = yield* ed25519Keygen()
      const signature = yield* Sign.sign("ed25519", message, keys.secretKey, keys.publicKey)
      const detached = yield* Sign.signDetached("ed25519", message, keys.secretKey, keys.publicKey)

      const singleSelfDescribing = yield* Sign.verify(signature, message)
      const singleDetached = yield* Sign.verifyDetached(detached, message, keys.publicKey)
      const report = yield* Sign.batchVerify([
        new BatchVerifySignatureRequest({
          kind: "self-describing",
          message,
          signature
        }),
        new BatchVerifyDetachedSignatureRequest({
          kind: "detached",
          message,
          signature: detached,
          publicKey: keys.publicKey
        })
      ])

      expect(typeof Sign.batchVerify).toBe("function")
      expect(Sign.BatchVerifyReport).toBeDefined()
      expect(Sign.BatchVerifySignatureRequest).toBeDefined()
      expect(Sign.BatchVerifyDetachedSignatureRequest).toBeDefined()
      expect(singleSelfDescribing).toBe(true)
      expect(singleDetached).toBe(true)
      expect(report.allValid).toBe(true)
      expect(report.results.map((result) => result._tag)).toEqual([
        "BatchVerifyPass",
        "BatchVerifyPass"
      ])
    }))
})
