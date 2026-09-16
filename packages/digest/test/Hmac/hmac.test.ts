import { describe, expect, it } from "@effect/vitest"
import { Effect, Encoding } from "effect"

import * as Hmac from "../../src/Hmac.js"
import { expectByteLength, expectDigest } from "../helpers/assertions.js"
import { encodeFixtureUtf8 } from "../helpers/bytes.js"
import { hmacSha1Vectors, hmacSha256Vectors, webhookVector } from "../helpers/vectors/hmac.vectors.js"

describe("Hmac.sha256", () => {
  it.effect("matches RFC 4231 vectors", () =>
    Effect.sync(() => {
      const cases = [
        hmacSha256Vectors.case1,
        hmacSha256Vectors.case2,
        hmacSha256Vectors.case3,
        hmacSha256Vectors.case4
      ]
      cases.forEach(({ data, expected, key }) => expectDigest(Hmac.sha256(key, data), expected))
    }))

  it.effect("supports empty messages and keys on both sides of the block length", () =>
    Effect.sync(() => {
      expectByteLength(Hmac.sha256(new Uint8Array(32), new Uint8Array()), 32)
      expectByteLength(Hmac.sha256(new Uint8Array(4).fill(0x0b), encodeFixtureUtf8("test")), 32)
      expectByteLength(Hmac.sha256(new Uint8Array(128).fill(0xaa), encodeFixtureUtf8("test")), 32)
    }))

  it.effect("composes with Effect Encoding for base64url output", () =>
    Effect.sync(() => {
      const { expected, key, message } = webhookVector
      expect(Encoding.encodeBase64Url(Hmac.sha256(key, message))).toBe(expected)
    }))
})

describe("Hmac.sha1", () => {
  it.effect("matches RFC 2202 vectors", () =>
    Effect.sync(() => {
      expectDigest(Hmac.sha1(hmacSha1Vectors.case1.key, hmacSha1Vectors.case1.data), hmacSha1Vectors.case1.expected)
      expectDigest(Hmac.sha1(hmacSha1Vectors.case2.key, hmacSha1Vectors.case2.data), hmacSha1Vectors.case2.expected)
      expectByteLength(Hmac.sha1(hmacSha1Vectors.case1.key, hmacSha1Vectors.case1.data), 20)
    }))

  it.effect("composes with Effect Encoding for hexadecimal output", () =>
    Effect.sync(() => {
      const { data, expected, key } = hmacSha1Vectors.case2
      expect(Encoding.encodeHex(Hmac.sha1(key, data))).toBe(expected)
    }))
})
