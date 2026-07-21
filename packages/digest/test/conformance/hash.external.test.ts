/**
 * External hash conformance contract (RED-first).
 *
 * This suite defines the target-state requirement that BLAKE3 and SHA-256
 * parity is asserted from checked-in external fixture corpora.
 */

import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Schema } from "effect"
import { Blake3FixtureSchema, HashFixtureSchema } from "../../scripts/fixture-schemas.js"
import { blake3DeriveKey, blake3Hash, blake3Mac } from "../../src/algorithms/blake3.js"
import { sha256 } from "../../src/algorithms/sha256.js"
import { toHex } from "../../src/encoding.js"
import { encodeFixtureUtf8 } from "../helpers/bytes.js"
import { hexToBytes } from "../helpers/bytes.js"
import {
  loadExternalFixtureManifest,
  readExternalFixture,
  selectExternalSourcesByKind
} from "./helpers/externalFixtures.js"
import { expectStringMatch } from "./helpers/mismatchDiagnostics.js"

const makeBlake3VectorInput = (length: number): Uint8Array =>
  length === 0
    ? new Uint8Array()
    : Uint8Array.from(Arr.makeBy(length, (index) => index % 251))

describe("external conformance — hash", () => {
  it.effect("pins complete official BLAKE3 and NIST SHA-256 corpora", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      expect(selectExternalSourcesByKind(manifest, "blake3").map(({ id }) => id)).toEqual([
        "blake3-official-vectors"
      ])
      expect(selectExternalSourcesByKind(manifest, "hash").map(({ id }) => id)).toEqual([
        "nist-cavp-sha256-short-message"
      ])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("matches every NIST CAVP SHA-256 short-message output", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const hashSources = selectExternalSourcesByKind(manifest, "hash")

      const fixtures = yield* Effect.forEach(hashSources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap((content) =>
            Schema.decodeUnknown(HashFixtureSchema)(content, { onExcessProperty: "error" }).pipe(Effect.orDie)
          ),
          Effect.map((fixture) => ({
            source,
            fixture
          }))
        ))

      yield* Effect.forEach(fixtures, ({ source, fixture }) =>
        Effect.forEach(fixture.cases, (vector) =>
          Effect.gen(function*() {
            const digestHex = toHex(yield* sha256(hexToBytes(vector.inputHex)))
            expectStringMatch(
              vector.id,
              fixture.algorithm,
              source.id,
              source.sourceLocator,
              source.fixturePath,
              digestHex,
              vector.expectedHex
            )
          })))

      expect(Arr.flatMap(fixtures, ({ fixture }) =>
        fixture.cases)).toHaveLength(65)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("matches all three modes for every official BLAKE3 vector", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const sources = selectExternalSourcesByKind(manifest, "blake3")
      const fixtures = yield* Effect.forEach(sources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap((content) =>
            Schema.decodeUnknown(Blake3FixtureSchema)(content, { onExcessProperty: "error" }).pipe(Effect.orDie)
          ),
          Effect.map((fixture) => ({ source, fixture }))
        ))

      yield* Effect.forEach(fixtures, ({ fixture, source }) =>
        Effect.forEach(fixture.cases, (vector) =>
          Effect.gen(function*() {
            const input = makeBlake3VectorInput(vector.input_len)
            const hash = yield* blake3Hash(input)
            const keyedHash = yield* blake3Mac(encodeFixtureUtf8(fixture.key), input)
            const derivedKey = yield* blake3DeriveKey(fixture.context_string, input)

            expectStringMatch(
              `blake3:${vector.input_len}:hash`,
              "blake3-hash",
              source.id,
              source.sourceLocator,
              source.fixturePath,
              toHex(hash),
              vector.hash.slice(0, 64)
            )
            expectStringMatch(
              `blake3:${vector.input_len}:keyed_hash`,
              "blake3-keyed_hash",
              source.id,
              source.sourceLocator,
              source.fixturePath,
              toHex(keyedHash),
              vector.keyed_hash.slice(0, 64)
            )
            expectStringMatch(
              `blake3:${vector.input_len}:derive_key`,
              "blake3-derive_key",
              source.id,
              source.sourceLocator,
              source.fixturePath,
              toHex(derivedKey),
              vector.derive_key.slice(0, 64)
            )
          })))

      expect(Arr.flatMap(fixtures, ({ fixture }) =>
        fixture.cases)).toHaveLength(35)
    }).pipe(Effect.provide(BunContext.layer)))
})
