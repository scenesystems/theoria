import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Order } from "effect"

import { decodeDeterministicInput, loadInteropFixture, loadInteropManifest } from "../helpers/interopFixtures.js"

const fixturesRootUrl = new URL("../fixtures/interop/", import.meta.url)

const sortStrings = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  Arr.sort(Arr.fromIterable(values), Order.string)

describe("interop/fixture-governance", () => {
  it.effect("keeps runtime fixtures declared, schema-valid, and provenance-explicit", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(fixturesRootUrl).pipe(Effect.orDie)
      const manifest = yield* loadInteropManifest
      const filesOnDisk = yield* fileSystem.readDirectory(root).pipe(Effect.orDie)
      const jsonFiles = sortStrings(filesOnDisk.filter((file) => file.endsWith(".json") && file !== "manifest.json"))
      const manifestFiles = sortStrings(manifest.fixtures.map((entry) => entry.file))

      expect(manifest.version).toBe("1")
      expect(manifestFiles).toEqual(jsonFiles)

      yield* Effect.forEach(
        manifest.fixtures,
        (entry) =>
          Effect.gen(function*() {
            const fixture = yield* loadInteropFixture(entry)
            const deterministicInput = yield* decodeDeterministicInput(fixture)

            expect(fixture.fixture).toBe(entry.fixture)
            expect(fixture.algorithm).toBe(entry.algorithm)
            expect(fixture.runtime.name).toBe("@noble/ciphers")
            expect(fixture.runtime.version).toBe("2.1.1")
            expect(fixture.provenance.reference.length).toBeGreaterThan(0)
            expect(fixture.provenance.normalizationNotes).toContain("fixed key, nonce, plaintext, and associated data")
            expect(deterministicInput.key.byteLength).toBe(32)
            expect(deterministicInput.plaintext.byteLength).toBeGreaterThan(0)
            expect(deterministicInput.associatedData.byteLength).toBeGreaterThan(0)
            expect(fixture.envelope.keyId).toBeDefined()
            expect(fixture.envelope.keyVersion).toBeGreaterThan(0)
          }),
        { discard: true }
      )
    }).pipe(Effect.provide(BunContext.layer)))
})
