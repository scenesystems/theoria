import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { ed25519Keygen } from "../src/algorithms/ed25519.js"
import * as Sign from "../src/index.js"
import { VerifyManyDetachedSignatureRequest, VerifyManySignatureRequest } from "../src/schemas/VerifyMany.js"

const message = new TextEncoder().encode("verify many surface")

describe("verifyMany surface", () => {
  it.effect("exports the additive multi-item verification surface without changing single-item verify semantics", () =>
    Effect.gen(function*() {
      const keys = yield* ed25519Keygen()
      const signature = yield* Sign.sign("ed25519", message, keys.secretKey, keys.publicKey)
      const detached = yield* Sign.signDetached("ed25519", message, keys.secretKey, keys.publicKey)

      const singleSelfDescribing = yield* Sign.verify(signature, message)
      const singleDetached = yield* Sign.verifyDetached(detached, message, keys.publicKey)
      const report = yield* Sign.verifyMany([
        new VerifyManySignatureRequest({
          kind: "self-describing",
          message,
          signature
        }),
        new VerifyManyDetachedSignatureRequest({
          kind: "detached",
          message,
          signature: detached,
          publicKey: keys.publicKey
        })
      ])

      expect(typeof Sign.verifyMany).toBe("function")
      expect(Sign.VerifyManyReport).toBeDefined()
      expect(Sign.VerifyManySignatureRequest).toBeDefined()
      expect(Sign.VerifyManyDetachedSignatureRequest).toBeDefined()
      expect(singleSelfDescribing).toBe(true)
      expect(singleDetached).toBe(true)
      expect(report.allValid).toBe(true)
      expect(report.results.map((result) => result._tag)).toEqual([
        "VerifyManyPass",
        "VerifyManyPass"
      ])
    }))
})
