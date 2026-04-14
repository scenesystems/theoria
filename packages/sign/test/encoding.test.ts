/**
 * Encoding utility contract tests.
 *
 * ### utf8ToBytes
 * - ASCII round-trip through toHex
 * - Unicode multi-byte encoding
 * - Empty string edge case
 *
 * ### toHex
 * - Known byte vector → lowercase hex
 * - Single byte
 * - Empty input
 *
 * ### equalBytes
 * - Identical content → true
 * - Different content, same length → false
 * - Different lengths → false
 * - Empty arrays → true
 * - Constant-time property (no early exit on length mismatch — Noble handles this)
 */

import { describe, expect, it } from "@effect/vitest"
import { Either } from "effect"
import { equalBytes, fromBase64Url, toBase64Url, toHex, utf8ToBytes } from "../src/encoding.js"

describe("utf8ToBytes", () => {
  it("encodes ASCII correctly", () => {
    const bytes = utf8ToBytes("hello")
    expect(toHex(bytes)).toBe("68656c6c6f")
  })

  it("encodes unicode multi-byte characters", () => {
    const bytes = utf8ToBytes("é")
    // é is U+00E9, UTF-8: 0xC3 0xA9
    expect(toHex(bytes)).toBe("c3a9")
  })

  it("handles empty string", () => {
    const bytes = utf8ToBytes("")
    expect(bytes).toEqual(new Uint8Array(0))
  })

  it("encodes emoji (4-byte UTF-8)", () => {
    const bytes = utf8ToBytes("🔑")
    // U+1F511, UTF-8: F0 9F 94 91
    expect(toHex(bytes)).toBe("f09f9491")
  })
})

describe("toHex", () => {
  it("encodes known bytes to lowercase hex", () => {
    const bytes = Uint8Array.from([0x0a, 0xff, 0x00, 0x7f])
    expect(toHex(bytes)).toBe("0aff007f")
  })

  it("encodes single byte", () => {
    expect(toHex(Uint8Array.from([0xab]))).toBe("ab")
  })

  it("handles empty input", () => {
    expect(toHex(new Uint8Array(0))).toBe("")
  })

  it("produces 2 chars per byte", () => {
    const bytes = new Uint8Array(32).fill(0xde)
    expect(toHex(bytes).length).toBe(64)
  })
})

describe("base64url codecs", () => {
  it("round-trips bytes through url-safe encoding", () => {
    const bytes = Uint8Array.from([0xff, 0x01, 0x7f, 0x20])
    const encoded = toBase64Url(bytes)
    const decoded = fromBase64Url(encoded)

    expect(encoded.includes("+")).toBe(false)
    expect(encoded.includes("/")).toBe(false)
    expect(encoded.includes("=")).toBe(false)
    expect(Either.isRight(decoded)).toBe(true)

    if (Either.isRight(decoded)) {
      expect(decoded.right).toEqual(bytes)
    }
  })

  it("rejects malformed base64url payloads", () => {
    const decoded = fromBase64Url("***not-base64url***")
    expect(Either.isLeft(decoded)).toBe(true)
  })
})

describe("equalBytes", () => {
  it("returns true for identical content", () => {
    const a = Uint8Array.from([1, 2, 3, 4, 5])
    const b = Uint8Array.from([1, 2, 3, 4, 5])
    expect(equalBytes(a, b)).toBe(true)
  })

  it("returns false for different content, same length", () => {
    const a = Uint8Array.from([1, 2, 3])
    const b = Uint8Array.from([1, 2, 4])
    expect(equalBytes(a, b)).toBe(false)
  })

  it("returns false for different lengths", () => {
    const a = Uint8Array.from([1, 2, 3])
    const b = Uint8Array.from([1, 2])
    expect(equalBytes(a, b)).toBe(false)
  })

  it("returns true for empty arrays", () => {
    expect(equalBytes(new Uint8Array(0), new Uint8Array(0))).toBe(true)
  })

  it("detects single-bit difference", () => {
    const a = Uint8Array.from([0b11111111])
    const b = Uint8Array.from([0b11111110])
    expect(equalBytes(a, b)).toBe(false)
  })
})
