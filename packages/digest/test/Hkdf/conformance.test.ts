/** External HKDF conformance against checked-in RFC and Wycheproof corpora. */

import { BunContext } from "@effect/platform-bun"
import { describe, it } from "@effect/vitest"
import { Array as Arr, Effect, Encoding, Option, Schema } from "effect"

import { HkdfCorpusFixtureSchema } from "../../scripts/fixture-schemas.js"
import * as Hkdf from "../../src/Hkdf.js"
import {
  loadExternalFixtureManifest,
  readExternalFixture,
  selectExternalSourcesByKind
} from "../conformance/helpers/externalFixtures.js"
import { expectStringMatch } from "../conformance/helpers/mismatchDiagnostics.js"
import { hexToBytes } from "../helpers/bytes.js"

describe("Hkdf external conformance", () => {
  it.effect("matches all RFC 5869 HKDF-SHA256 cases", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const sources = selectExternalSourcesByKind(manifest, "hkdf")
      const fixtures = yield* Effect.forEach(sources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap(Schema.decodeUnknown(HkdfCorpusFixtureSchema, { onExcessProperty: "error" })),
          Effect.map((fixture) => ({ fixture, source }))
        ))

      yield* Effect.forEach(fixtures, ({ fixture, source }) =>
        fixture.algorithm === "hkdf-sha256"
          ? Effect.forEach(fixture.cases, (vector) =>
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
            }))
          : Effect.void)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("matches every valid Wycheproof HKDF-SHA512 output", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const sources = selectExternalSourcesByKind(manifest, "hkdf")
      const fixtures = yield* Effect.forEach(sources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap(Schema.decodeUnknown(HkdfCorpusFixtureSchema, { onExcessProperty: "error" })),
          Effect.map((fixture) => ({ fixture, source }))
        ))
      const vectors = Arr.flatMap(fixtures, ({ fixture, source }) =>
        fixture.algorithm === "HKDF-SHA-512"
          ? Arr.flatMap(fixture.testGroups, (group) => Arr.map(group.tests, (vector) => ({ fixture, source, vector })))
          : [])

      yield* Effect.forEach(
        Arr.filter(vectors, ({ vector }) => vector.result === "valid"),
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
