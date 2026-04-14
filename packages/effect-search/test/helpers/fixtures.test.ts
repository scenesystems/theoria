import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Match, Schema } from "effect"

import { CategoricalParzenFixtureSchema, FixtureRegistry, TpeCategoricalStudyReplayFixtureSchema } from "./fixtures.js"
import { fmGateMatrix, FmGateMatrixSchema } from "./fixtures/fmMatrix.js"
import { loadManifest } from "./fixtures/io.js"

const fixtureRoot = new URL("../fixtures/optuna/", import.meta.url)
const invalidFixtureRoot = new URL("../fixtures/optuna/invalid/", import.meta.url)
const fixtureManifestFileName = "manifest.json"

const packageRootUrl = new URL("../../", import.meta.url)

const assertConsumingTestsExist = (
  relativePaths: ReadonlyArray<string>
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)

    yield* Effect.forEach(
      relativePaths,
      (relativePath) =>
        Effect.gen(function*() {
          const absolutePath = path.join(root, relativePath)
          const exists = yield* fileSystem.exists(absolutePath).pipe(Effect.orDie)

          expect(exists).toBe(true)
        }),
      { discard: true }
    )
  })

const listFixtureJsonFiles = (
  root: string,
  prefix: string
): Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = prefix === "" ? root : path.join(root, prefix)
    const entries = yield* fileSystem.readDirectory(directory).pipe(Effect.orDie)

    const nestedFiles = yield* Effect.forEach(entries, (entry) =>
      Effect.gen(function*() {
        const relativePath = prefix === "" ? entry : `${prefix}/${entry}`
        const absolutePath = path.join(root, relativePath)
        const stat = yield* fileSystem.stat(absolutePath).pipe(Effect.orDie)

        return yield* Match.value(stat.type).pipe(
          Match.when(
            "Directory",
            () =>
              entry === "invalid"
                ? Effect.succeed(Arr.empty<string>())
                : listFixtureJsonFiles(root, relativePath)
          ),
          Match.orElse(() => Effect.succeed(entry.endsWith(".json") ? [relativePath] : Arr.empty<string>()))
        )
      }))

    return Arr.flatten(nestedFiles)
  })

describe("deterministic fixture registry", () => {
  it.effect("loads schema-validated fixtures from the manifest", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make()
      const categorical = yield* registry.load("categorical-parzen.basic")
      const replay = yield* registry.load("tpe-categorical-study.replay")

      const decodedCategorical = yield* Schema.decodeUnknown(CategoricalParzenFixtureSchema)(categorical)
      const decodedReplay = yield* Schema.decodeUnknown(TpeCategoricalStudyReplayFixtureSchema)(replay)

      expect(decodedCategorical.payload.expected.probabilities).toHaveLength(3)
      expect(decodedReplay.payload.expected.configTrace.length).toBe(decodedReplay.payload.sampler.trials)
    }))

  it.effect("asserts FM fixture namespace completeness for Wave 0 substrate", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make()
      const matrix = yield* Schema.decodeUnknown(FmGateMatrixSchema)(fmGateMatrix)

      yield* Effect.forEach(
        matrix,
        (entry) =>
          Effect.gen(function*() {
            const fixturesInNamespace = yield* registry.loadAll(entry.namespace)

            expect(fixturesInNamespace.length).toBeGreaterThan(0)
          }),
        { discard: true }
      )
    }))

  it.effect("fails fast when any FM gate lacks fixture artifacts or consuming tests", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make()
      const matrix = yield* Schema.decodeUnknown(FmGateMatrixSchema)(fmGateMatrix)

      yield* Effect.forEach(
        matrix,
        (entry) =>
          Effect.gen(function*() {
            const loadedFixtures = yield* Effect.forEach(entry.fixtures, (fixture) => registry.load(fixture))

            expect(loadedFixtures.length).toBeGreaterThan(0)
            yield* assertConsumingTestsExist(entry.consumingTests)
          }),
        { discard: true }
      )
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("validates the full fixture manifest against schema contracts", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make()
      yield* registry.validateManifest
    }))

  it.effect("fails fast when fixture files drift outside manifest coverage", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const rootPath = yield* path.fromFileUrl(fixtureRoot).pipe(Effect.orDie)
      const manifest = yield* loadManifest(fixtureRoot, fixtureManifestFileName)
      const manifestFiles = Arr.map(manifest.fixtures, (entry) => entry.file)
      const fixtureJsonFiles = yield* listFixtureJsonFiles(rootPath, "").pipe(
        Effect.map((files) => Arr.filter(files, (file) => file !== fixtureManifestFileName))
      )

      const orphans = Arr.filter(fixtureJsonFiles, (file) => !Arr.contains(manifestFiles, file))
      const staleManifestEntries = Arr.filter(manifestFiles, (file) => !Arr.contains(fixtureJsonFiles, file))

      expect(orphans).toStrictEqual([])
      expect(staleManifestEntries).toStrictEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("fails when a manifest entry points to a missing fixture file", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make({
        rootUrl: invalidFixtureRoot,
        manifestFileName: "manifest.missing-file.json"
      })
      const result = yield* Effect.either(registry.validateManifest)

      expect(Either.isLeft(result)).toBe(true)
      expect(
        Either.match(result, {
          onLeft: (error) => error._tag,
          onRight: () => "Right"
        })
      ).toBe("FixtureFileReadError")
    }))

  it.effect("fails when a fixture file contains malformed JSON", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make({
        rootUrl: invalidFixtureRoot,
        manifestFileName: "manifest.malformed.json"
      })
      const result = yield* Effect.either(registry.validateManifest)

      expect(Either.isLeft(result)).toBe(true)
      expect(
        Either.match(result, {
          onLeft: (error) => error._tag,
          onRight: () => "Right"
        })
      ).toBe("FixtureMalformedJsonError")
    }))

  it.effect("fails when fixture JSON is schema-incompatible", () =>
    Effect.gen(function*() {
      const registry = FixtureRegistry.make({
        rootUrl: invalidFixtureRoot,
        manifestFileName: "manifest.schema-incompatible.json"
      })
      const result = yield* Effect.either(registry.validateManifest)

      expect(Either.isLeft(result)).toBe(true)
      expect(
        Either.match(result, {
          onLeft: (error) => error._tag,
          onRight: () => "Right"
        })
      ).toBe("FixtureSchemaDecodeError")
    }))
})
