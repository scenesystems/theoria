import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import * as Blake3 from "@scenesystems/digest/Blake3"
import * as Digest from "@scenesystems/digest/Digest"
import * as Utf8 from "@scenesystems/digest/Utf8"
import { Array as Arr, Effect, Either, Encoding, Schema } from "effect"

import * as Fixtures from "../scripts/fixtures.js"
import { expectByteLength, expectDigest } from "./helpers/assertions.js"
import { encodeFixtureUtf8 } from "./helpers/bytes.js"
import { expectStringMatch } from "./helpers/mismatchDiagnostics.js"
import { contexts, deriveVectors, macVectors } from "./helpers/vectors/blake3.js"

describe("Blake3.mac", () => {
  const zerosKey = new Uint8Array(32)
  const onesKey = new Uint8Array(32).fill(1)

  it.effect("matches the keyed BLAKE3 vectors", () =>
    Effect.sync(() => {
      const message = encodeFixtureUtf8("hello")
      const zeros = Either.getOrThrow(Blake3.mac(zerosKey, message))
      const ones = Either.getOrThrow(Blake3.mac(onesKey, message))
      expectDigest(zeros, macVectors.zerosKeyHello)
      expectDigest(ones, macVectors.onesKeyHello)
      expect(zeros).not.toEqual(ones)
    }))

  it.effect("handles empty and long messages", () =>
    Effect.sync(() => {
      expectDigest(Either.getOrThrow(Blake3.mac(zerosKey, new Uint8Array())), macVectors.zerosKeyEmpty)
      expectDigest(
        Either.getOrThrow(Blake3.mac(zerosKey, encodeFixtureUtf8("a".repeat(1000)))),
        macVectors.zerosKeyLong
      )
    }))

  it.effect("returns the expected and actual invalid key lengths", () =>
    Effect.sync(() => {
      expect(Blake3.mac(new Uint8Array(16), new Uint8Array())).toStrictEqual(
        Either.left(new Blake3.InvalidKeyLength({ expected: 32, actual: 16 }))
      )
      expect(Blake3.mac(new Uint8Array(64), new Uint8Array())).toStrictEqual(
        Either.left(new Blake3.InvalidKeyLength({ expected: 32, actual: 64 }))
      )
    }))
})

describe("Blake3.deriveKey", () => {
  it.effect("matches independent vectors at default and custom lengths", () =>
    Effect.sync(() => {
      const input = encodeFixtureUtf8("hello")
      expectDigest(Either.getOrThrow(Blake3.deriveKey(contexts.ctx1, input)), deriveVectors.ctx1Hello)
      expectDigest(Either.getOrThrow(Blake3.deriveKey(contexts.ctx1, input, 64)), deriveVectors.ctx1HelloDk64)
    }))

  it.effect("uses its context for domain separation", () =>
    Effect.sync(() => {
      const input = encodeFixtureUtf8("hello")
      const first = Either.getOrThrow(Blake3.deriveKey(contexts.ctx1, input))
      const second = Either.getOrThrow(Blake3.deriveKey(contexts.ctx2, input))
      expectDigest(second, deriveVectors.ctx2Hello)
      expect(first).not.toEqual(second)
    }))

  it.effect("allows zero-length output", () =>
    Effect.sync(() => {
      expectByteLength(Either.getOrThrow(Blake3.deriveKey(contexts.ctx1, new Uint8Array(), 0)), 0)
    }))

  it.effect("rejects every non-safe, fractional, or negative length", () =>
    Effect.sync(() => {
      const invalidLengths = [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]
      expect(invalidLengths.map((length) => Blake3.deriveKey(contexts.ctx1, new Uint8Array(), length))).toEqual(
        invalidLengths.map(() => Either.left(new Blake3.InvalidLength({})))
      )
    }))

  it.effect("rejects an invalid length before inspecting an ill-formed context", () =>
    Effect.sync(() => {
      expect(Blake3.deriveKey("domain/\uD800", encodeFixtureUtf8("input"), -1)).toStrictEqual(
        Either.left(new Blake3.InvalidLength({}))
      )
    }))

  it.effect("rejects an ill-formed context without retaining it", () =>
    Effect.sync(() => {
      expect(Blake3.deriveKey("domain/\uD800", encodeFixtureUtf8("input"))).toStrictEqual(
        Either.left(new Utf8.InvalidUnicode({ kind: "lone-high-surrogate", codeUnitIndex: 7 }))
      )
    }))

  it.effect("preserves valid context text without normalization", () =>
    Effect.sync(() => {
      const input = encodeFixtureUtf8("input")
      const decomposed = Either.getOrThrow(Blake3.deriveKey("scene/😀/e\u0301", input))
      const canonical = Either.getOrThrow(Blake3.deriveKey("scene/😀/é", input))
      expect(decomposed).not.toEqual(canonical)
    }))
})

describe("Blake3 external conformance", () => {
  it.effect("matches all three modes for every official BLAKE3 vector", () =>
    Effect.gen(function*() {
      const manifest = yield* Fixtures.loadManifest
      const sources = Fixtures.sourcesOfKind(manifest, "blake3")
      const fixtures = yield* Effect.forEach(sources, (source) =>
        Fixtures.read(source.fixturePath).pipe(
          Effect.flatMap(Schema.decodeUnknown(Fixtures.Blake3, { onExcessProperty: "error" })),
          Effect.map((fixture) => ({ fixture, source }))
        ))

      yield* Effect.forEach(fixtures, ({ fixture, source }) =>
        Effect.forEach(fixture.cases, (vector) =>
          Effect.gen(function*() {
            const input = vector.input_len === 0
              ? new Uint8Array()
              : Uint8Array.from(Arr.makeBy(vector.input_len, (index) =>
                index % 251))
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
