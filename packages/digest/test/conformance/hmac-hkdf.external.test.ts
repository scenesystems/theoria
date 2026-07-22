/**
 * External HMAC/HKDF conformance contracts.
 *
 * Expected bytes come only from complete RFC and Wycheproof fixture corpora.
 */

import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Schema } from "effect"
import { HkdfCorpusFixtureSchema, HmacFixtureSchema } from "../../scripts/fixture-schemas.js"
import { toHex } from "../../src/encoding.js"
import { hmacSha1, hmacSha256 } from "../../src/hmac.js"
import { hkdfSha256, hkdfSha512 } from "../../src/kdf.js"
import { hexToBytes } from "../helpers/bytes.js"
import {
  loadExternalFixtureManifest,
  readExternalFixture,
  selectExternalSourcesByKind
} from "./helpers/externalFixtures.js"
import { expectStringMatch } from "./helpers/mismatchDiagnostics.js"

describe("external conformance — hmac-hkdf", () => {
  it.effect("matches all seven RFC cases for HMAC-SHA1 and HMAC-SHA256", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const sources = selectExternalSourcesByKind(manifest, "hmac")
      const fixtures = yield* Effect.forEach(sources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap((content) =>
            Schema.decodeUnknown(HmacFixtureSchema)(content, { onExcessProperty: "error" }).pipe(Effect.orDie)
          ),
          Effect.map((fixture) => ({ source, fixture }))
        ))

      yield* Effect.forEach(fixtures, ({ fixture, source }) =>
        Effect.forEach(fixture.cases, (vector) =>
          Effect.gen(function*() {
            const key = hexToBytes(vector.keyHex)
            const message = hexToBytes(vector.messageHex)
            const result = yield* fixture.algorithm === "hmac-sha1"
              ? hmacSha1(key, message)
              : hmacSha256(key, message)
            const actual = toHex(result.slice(0, vector.outputLength))

            expect(vector.expectedHex).toHaveLength(vector.outputLength * 2)
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

      expect(Arr.flatMap(fixtures, ({ fixture }) =>
        fixture.cases)).toHaveLength(14)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("matches all RFC 5869 HKDF-SHA256 cases", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const sources = selectExternalSourcesByKind(manifest, "hkdf")
      const fixtures = yield* Effect.forEach(sources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap((content) =>
            Schema.decodeUnknown(HkdfCorpusFixtureSchema)(content, { onExcessProperty: "error" }).pipe(
              Effect.orDie
            )
          ),
          Effect.map((fixture) => ({ source, fixture }))
        ))

      const rfcFixtures = Arr.filter(fixtures, ({ fixture }) => fixture.algorithm === "hkdf-sha256")
      yield* Effect.forEach(rfcFixtures, ({ fixture, source }) =>
        fixture.algorithm === "hkdf-sha256"
          ? Effect.forEach(fixture.cases, (vector) =>
            Effect.gen(function*() {
              const result = yield* hkdfSha256(
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
                toHex(result),
                vector.expectedHex
              )
            }))
          : Effect.void)

      expect(Arr.flatMap(rfcFixtures, ({ fixture }) => fixture.algorithm === "hkdf-sha256" ? fixture.cases : []))
        .toHaveLength(3)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("matches every valid Wycheproof HKDF-SHA512 output", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const sources = selectExternalSourcesByKind(manifest, "hkdf")
      const fixtures = yield* Effect.forEach(sources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap((content) =>
            Schema.decodeUnknown(HkdfCorpusFixtureSchema)(content, { onExcessProperty: "error" }).pipe(
              Effect.orDie
            )
          ),
          Effect.map((fixture) => ({ source, fixture }))
        ))

      const wycheproofFixtures = Arr.filter(fixtures, ({ fixture }) => fixture.algorithm === "HKDF-SHA-512")
      const vectors = Arr.flatMap(wycheproofFixtures, ({ fixture, source }) =>
        fixture.algorithm === "HKDF-SHA-512"
          ? Arr.flatMap(
            fixture.testGroups,
            (group) => Arr.map(group.tests, (vector) => ({ fixture, group, source, vector }))
          )
          : [])
      const validVectors = Arr.filter(vectors, ({ vector }) => vector.result === "valid")
      const invalidIds = Arr.map(
        Arr.filter(vectors, ({ vector }) => vector.result === "invalid"),
        ({ vector }) => vector.tcId
      )

      expect(vectors).toHaveLength(83)
      expect(validVectors).toHaveLength(80)
      expect(invalidIds).toEqual([22, 45, 68])

      yield* Effect.forEach(validVectors, ({ fixture, group, source, vector }) =>
        Effect.gen(function*() {
          expect(hexToBytes(vector.ikm)).toHaveLength(group.keySize / 8)
          expect(vector.okm).toHaveLength(vector.size * 2)

          const result = yield* hkdfSha512(
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
            toHex(result),
            vector.okm
          )
        }))
    }).pipe(Effect.provide(BunContext.layer)))
})
