/**
 * Convenience HMAC function contract tests.
 *
 * Target-state TDD — these imports SHOULD exist once implemented.
 *
 * ### hmacSha256Base64Url(key, message) — HMAC + base64url
 * - RFC 4231 case 1 golden vector correctness
 * - Webhook scenario golden vector correctness
 * - 43-char output (256-bit MAC in base64url)
 * - Deterministic — same inputs always produce same output
 *
 * ### hmacSha1Hex(key, message) — legacy HMAC + hex
 * - RFC 2202 case 1 golden vector correctness
 * - RFC 2202 case 2 golden vector correctness
 * - 40-char lowercase hex output (160-bit MAC)
 * - Deterministic
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { hmacSha1Hex, hmacSha256Base64Url } from "../src/index.js"
import { hmacSha1HexVectors, hmacSha256Base64UrlVectors } from "./helpers/vectors/convenience.vectors.js"

// ---------------------------------------------------------------------------
// hmacSha256Base64Url
// ---------------------------------------------------------------------------
describe("hmacSha256Base64Url — HMAC-SHA256 + base64url encode", () => {
  it.effect("RFC 4231 case 1 — produces correct base64url MAC", () =>
    Effect.gen(function*() {
      const { key, message, expected } = hmacSha256Base64UrlVectors.case1
      const result = yield* hmacSha256Base64Url(key, message)
      expect(result).toBe(expected)
    }))

  it.effect("webhook scenario — produces correct base64url MAC", () =>
    Effect.gen(function*() {
      const { key, message, expected } = hmacSha256Base64UrlVectors.webhook
      const result = yield* hmacSha256Base64Url(key, message)
      expect(result).toBe(expected)
    }))

  it.effect("output is exactly 43 characters", () =>
    Effect.gen(function*() {
      const { key, message } = hmacSha256Base64UrlVectors.case1
      const result = yield* hmacSha256Base64Url(key, message)
      expect(result.length).toBe(43)
    }))

  it.effect("is deterministic — same inputs produce same output", () =>
    Effect.gen(function*() {
      const { key, message } = hmacSha256Base64UrlVectors.case1
      const a = yield* hmacSha256Base64Url(key, message)
      const b = yield* hmacSha256Base64Url(key, message)
      expect(a).toBe(b)
    }))
})

// ---------------------------------------------------------------------------
// hmacSha1Hex
// ---------------------------------------------------------------------------
describe("hmacSha1Hex — legacy HMAC-SHA1 + hex encode", () => {
  it.effect("RFC 2202 case 1 — produces correct hex MAC", () =>
    Effect.gen(function*() {
      const { key, message, expected } = hmacSha1HexVectors.case1
      const result = yield* hmacSha1Hex(key, message)
      expect(result).toBe(expected)
    }))

  it.effect("RFC 2202 case 2 — produces correct hex MAC", () =>
    Effect.gen(function*() {
      const { key, message, expected } = hmacSha1HexVectors.case2
      const result = yield* hmacSha1Hex(key, message)
      expect(result).toBe(expected)
    }))

  it.effect("output is exactly 40 characters of lowercase hex", () =>
    Effect.gen(function*() {
      const { key, message } = hmacSha1HexVectors.case1
      const result = yield* hmacSha1Hex(key, message)
      expect(result.length).toBe(40)
      expect(result).toMatch(/^[0-9a-f]{40}$/)
    }))

  it.effect("is deterministic — same inputs produce same output", () =>
    Effect.gen(function*() {
      const { key, message } = hmacSha1HexVectors.case1
      const a = yield* hmacSha1Hex(key, message)
      const b = yield* hmacSha1Hex(key, message)
      expect(a).toBe(b)
    }))
})
