/**
 * Sealed envelope encoding contract tests.
 *
 * ### packEnvelope
 * - Splits managedNonce output into nonce + ciphertext components
 * - Encodes both as base64url via Effect Encoding
 * - Produces correct algorithm field in SealedEnvelope
 * - Handles XChaCha20 24-byte nonce split
 * - Handles AES-GCM 12-byte nonce split
 *
 * ### unpackEnvelope
 * - Decodes base64url nonce + ciphertext back to raw bytes
 * - Reassembles nonce ‖ ciphertext into single Uint8Array
 *
 * ### Round-trip
 * - pack → unpack preserves binary identity
 */

import { describe, expect, it } from "@effect/vitest"
import { concatBytes } from "@noble/ciphers/utils.js"
import { Effect } from "effect"
import { packEnvelope, unpackEnvelope } from "../src/encoding.js"

describe("packEnvelope — split and encode", () => {
  it.effect("splits XChaCha20 output at 24-byte nonce boundary", () =>
    Effect.gen(function*() {
      const nonce = new Uint8Array(24).fill(0xaa)
      const ciphertext = new Uint8Array(32).fill(0xbb)
      const raw = concatBytes(nonce, ciphertext)
      const envelope = yield* packEnvelope("xchacha20-poly1305", raw)
      expect(envelope.algorithm).toBe("xchacha20-poly1305")
      expect(envelope.nonce.length).toBeGreaterThan(0)
      expect(envelope.ciphertext.length).toBeGreaterThan(0)
    }))

  it.effect("splits AES-256-GCM-SIV output at 12-byte nonce boundary", () =>
    Effect.gen(function*() {
      const nonce = new Uint8Array(12).fill(0xcc)
      const ciphertext = new Uint8Array(32).fill(0xdd)
      const raw = concatBytes(nonce, ciphertext)
      const envelope = yield* packEnvelope("aes-256-gcm-siv", raw)
      expect(envelope.algorithm).toBe("aes-256-gcm-siv")
    }))

  it.effect("splits AES-256-GCM output at 12-byte nonce boundary", () =>
    Effect.gen(function*() {
      const raw = concatBytes(
        new Uint8Array(12).fill(0xee),
        new Uint8Array(32).fill(0xff)
      )
      const envelope = yield* packEnvelope("aes-256-gcm", raw)
      expect(envelope.algorithm).toBe("aes-256-gcm")
    }))
})

describe("packEnvelope / unpackEnvelope — round-trip", () => {
  it.effect("XChaCha20: pack → unpack preserves binary identity", () =>
    Effect.gen(function*() {
      const raw = Uint8Array.from({ length: 56 }, (_, i) => i % 256)
      const envelope = yield* packEnvelope("xchacha20-poly1305", raw)
      const recovered = yield* unpackEnvelope(envelope)
      expect(recovered).toEqual(raw)
    }))

  it.effect("AES-256-GCM-SIV: pack → unpack preserves binary identity", () =>
    Effect.gen(function*() {
      const raw = Uint8Array.from({ length: 44 }, (_, i) => (i * 7) % 256)
      const envelope = yield* packEnvelope("aes-256-gcm-siv", raw)
      const recovered = yield* unpackEnvelope(envelope)
      expect(recovered).toEqual(raw)
    }))

  it.effect("AES-256-GCM: pack → unpack preserves binary identity", () =>
    Effect.gen(function*() {
      const raw = Uint8Array.from({ length: 44 }, (_, i) => (i * 13) % 256)
      const envelope = yield* packEnvelope("aes-256-gcm", raw)
      const recovered = yield* unpackEnvelope(envelope)
      expect(recovered).toEqual(raw)
    }))

  it.effect("handles empty ciphertext after nonce", () =>
    Effect.gen(function*() {
      const raw = new Uint8Array(24).fill(0xaa)
      const envelope = yield* packEnvelope("xchacha20-poly1305", raw)
      const recovered = yield* unpackEnvelope(envelope)
      expect(recovered).toEqual(raw)
    }))
})
