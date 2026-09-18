import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import * as Hmac from "@scenesystems/digest/Hmac"
import { Effect, Encoding, Number as Num, Schema } from "effect"

import * as Fixtures from "../scripts/fixtures.js"
import { expectByteLength, expectDigest } from "./helpers/assertions.js"
import { encodeFixtureUtf8, hexToBytes } from "./helpers/bytes.js"
import { expectStringMatch } from "./helpers/mismatchDiagnostics.js"
import { hmacSha1Vectors, hmacSha256Vectors, webhookVector } from "./helpers/vectors/hmac.js"

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

describe("Hmac external conformance", () => {
  it.effect("matches all seven RFC cases for HMAC-SHA1 and HMAC-SHA256", () =>
    Effect.gen(function*() {
      const manifest = yield* Fixtures.loadManifest
      const sources = Fixtures.sourcesOfKind(manifest, "hmac")
      const fixtures = yield* Effect.forEach(sources, (source) =>
        Fixtures.read(source.fixturePath).pipe(
          Effect.flatMap(Schema.decodeUnknown(Fixtures.Hmac, { onExcessProperty: "error" })),
          Effect.map((fixture) => ({ fixture, source }))
        ))

      yield* Effect.forEach(fixtures, ({ fixture, source }) =>
        Effect.forEach(fixture.cases, (vector) =>
          Effect.sync(() => {
            const key = hexToBytes(vector.keyHex)
            const message = hexToBytes(vector.messageHex)
            const result = fixture.algorithm === "hmac-sha1"
              ? Hmac.sha1(key, message)
              : Hmac.sha256(key, message)
            const actual = Encoding.encodeHex(result.slice(0, vector.outputLength))

            expect(vector.expectedHex).toHaveLength(Num.multiply(vector.outputLength, 2))
            expectStringMatch(
              vector.id,
              fixture.algorithm,
              source.id,
              source.sourceLocator,
              source.fixturePath,
              actual,
              vector.expectedHex
            )
          })))
    }).pipe(Effect.provide(BunContext.layer)))
})
