import { describe, expect, it } from "@effect/vitest"
import { Effect, Result } from "effect"

import * as Digest from "@scenesystems/digest/Digest"
import * as Utf8 from "@scenesystems/digest/Utf8"
import { expectDigest } from "../helpers/assertions.js"
import { hashVectors } from "../helpers/vectors/blake3.js"
import { sha256Vectors } from "../helpers/vectors/sha256.js"

describe("Digest.hashString", () => {
  it.effect("matches BLAKE3-256 and SHA-256 known answers", () =>
    Effect.gen(function*() {
      expectDigest(yield* Digest.hashString("blake3-256", "abc"), hashVectors.abc)
      expectDigest(yield* Digest.hashString("sha256", "abc"), sha256Vectors.abc)
    }))

  it.effect("equals strict UTF-8 encoding followed by byte hashing", () =>
    Effect.gen(function*() {
      const text = "scene 😀 e\u0301"
      const bytes = yield* Utf8.encode(text)
      expect(yield* Digest.hashString("sha256", text)).toStrictEqual(yield* Digest.hash("sha256", bytes))
    }))

  it.effect("returns InvalidUnicode for malformed text", () =>
    Effect.gen(function*() {
      expect(yield* Effect.result(Digest.hashString("blake3-256", "ok\uD800"))).toStrictEqual(
        Result.fail(new Utf8.InvalidUnicode({ kind: "lone-high-surrogate", codeUnitIndex: 2 }))
      )
    }))
})
