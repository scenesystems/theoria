import { Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Schema } from "effect"

import {
  packagePublicEntrypoints,
  type PackagePublicExport,
  packagePublicExports,
  PackageReleaseManifestJson,
  readProjectFile,
  resolveRootFrom,
  typeScriptProgramFromConfig
} from "../src/index.js"

const fixtureRootUrl = new URL("./fixtures/public-surface/", import.meta.url)

const sortPublicExports = (entries: ReadonlyArray<PackagePublicExport>): ReadonlyArray<PackagePublicExport> =>
  Arr.fromIterable(entries).sort((left, right) =>
    `${left.subpath}::${left.exportName}::${left.kind}`.localeCompare(
      `${right.subpath}::${right.exportName}::${right.kind}`
    )
  )

describe("public surface", () => {
  it.effect("builds package entrypoints from package.json exports and resolves consumer-facing symbols", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const fixtureRoot = yield* resolveRootFrom(fixtureRootUrl)
      const manifestJson = yield* readProjectFile(fixtureRootUrl, "package.json")
      const manifest = yield* Schema.decodeUnknown(PackageReleaseManifestJson)(manifestJson).pipe(Effect.orDie)

      const entrypoints = yield* packagePublicEntrypoints(fixtureRoot, manifest)

      expect(entrypoints.map((entrypoint) => [entrypoint.subpath, entrypoint.sourceFile.relative])).toEqual([
        [".", "src/index.ts"],
        ["./Types", "src/types.ts"],
        ["./Widget", "src/widget.ts"]
      ])

      const program = yield* typeScriptProgramFromConfig(path.join(fixtureRoot, "tsconfig.src.json")).pipe(Effect.orDie)

      expect(sortPublicExports(packagePublicExports(program, entrypoints))).toEqual([
        {
          subpath: ".",
          exportName: "doThing",
          kind: "value",
          since: "0.3.0",
          category: "operations"
        },
        {
          subpath: ".",
          exportName: "SharedModel",
          kind: "type",
          since: "0.1.0",
          category: "models"
        },
        {
          subpath: ".",
          exportName: "sharedValue",
          kind: "value",
          since: "0.1.0",
          category: "operations"
        },
        {
          subpath: ".",
          exportName: "Widget",
          kind: "namespace",
          since: "0.2.0",
          category: "namespaces"
        },
        {
          subpath: ".",
          exportName: "WidgetModel",
          kind: "type",
          since: "0.2.0",
          category: "models"
        },
        {
          subpath: "./Types",
          exportName: "WidgetModel",
          kind: "type",
          since: "0.2.0",
          category: "models"
        },
        {
          subpath: "./Widget",
          exportName: "default",
          kind: "default",
          since: "0.2.0",
          category: "constructors"
        }
      ])
    }).pipe(Effect.provide(BunContext.layer)))
})
