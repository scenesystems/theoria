import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import * as Digest from "@scenesystems/digest/Digest"
import { expectByteLength, expectDigest } from "../helpers/assertions.js"
import { encodeFixtureUtf8 } from "../helpers/bytes.js"
import { hashVectors } from "../helpers/vectors/blake3.js"
import { sha256Vectors } from "../helpers/vectors/sha256.js"

describe("Digest.hash", () => {
  it.effect("matches independent BLAKE3 vectors", () =>
    Effect.sync(() => {
      expectDigest(Digest.hash("blake3-256", new Uint8Array()), hashVectors.empty)
      expectDigest(Digest.hash("blake3-256", encodeFixtureUtf8("abc")), hashVectors.abc)
      expectDigest(Digest.hash("blake3-256", encodeFixtureUtf8("hello 🌍")), hashVectors.utf8Emoji)
    }))

  it.effect("matches independent SHA-256 vectors", () =>
    Effect.sync(() => {
      expectDigest(Digest.hash("sha256", new Uint8Array()), sha256Vectors.empty)
      expectDigest(Digest.hash("sha256", encodeFixtureUtf8("abc")), sha256Vectors.abc)
      expectDigest(
        Digest.hash("sha256", encodeFixtureUtf8("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")),
        sha256Vectors.twoBlock
      )
    }))

  it.effect("returns deterministic 32-byte results and separates algorithms", () =>
    Effect.sync(() => {
      const input = encodeFixtureUtf8("determinism check")
      const blake3 = Digest.hash("blake3-256", input)
      const sha256 = Digest.hash("sha256", input)
      expectByteLength(blake3, 32)
      expectByteLength(sha256, 32)
      expect(Digest.hash("sha256", input)).toEqual(sha256)
      expect(blake3).not.toEqual(sha256)
    }))
})
