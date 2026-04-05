import { Command, FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema, Stream } from "effect"

import {
  packageNameFromString,
  PublishReadinessManifestSchema,
  publishReadinessProfile,
  publishReadinessReport,
  ReleaseSinceSnapshotJson,
  resolveRootFrom,
  TheoriaReleaseFrameworkAuthority
} from "../src/index.js"

const repositoryRootUrl = new URL("../../../", import.meta.url)
const sourceProofFixtureRootUrl = new URL("./fixtures/public-surface/", import.meta.url)

const resolveRepositoryRoot = resolveRootFrom(repositoryRootUrl)

const runCommand = (root: string, args: ReadonlyArray<string>) =>
  Effect.gen(function*() {
    const command = Command.make("bun", ...args).pipe(
      Command.workingDirectory(root),
      Command.stdout("pipe"),
      Command.stderr("pipe")
    )
    const runningProcess = yield* Command.start(command)
    const [exitCode, stdout, stderr] = yield* Effect.all(
      [
        runningProcess.exitCode,
        Stream.decodeText(runningProcess.stdout).pipe(Stream.runFold("", (current, chunk) => `${current}${chunk}`)),
        Stream.decodeText(runningProcess.stderr).pipe(Stream.runFold("", (current, chunk) => `${current}${chunk}`))
      ],
      { concurrency: "unbounded" }
    )

    return {
      exitCode: Number(exitCode),
      stdout,
      stderr
    }
  }).pipe(Effect.scoped)

describe("publish readiness", () => {
  it.effect("declares one canonical root release-framework authority with data-driven package variance", () =>
    Effect.sync(() => {
      expect(TheoriaReleaseFrameworkAuthority.name).toBe("root-release-framework")
      expect(TheoriaReleaseFrameworkAuthority.packageAlignmentSeam).toBe("publishReadinessProfiles")
      expect(TheoriaReleaseFrameworkAuthority.publishReadinessCli).toBe("scripts/publish-readiness.ts")
      expect(TheoriaReleaseFrameworkAuthority.releaseSnapshotCli).toBe("scripts/stamp-release-snapshot.ts")
      expect(TheoriaReleaseFrameworkAuthority.governedPackages.map((profile) => profile.packageName)).toEqual([
        "effect-math",
        "effect-search",
        "effect-dsp",
        "effect-text",
        "effect-inference",
        "@scenesystems/digest",
        "@scenesystems/seal",
        "@scenesystems/sign"
      ])
    }))

  it.effect("models shared issue taxonomy from one root engine while preserving package variance", () =>
    Effect.sync(() => {
      const effectMathProfile = publishReadinessProfile(packageNameFromString("effect-math"))
      const effectSearchProfile = publishReadinessProfile(packageNameFromString("effect-search"))

      expect(Option.isSome(effectMathProfile)).toBe(true)
      expect(Option.isSome(effectSearchProfile)).toBe(true)

      if (Option.isNone(effectMathProfile) || Option.isNone(effectSearchProfile)) {
        return
      }

      const mathReport = publishReadinessReport({
        profile: effectMathProfile.value,
        rootManifest: Schema.decodeUnknownSync(PublishReadinessManifestSchema)({
          name: "effect-math",
          version: "0.2.1",
          exports: {
            ".": "./src/index.ts",
            "./contracts": "./src/contracts/index.ts",
            "./internal/*": null
          },
          scripts: {
            "publish:check": "bun ../../scripts/publish-readiness.ts --package=effect-math",
            "release-snapshots:stamp": "bun ../../scripts/stamp-release-snapshot.ts",
            "docgen": "docgen"
          },
          keywords: effectMathProfile.value.requiredKeywords,
          repository: {
            type: "git",
            url: "https://github.com/scenesystems/theoria.git",
            directory: "packages/effect-math"
          },
          homepage: "https://github.com/scenesystems/theoria/tree/main/packages/effect-math"
        })
      })

      const searchReport = publishReadinessReport({
        profile: effectSearchProfile.value,
        rootManifest: Schema.decodeUnknownSync(PublishReadinessManifestSchema)({
          name: "effect-search",
          version: "0.2.1",
          exports: {
            ".": "./src/index.ts",
            "./Cache": "./src/Cache/index.ts",
            "./internal/*": null
          },
          scripts: {
            "publish:check": "bun ../../scripts/publish-readiness.ts --package=effect-search",
            "release-snapshots:stamp": "bun ../../scripts/stamp-release-snapshot.ts",
            "docgen": "docgen"
          },
          keywords: effectSearchProfile.value.requiredKeywords,
          repository: {
            type: "git",
            url: "https://github.com/scenesystems/theoria.git",
            directory: "packages/effect-search"
          },
          homepage: "https://github.com/scenesystems/theoria/tree/main/packages/effect-search"
        }),
        readmeText: "Run `publish:check` first."
      })

      expect(mathReport.errors).toEqual([])
      expect(searchReport.errors.map((currentIssue) => currentIssue.code)).toContain(
        "scripts.changeset-publish.missing"
      )
      expect(searchReport.errors.map((currentIssue) => currentIssue.code)).toContain("docs.release-checklist.missing")
    }))

  it.effect("runs the root publish-readiness CLI against governed package fixtures", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const repositoryRoot = yield* resolveRepositoryRoot
      const packageRoot = path.join(repositoryRoot, "packages/effect-search")
      const result = yield* runCommand(repositoryRoot, [
        "scripts/publish-readiness.ts",
        "--package=effect-search",
        `--package-root=${packageRoot}`,
        "--enforce-monorepo-topology"
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("effect-search passed root release-framework publish-readiness checks")
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("runs the root release-snapshot CLI against a fixture package", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const repositoryRoot = yield* resolveRepositoryRoot
      const fixtureRoot = yield* resolveRootFrom(sourceProofFixtureRootUrl)
      const snapshotsDirectory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "source-proof-release-snapshot-"
      })
      const result = yield* runCommand(repositoryRoot, [
        "scripts/stamp-release-snapshot.ts",
        `--package-root=${fixtureRoot}`,
        `--snapshots-directory=${snapshotsDirectory}`
      ])
      const snapshotPath = path.join(snapshotsDirectory, "0.3.0.json")
      const encodedSnapshot = yield* fileSystem.readFileString(snapshotPath).pipe(Effect.orDie)
      const decodedSnapshot = yield* Schema.decodeUnknown(ReleaseSinceSnapshotJson)(encodedSnapshot).pipe(Effect.orDie)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("[release-snapshots] wrote")
      expect(decodedSnapshot.packageName).toBe("@fixtures/public-surface")
      expect(decodedSnapshot.releasedVersion).toBe("0.3.0")
      expect(decodedSnapshot.exports.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(BunContext.layer)))
})
