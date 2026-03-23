/**
 * Base64url and hex encoding contract tests.
 *
 * ### base64url (RFC 4648 §5)
 * - Round-trip encode/decode identity
 * - 32-byte digest → 43-char output
 * - No padding characters
 * - URL-safe alphabet only
 * - Empty input edge case
 *
 * ### hex
 * - Round-trip encode/decode identity
 * - Lowercase 2-chars-per-byte output
 * - Single byte round-trip
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { fromBase64Url, fromHex, toBase64Url, toHex } from "../src/encoding.js"

describe("toBase64Url / fromBase64Url — round-trip", () => {
  it.effect("round-trip identity for arbitrary bytes", () =>
    Effect.gen(function*() {
      const input = Uint8Array.from([0, 1, 127, 128, 255, 42, 99])
      const encoded = yield* toBase64Url(input)
      const decoded = yield* fromBase64Url(encoded)
      expect(decoded).toEqual(input)
    }))

  it.effect("32-byte digest encodes to exactly 43 chars", () =>
    Effect.gen(function*() {
      const input = new Uint8Array(32).fill(0xab)
      const encoded = yield* toBase64Url(input)
      expect(encoded.length).toBe(43)
    }))

  it.effect("no padding characters in output", () =>
    Effect.gen(function*() {
      const encoded = yield* toBase64Url(new Uint8Array(32))
      expect(encoded).not.toContain("=")
    }))

  it.effect("URL-safe alphabet only — no + or /", () =>
    Effect.gen(function*() {
      const input = Uint8Array.from([0xfb, 0xff, 0xfe, 0x3e, 0x3f])
      const encoded = yield* toBase64Url(input)
      expect(encoded).not.toContain("+")
      expect(encoded).not.toContain("/")
    }))

  it.effect("empty input round-trips", () =>
    Effect.gen(function*() {
      const encoded = yield* toBase64Url(new Uint8Array(0))
      const decoded = yield* fromBase64Url(encoded)
      expect(decoded).toEqual(new Uint8Array(0))
    }))
})

describe("toHex / fromHex — round-trip", () => {
  it.effect("round-trip identity for arbitrary bytes", () =>
    Effect.gen(function*() {
      const input = Uint8Array.from([0, 1, 127, 128, 255, 42, 99])
      const encoded = yield* toHex(input)
      const decoded = yield* fromHex(encoded)
      expect(decoded).toEqual(input)
    }))

  it.effect("hex produces lowercase 2-chars-per-byte", () =>
    Effect.gen(function*() {
      const input = Uint8Array.from([0x0a, 0xff])
      const encoded = yield* toHex(input)
      expect(encoded).toBe("0aff")
    }))

  it.effect("single byte round-trips correctly", () =>
    Effect.gen(function*() {
      const input = Uint8Array.from([0xff])
      const encoded = yield* toHex(input)
      expect(encoded).toBe("ff")
      const decoded = yield* fromHex(encoded)
      expect(decoded).toEqual(input)
    }))
})
