/**
 * Schema type contract tests.
 *
 * ### DigestAlgorithm
 * - Accepts "blake3-256" and "sha256"
 * - Rejects unknown strings
 *
 * ### Digest256
 * - Accepts valid 43-char base64url strings
 * - Rejects wrong length
 * - Rejects non-base64url characters
 *
 * ### ContentDigest
 * - Accepts valid algorithm + digest pair
 * - Rejects unknown algorithm
 */

import { describe, expect, it } from "@effect/vitest"
import { Either, Schema } from "effect"
import { ContentDigest } from "../../src/schemas/ContentDigest.js"
import { Digest256 } from "../../src/schemas/Digest256.js"
import { DigestAlgorithm } from "../../src/schemas/DigestAlgorithm.js"

const validBase64Url43 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq"

describe("DigestAlgorithm — literal union", () => {
  it("accepts \"blake3-256\"", () => {
    const result = Schema.decodeUnknownEither(DigestAlgorithm)("blake3-256")
    expect(Either.isRight(result)).toBe(true)
  })

  it("accepts \"sha256\"", () => {
    const result = Schema.decodeUnknownEither(DigestAlgorithm)("sha256")
    expect(Either.isRight(result)).toBe(true)
  })

  it("rejects unknown algorithm string", () => {
    const result = Schema.decodeUnknownEither(DigestAlgorithm)("md5")
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe("Digest256 — branded 43-char base64url", () => {
  it("accepts valid 43-char base64url string", () => {
    const result = Schema.decodeUnknownEither(Digest256)(validBase64Url43)
    expect(Either.isRight(result)).toBe(true)
  })

  it("rejects 42-char string — too short", () => {
    const result = Schema.decodeUnknownEither(Digest256)(validBase64Url43.slice(0, 42))
    expect(Either.isLeft(result)).toBe(true)
  })

  it("rejects 44-char string — too long", () => {
    const result = Schema.decodeUnknownEither(Digest256)(validBase64Url43 + "x")
    expect(Either.isLeft(result)).toBe(true)
  })

  it("rejects string with non-base64url chars (+, /)", () => {
    const invalid = validBase64Url43.slice(0, 41) + "+/"
    const result = Schema.decodeUnknownEither(Digest256)(invalid)
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe("ContentDigest — algorithm-tagged digest pair", () => {
  it("accepts valid algorithm + digest pair", () => {
    const result = Schema.decodeUnknownEither(ContentDigest)({
      algorithm: "blake3-256",
      digest: validBase64Url43
    })
    expect(Either.isRight(result)).toBe(true)
  })

  it("rejects unknown algorithm", () => {
    const result = Schema.decodeUnknownEither(ContentDigest)({
      algorithm: "md5",
      digest: validBase64Url43
    })
    expect(Either.isLeft(result)).toBe(true)
  })
})
