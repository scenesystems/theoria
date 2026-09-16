import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Option } from "effect"

import * as Hkdf from "../../src/Hkdf.js"
import { expectByteLength, expectDigest } from "../helpers/assertions.js"
import { encodeFixtureUtf8 } from "../helpers/bytes.js"
import { hkdfSha256Vectors } from "../helpers/vectors/hkdf.vectors.js"

describe("Hkdf.sha256", () => {
  it.effect("matches every RFC 5869 SHA-256 vector", () =>
    Effect.sync(() => {
      const cases = [hkdfSha256Vectors.case1, hkdfSha256Vectors.case2, hkdfSha256Vectors.case3]
      cases.forEach(({ ikm, info, length, okm, salt }) =>
        expectDigest(Either.getOrThrow(Hkdf.sha256(ikm, salt, info, length)), okm)
      )
    }))

  it.effect("treats absent salt as hash-length zero bytes", () =>
    Effect.sync(() => {
      const { ikm, info, length, okm } = hkdfSha256Vectors.case3
      expectDigest(Either.getOrThrow(Hkdf.sha256(ikm, Option.none(), info, length)), okm)
    }))

  it.effect("uses info for domain separation", () =>
    Effect.sync(() => {
      const { ikm, salt } = hkdfSha256Vectors.case1
      const first = Either.getOrThrow(Hkdf.sha256(ikm, salt, encodeFixtureUtf8("context-a"), 32))
      const second = Either.getOrThrow(Hkdf.sha256(ikm, salt, encodeFixtureUtf8("context-b"), 32))
      expect(first).not.toEqual(second)
    }))
})

describe("Hkdf output length admission", () => {
  const ikm = hkdfSha256Vectors.case1.ikm
  const salt = hkdfSha256Vectors.case1.salt
  const info = hkdfSha256Vectors.case1.info

  it.effect("allows zero and the inclusive SHA-256 and SHA-512 maxima", () =>
    Effect.sync(() => {
      expectByteLength(Either.getOrThrow(Hkdf.sha256(ikm, salt, info, 0)), 0)
      expectByteLength(Either.getOrThrow(Hkdf.sha512(ikm, salt, info, 0)), 0)
      expectByteLength(Either.getOrThrow(Hkdf.sha256(ikm, salt, info, 8160)), 8160)
      expectByteLength(Either.getOrThrow(Hkdf.sha512(ikm, salt, info, 16320)), 16320)
    }))

  it.effect("preserves the independent vector as the prefix of maximum SHA-256 output", () =>
    Effect.sync(() => {
      const maximum = Either.getOrThrow(Hkdf.sha256(ikm, salt, info, 8160))
      expectDigest(maximum.slice(0, hkdfSha256Vectors.case1.length), hkdfSha256Vectors.case1.okm)
    }))

  it.effect("rejects non-safe, fractional, negative, and over-maximum lengths", () =>
    Effect.sync(() => {
      const invalid = [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]
      invalid.forEach((length) => {
        expect(Hkdf.sha256(ikm, salt, info, length)).toStrictEqual(Either.left(new Hkdf.InvalidLength({})))
        expect(Hkdf.sha512(ikm, salt, info, length)).toStrictEqual(Either.left(new Hkdf.InvalidLength({})))
      })
      expect(Hkdf.sha256(ikm, salt, info, 8161)).toStrictEqual(Either.left(new Hkdf.InvalidLength({})))
      expect(Hkdf.sha512(ikm, salt, info, 16321)).toStrictEqual(Either.left(new Hkdf.InvalidLength({})))
    }))
})
