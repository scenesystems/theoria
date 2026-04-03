import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Order } from "effect"
import * as Arr from "effect/Array"

import { resolveRootFrom } from "@theoria/source-proof"

const packageRootUrl = new URL("../../", import.meta.url)

const expectedSourceRoots = ["Browser", "Errors", "React", "Text", "contracts", "experimental", "index.ts"]
const sortStrings = (values: ReadonlyArray<string>): ReadonlyArray<string> => Arr.sort(values, Order.string)

describe("package structure contracts", () => {
  it.effect("keeps the converged shared authority and runtime internals in canonical locations", () =>
    Effect.gen(function*() {
      const pathService = yield* Path.Path
      const fileSystem = yield* FileSystem.FileSystem
      const packageRoot = yield* resolveRootFrom(packageRootUrl)
      const srcRoot = pathService.join(packageRoot, "src")
      const expectedPaths = [
        "src/contracts/index.ts",
        "src/Text/internal/analysis.ts",
        "src/Text/internal/layout.ts",
        "src/Text/internal/preparation.ts",
        "src/Browser/internal/canvas.ts"
      ]
      const srcEntries = yield* fileSystem.readDirectory(srcRoot).pipe(Effect.orDie)
      const pathExists = yield* Effect.forEach(
        expectedPaths,
        (relativePath) => fileSystem.exists(pathService.join(packageRoot, relativePath)).pipe(Effect.orDie),
        { concurrency: "unbounded" }
      )

      expect(Arr.every(pathExists, (exists) => exists)).toStrictEqual(true)
      expect(Arr.some(srcEntries, (entry) => entry === "Contracts")).toStrictEqual(false)
      expect(Arr.some(srcEntries, (entry) => entry === "internal")).toStrictEqual(false)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps Text as the canonical runtime domain root", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const pathService = yield* Path.Path
      const packageRoot = yield* resolveRootFrom(packageRootUrl)
      const textEntries = yield* fileSystem.readDirectory(pathService.join(packageRoot, "src", "Text")).pipe(
        Effect.orDie
      )

      expect(sortStrings(textEntries)).toStrictEqual(
        sortStrings(["constructors.ts", "index.ts", "internal", "layers.ts", "layout.ts", "model.ts", "schema.ts"])
      )
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("reserves companion-domain barrels and experimental internals in the converged package anatomy", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const pathService = yield* Path.Path
      const packageRoot = yield* resolveRootFrom(packageRootUrl)
      const expectedPaths = [
        pathService.join(packageRoot, "src", "Browser", "index.ts"),
        pathService.join(packageRoot, "src", "React", "index.ts"),
        pathService.join(packageRoot, "src", "experimental", "Calibration", "internal")
      ]
      const pathExists = yield* Effect.forEach(expectedPaths, (path) => fileSystem.exists(path).pipe(Effect.orDie), {
        concurrency: "unbounded"
      })

      expect(Arr.every(pathExists, (exists) => exists)).toStrictEqual(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps root authorities and domain filenames predictable across the package", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const pathService = yield* Path.Path
      const packageRoot = yield* resolveRootFrom(packageRootUrl)
      const srcRoot = pathService.join(packageRoot, "src")
      const srcEntries = yield* fileSystem.readDirectory(srcRoot).pipe(Effect.orDie)
      const browserEntries = yield* fileSystem.readDirectory(pathService.join(srcRoot, "Browser")).pipe(Effect.orDie)
      const errorsEntries = yield* fileSystem.readDirectory(pathService.join(srcRoot, "Errors")).pipe(Effect.orDie)
      const reactEntries = yield* fileSystem.readDirectory(pathService.join(srcRoot, "React")).pipe(Effect.orDie)
      const calibrationEntries = yield* fileSystem.readDirectory(
        pathService.join(srcRoot, "experimental", "Calibration")
      ).pipe(Effect.orDie)

      expect(sortStrings(srcEntries)).toStrictEqual(sortStrings(expectedSourceRoots))
      expect(sortStrings(browserEntries)).toStrictEqual(sortStrings(["index.ts", "internal", "layers.ts"]))
      expect(sortStrings(errorsEntries)).toStrictEqual(["index.ts"])
      expect(sortStrings(reactEntries)).toStrictEqual(sortStrings(["index.ts", "internal"]))
      expect(sortStrings(calibrationEntries)).toStrictEqual(
        sortStrings(["evaluation.ts", "index.ts", "internal", "schema.ts", "search.ts"])
      )
    }).pipe(Effect.provide(BunContext.layer)))
})
