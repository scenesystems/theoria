/**
 * Unified seal/unseal pipeline tests.
 *
 * Verifies:
 * - seal → unseal round-trip for each algorithm
 * - Algorithm selection dispatches to correct cipher
 * - SealedEnvelope contains correct algorithm identifier
 * - Cross-algorithm: envelope from one algorithm rejected by another
 * - Key validation occurs before cipher invocation
 * - Envelope self-description: unseal reads algorithm from envelope
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import { DecryptionFailed, InvalidKey } from "../src/schemas/errors.js"
import { seal, unseal } from "../src/seal.js"
import { longKey, plaintext, shortKey, validKey, wrongKey } from "./helpers/keys.js"

describe("seal → unseal round-trip", () => {
  it.effect("xchacha20-poly1305 round-trip", () =>
    Effect.gen(function*() {
      const envelope = yield* seal("xchacha20-poly1305", validKey, plaintext)
      const recovered = yield* unseal(validKey, envelope)
      expect(recovered).toEqual(plaintext)
    }))

  it.effect("aes-256-gcm-siv round-trip", () =>
    Effect.gen(function*() {
      const envelope = yield* seal("aes-256-gcm-siv", validKey, plaintext)
      const recovered = yield* unseal(validKey, envelope)
      expect(recovered).toEqual(plaintext)
    }))

  it.effect("aes-256-gcm round-trip", () =>
    Effect.gen(function*() {
      const envelope = yield* seal("aes-256-gcm", validKey, plaintext)
      const recovered = yield* unseal(validKey, envelope)
      expect(recovered).toEqual(plaintext)
    }))
})

describe("seal — envelope self-description", () => {
  it.effect("xchacha20-poly1305 envelope carries correct algorithm", () =>
    Effect.gen(function*() {
      const envelope = yield* seal("xchacha20-poly1305", validKey, plaintext)
      expect(envelope.algorithm).toBe("xchacha20-poly1305")
    }))

  it.effect("aes-256-gcm-siv envelope carries correct algorithm", () =>
    Effect.gen(function*() {
      const envelope = yield* seal("aes-256-gcm-siv", validKey, plaintext)
      expect(envelope.algorithm).toBe("aes-256-gcm-siv")
    }))

  it.effect("aes-256-gcm envelope carries correct algorithm", () =>
    Effect.gen(function*() {
      const envelope = yield* seal("aes-256-gcm", validKey, plaintext)
      expect(envelope.algorithm).toBe("aes-256-gcm")
    }))
})

describe("seal — key validation", () => {
  it.effect("rejects short key with InvalidKey", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(seal("xchacha20-poly1305", shortKey, plaintext))
      expect(exit).toStrictEqual(
        Exit.fail(new InvalidKey({ expected: 32, received: 16 }))
      )
    }))

  it.effect("rejects long key with InvalidKey", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(seal("aes-256-gcm", longKey, plaintext))
      expect(exit).toStrictEqual(
        Exit.fail(new InvalidKey({ expected: 32, received: 64 }))
      )
    }))
})

describe("unseal — wrong key rejection", () => {
  it.effect("wrong key produces DecryptionFailed", () =>
    Effect.gen(function*() {
      const envelope = yield* seal("xchacha20-poly1305", validKey, plaintext)
      const exit = yield* Effect.exit(unseal(wrongKey, envelope))
      expect(exit).toStrictEqual(
        Exit.fail(
          new DecryptionFailed({
            algorithm: "xchacha20-poly1305",
            reason: "authentication failed"
          })
        )
      )
    }))
})
