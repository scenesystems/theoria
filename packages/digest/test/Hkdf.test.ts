import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import * as Hkdf from "@scenesystems/digest/Hkdf"
import { Array as Arr, Effect, Either, Encoding, Match, Number as Num, Option, Schema } from "effect"

import * as Fixtures from "../scripts/fixtures.js"
import { expectByteLength, expectDigest } from "./helpers/assertions.js"
import { encodeFixtureUtf8, hexToBytes } from "./helpers/bytes.js"
import { expectStringMatch } from "./helpers/mismatchDiagnostics.js"
import { hkdfSha256Vectors } from "./helpers/vectors/hkdf.js"

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
      const invalid = [-1, 0.5, NaN, Infinity, Num.increment(Number.MAX_SAFE_INTEGER)]
      invalid.forEach((length) => {
        expect(Hkdf.sha256(ikm, salt, info, length)).toStrictEqual(Either.left(new Hkdf.InvalidLength({})))
        expect(Hkdf.sha512(ikm, salt, info, length)).toStrictEqual(Either.left(new Hkdf.InvalidLength({})))
      })
      expect(Hkdf.sha256(ikm, salt, info, 8161)).toStrictEqual(Either.left(new Hkdf.InvalidLength({})))
      expect(Hkdf.sha512(ikm, salt, info, 16321)).toStrictEqual(Either.left(new Hkdf.InvalidLength({})))
    }))
})

describe("Hkdf external conformance", () => {
  it.effect("matches all RFC 5869 HKDF-SHA256 cases", () =>
    Effect.gen(function*() {
      const manifest = yield* Fixtures.loadManifest
      const sources = Fixtures.sourcesOfKind(manifest, "hkdf")
      const fixtures = yield* Effect.forEach(sources, (source) =>
        Fixtures.read(source.fixturePath).pipe(
          Effect.flatMap(Schema.decodeUnknown(Fixtures.Hkdf, { onExcessProperty: "error" })),
          Effect.map((fixture) => ({ fixture, source }))
        ))

      yield* Effect.forEach(fixtures, ({ fixture, source }) =>
        Match.value(fixture).pipe(
          Match.when({ algorithm: "hkdf-sha256" }, (fixture) =>
            Effect.forEach(fixture.cases, (vector) =>
              Effect.gen(function*() {
                const result = yield* Hkdf.sha256(
                  hexToBytes(vector.ikmHex),
                  Option.fromNullable(vector.saltHex).pipe(Option.map(hexToBytes)),
                  hexToBytes(vector.infoHex),
                  vector.length
                )
                expectStringMatch(
                  vector.id,
                  fixture.algorithm,
                  source.id,
                  source.sourceLocator,
                  source.fixturePath,
                  Encoding.encodeHex(result),
                  vector.expectedHex
                )
              }))),
          Match.orElse(() => Effect.void)
        ))
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("matches every valid Wycheproof HKDF-SHA512 output", () =>
    Effect.gen(function*() {
      const manifest = yield* Fixtures.loadManifest
      const sources = Fixtures.sourcesOfKind(manifest, "hkdf")
      const fixtures = yield* Effect.forEach(sources, (source) =>
        Fixtures.read(source.fixturePath).pipe(
          Effect.flatMap(Schema.decodeUnknown(Fixtures.Hkdf, { onExcessProperty: "error" })),
          Effect.map((fixture) => ({ fixture, source }))
        ))
      const vectors = Arr.flatMap(fixtures, ({ fixture, source }) =>
        Match.value(fixture).pipe(
          Match.when({ algorithm: "HKDF-SHA-512" }, (fixture) =>
            Arr.flatMap(
              fixture.testGroups,
              (group) => Arr.map(group.tests, (vector) => ({ fixture, source, vector }))
            )),
          Match.orElse(() => Arr.empty())
        ))

      yield* Effect.forEach(
        Arr.filter(
          vectors,
          ({ vector }) => Match.value(vector.result).pipe(Match.when("valid", () => true), Match.orElse(() => false))
        ),
        ({ fixture, source, vector }) =>
          Effect.gen(function*() {
            const result = yield* Hkdf.sha512(
              hexToBytes(vector.ikm),
              Option.some(hexToBytes(vector.salt)),
              hexToBytes(vector.info),
              vector.size
            )
            expectStringMatch(
              `wycheproof:hkdf-sha512:${vector.tcId}`,
              fixture.algorithm,
              source.id,
              source.sourceLocator,
              source.fixturePath,
              Encoding.encodeHex(result),
              vector.okm
            )
          })
      )
    }).pipe(Effect.provide(BunContext.layer)))
})
