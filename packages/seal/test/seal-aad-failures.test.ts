import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"

import { DecryptionFailed, InvalidAssociatedData } from "../src/schemas/errors.js"
import { seal, unseal } from "../src/seal.js"
import { plaintext, validKey } from "./helpers/keys.js"

const associatedData = new Uint8Array([2, 4, 6, 8])
const differentAssociatedData = new Uint8Array([8, 6, 4, 2])

describe("seal associated data failures", () => {
  it.effect("fails decryption when associated data differs", () =>
    Effect.gen(function*() {
      const envelope = yield* seal("xchacha20-poly1305", validKey, plaintext, {}, associatedData)
      const exit = yield* Effect.exit(unseal(validKey, envelope, differentAssociatedData))

      expect(exit).toStrictEqual(
        Exit.fail(
          new DecryptionFailed({
            algorithm: "xchacha20-poly1305",
            reason: "authentication failed"
          })
        )
      )
    }))

  it.effect("fails decryption when associated data is omitted", () =>
    Effect.gen(function*() {
      const envelope = yield* seal("aes-256-gcm-siv", validKey, plaintext, {}, associatedData)
      const exit = yield* Effect.exit(unseal(validKey, envelope))

      expect(exit).toStrictEqual(
        Exit.fail(
          new DecryptionFailed({
            algorithm: "aes-256-gcm-siv",
            reason: "authentication failed"
          })
        )
      )
    }))

  it.effect("fails malformed associated data through InvalidAssociatedData", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(seal("aes-256-gcm", validKey, plaintext, {}, new Uint8Array()))

      expect(exit).toStrictEqual(
        Exit.fail(
          new InvalidAssociatedData({
            algorithm: "aes-256-gcm",
            reason: "associated data must be a non-empty Uint8Array when provided"
          })
        )
      )
    }))
})
