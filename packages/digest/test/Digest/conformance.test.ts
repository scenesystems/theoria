/** External BLAKE3 and SHA-256 conformance against checked-in upstream corpora. */

import { BunContext } from "@effect/platform-bun"
import { describe, it } from "@effect/vitest"
import { Array as Arr, Effect, Encoding, Schema } from "effect"

import { Blake3FixtureSchema, HashFixtureSchema } from "../../scripts/fixture-schemas.js"
import * as Blake3 from "../../src/Blake3.js"
import * as Digest from "../../src/Digest.js"
import {
  loadExternalFixtureManifest,
  readExternalFixture,
  selectExternalSourcesByKind
} from "../conformance/helpers/externalFixtures.js"
import { expectStringMatch } from "../conformance/helpers/mismatchDiagnostics.js"
import { encodeFixtureUtf8, hexToBytes } from "../helpers/bytes.js"

const makeBlake3VectorInput = (length: number): Uint8Array =>
  length === 0
    ? new Uint8Array()
    : Uint8Array.from(Arr.makeBy(length, (index) => index % 251))

describe("Digest external conformance", () => {
  it.effect("matches every NIST CAVP SHA-256 short-message output", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const sources = selectExternalSourcesByKind(manifest, "hash")
      const fixtures = yield* Effect.forEach(sources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap(Schema.decodeUnknown(HashFixtureSchema, { onExcessProperty: "error" })),
          Effect.map((fixture) => ({ fixture, source }))
        ))

      yield* Effect.forEach(fixtures, ({ fixture, source }) =>
        Effect.forEach(fixture.cases, (vector) =>
          Effect.sync(() =>
            expectStringMatch(
              vector.id,
              fixture.algorithm,
              source.id,
              source.sourceLocator,
              source.fixturePath,
              Encoding.encodeHex(Digest.hash("sha256", hexToBytes(vector.inputHex))),
              vector.expectedHex
            )
          )))
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("matches all three modes for every official BLAKE3 vector", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const sources = selectExternalSourcesByKind(manifest, "blake3")
      const fixtures = yield* Effect.forEach(sources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap(Schema.decodeUnknown(Blake3FixtureSchema, { onExcessProperty: "error" })),
          Effect.map((fixture) => ({ fixture, source }))
        ))

      yield* Effect.forEach(fixtures, ({ fixture, source }) =>
        Effect.forEach(fixture.cases, (vector) =>
          Effect.gen(function*() {
            const input = makeBlake3VectorInput(vector.input_len)
            const hash = Digest.hash("blake3-256", input)
            const keyedHash = yield* Blake3.mac(encodeFixtureUtf8(fixture.key), input)
            const derivedKey = yield* Blake3.deriveKey(fixture.context_string, input)

            expectStringMatch(
              `blake3:${vector.input_len}:hash`,
              "blake3-hash",
              source.id,
              source.sourceLocator,
              source.fixturePath,
              Encoding.encodeHex(hash),
              vector.hash.slice(0, 64)
            )
            expectStringMatch(
              `blake3:${vector.input_len}:keyed_hash`,
              "blake3-keyed_hash",
              source.id,
              source.sourceLocator,
              source.fixturePath,
              Encoding.encodeHex(keyedHash),
              vector.keyed_hash.slice(0, 64)
            )
            expectStringMatch(
              `blake3:${vector.input_len}:derive_key`,
              "blake3-derive_key",
              source.id,
              source.sourceLocator,
              source.fixturePath,
              Encoding.encodeHex(derivedKey),
              vector.derive_key.slice(0, 64)
            )
          })))
    }).pipe(Effect.provide(BunContext.layer)))
})
