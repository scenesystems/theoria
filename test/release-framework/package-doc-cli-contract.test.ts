import { Command, FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema, Stream } from "effect"

import {
  loadPackageDocsCorpus,
  packageDocsAuthority,
  packageDocsBundle,
  packageDocsCatalog,
  PackageDocsBundleSchema,
  PackageDocsCatalogEntrySchema,
  PackageDocsSearchResultSchema,
  packageNameFromString,
  resolveRootFrom,
  searchPackageDocs,
  TheoriaPackageDocsAuthority
} from "../../packages/source-proof/src/index.js"

const repositoryRootUrl = new URL("../../", import.meta.url)

const RootManifestJson = Schema.parseJson(
  Schema.Struct({
    scripts: Schema.Record({
      key: Schema.String,
      value: Schema.String
    })
  })
)

const PackageDocsCatalogJson = Schema.parseJson(Schema.Array(PackageDocsCatalogEntrySchema))
const PackageDocsBundleJson = Schema.parseJson(PackageDocsBundleSchema)
const PackageDocsSearchResultsJson = Schema.parseJson(Schema.Array(PackageDocsSearchResultSchema))

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

const runShellCommand = (root: string, script: string) =>
  Effect.gen(function*() {
    const command = Command.make("bash", "-lc", script).pipe(
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

describe("package docs root cli contract", () => {
  it.effect("keeps the root docs CLI as the only canonical retrieval surface and wires the root script entrypoint", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const repositoryRoot = yield* resolveRootFrom(repositoryRootUrl)
      const manifestJson = yield* fileSystem.readFileString(path.join(repositoryRoot, "package.json")).pipe(Effect.orDie)
      const manifest = yield* Schema.decodeUnknown(RootManifestJson)(manifestJson).pipe(Effect.orDie)

      expect(packageDocsAuthority).toBe(TheoriaPackageDocsAuthority)
      expect(TheoriaPackageDocsAuthority.cliEntrypoints).toEqual(["scripts/docs-packages.ts"])
      expect(manifest.scripts["docs:packages"]).toBe("bun scripts/docs-packages.ts")
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("returns the same full-suite catalog as the root query engine", () =>
    Effect.gen(function*() {
      const repositoryRoot = yield* resolveRootFrom(repositoryRootUrl)
      const corpus = yield* loadPackageDocsCorpus({ repositoryRoot })
      const result = yield* runCommand(repositoryRoot, ["scripts/docs-packages.ts", "--catalog"])
      const catalog = yield* Schema.decodeUnknown(PackageDocsCatalogJson)(result.stdout).pipe(Effect.orDie)

      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe("")
      expect(catalog).toEqual(packageDocsCatalog(corpus))
      expect(catalog.map((entry) => entry.packageId)).toEqual([
        "@scenesystems/digest",
        "@scenesystems/seal",
        "@scenesystems/sign",
        "effect-dsp",
        "effect-inference",
        "effect-math",
        "effect-search",
        "effect-text"
      ])
    }).pipe(Effect.provide(BunContext.layer)))

  it.scoped("returns the same normalized package bundle and bounded search results as the root query engine", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const repositoryRoot = yield* resolveRootFrom(repositoryRootUrl)
      const corpus = yield* loadPackageDocsCorpus({ repositoryRoot })
      const temporaryDirectory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "package-doc-cli-" })
      const bundlePath = path.join(temporaryDirectory, "sign-bundle.json")
      const bundleResult = yield* runShellCommand(
        repositoryRoot,
        `bun scripts/docs-packages.ts --package @scenesystems/sign --view agent > ${bundlePath}`
      )
      const searchResult = yield* runCommand(repositoryRoot, [
        "scripts/docs-packages.ts",
        "--search",
        "study snapshot",
        "--limit",
        "10"
      ])
      const bundleJson = yield* fileSystem.readFileString(bundlePath).pipe(Effect.orDie)
      const bundle = yield* Schema.decodeUnknown(PackageDocsBundleJson)(bundleJson).pipe(Effect.orDie)
      const results = yield* Schema.decodeUnknown(PackageDocsSearchResultsJson)(searchResult.stdout).pipe(Effect.orDie)
      const expectedBundle = packageDocsBundle(corpus, packageNameFromString("@scenesystems/sign"))
      const expectedResults = searchPackageDocs(corpus, {
        query: "study snapshot",
        packageId: null,
        limit: 10
      })

      expect(bundleResult.exitCode).toBe(0)
      expect(bundleResult.stdout).toBe("")
      expect(bundleResult.stderr).toBe("")
      expect(searchResult.exitCode).toBe(0)
      expect(searchResult.stderr).toBe("")
      expect(expectedBundle._tag).toBe("Some")

      if (expectedBundle._tag === "None") {
        return
      }

      expect(bundle).toEqual(expectedBundle.value)
      expect(results).toEqual(expectedResults)
    }).pipe(Effect.provide(BunContext.layer)))
})
