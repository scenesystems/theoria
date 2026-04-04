import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Order, Schema } from "effect"
import * as Arr from "effect/Array"

import {
  loadReleaseSinceSnapshotForVersion,
  packagePublicEntrypoints,
  packagePublicExports,
  PackageReleaseManifestJson,
  resolveReleaseGovernedVersion,
  resolveRootFrom,
  typeScriptProgramFromConfig
} from "@theoria/source-proof"

import * as EffectText from "../../src/index.js"

const packageRootUrl = new URL("../../", import.meta.url)
const sortStrings = (values: ReadonlyArray<string>): ReadonlyArray<string> => Arr.sort(values, Order.string)

const exportedNamesFor = (
  exports: ReadonlyArray<{ readonly subpath: string; readonly exportName: string }>,
  subpath: string
): ReadonlyArray<string> =>
  sortStrings(
    Arr.map(
      Arr.filter(exports, (entry) => entry.subpath === subpath),
      (entry) => entry.exportName
    )
  )

describe("package public api contracts", () => {
  it.effect("keeps the shipped public symbol graph aligned with the release-governed entrypoints", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* resolveRootFrom(packageRootUrl)
      const manifestJson = yield* fileSystem.readFileString(path.join(root, "package.json")).pipe(Effect.orDie)
      const manifest = yield* Schema.decodeUnknown(PackageReleaseManifestJson)(manifestJson).pipe(Effect.orDie)
      const releaseVersion = yield* resolveReleaseGovernedVersion({
        workspaceRoot: path.dirname(path.dirname(root)),
        packageName: manifest.name,
        currentVersion: manifest.version
      })
      const entrypoints = yield* packagePublicEntrypoints(root, manifest)
      const program = yield* typeScriptProgramFromConfig(path.join(root, "tsconfig.src.json")).pipe(Effect.orDie)
      const publicExports = packagePublicExports(program, entrypoints)
      const snapshot = yield* loadReleaseSinceSnapshotForVersion({
        snapshotsDirectory: path.join(root, "test/package/release-snapshots"),
        releasedVersion: releaseVersion
      })

      expect(exportedNamesFor(publicExports, ".")).toEqual(
        sortStrings(["Browser", "Contracts", "Errors", "Experimental", "React", "Text"])
      )
      expect(
        sortStrings(
          Arr.reduce(
            snapshot.exports,
            Arr.empty<string>(),
            (subpaths, entry) => Arr.contains(subpaths, entry.subpath) ? subpaths : Arr.append(subpaths, entry.subpath)
          )
        )
      ).toEqual(
        sortStrings([
          ".",
          "./Browser",
          "./browser",
          "./Contracts",
          "./contracts",
          "./Errors",
          "./Experimental",
          "./experimental",
          "./React",
          "./react",
          "./Text"
        ])
      )
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps runtime, companion, and experimental stability lanes explicit", () =>
    Effect.sync(() => {
      expect(EffectText.Contracts.ContractsStability).toBe("stable")
      expect(EffectText.Errors.ErrorsStability).toBe("stable")
      expect(EffectText.Text.TextStability).toBe("provisional")
      expect(EffectText.Browser.BrowserStability).toBe("provisional")
      expect(EffectText.React.ReactStability).toBe("provisional")
      expect(EffectText.Experimental.ExperimentalStability).toBe("unstable")
      expect(EffectText.Experimental.Calibration.CalibrationStability).toBe("unstable")
    }))

  it.effect("keeps browser and react companions boundary-correct from the root surface", () =>
    Effect.sync(() => {
      expect(EffectText.Browser.BrowserSupportManifest).toBeDefined()
      expect(EffectText.Browser.CanvasTextMeasurerLive).toBeDefined()
      expect(EffectText.Browser.browserSupportProfile).toBeDefined()
      expect("PrepareIdentity" in EffectText.Browser).toBe(false)
      expect("prepareIdentityFor" in EffectText.Browser).toBe(false)

      expect(EffectText.React.PrepareIdentity).toBeDefined()
      expect(EffectText.React.prepareIdentityFor).toBeDefined()
      expect(EffectText.React.projectPreparedLayout).toBeDefined()
      expect("CanvasTextMeasurerLive" in EffectText.React).toBe(false)
      expect("BrowserMeasurementCacheLive" in EffectText.React).toBe(false)
    }))
})
