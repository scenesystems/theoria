import { Command, FileSystem, HttpServerResponse, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import {
  loadPackageDocsCorpus,
  packageDocsBundle,
  PackageDocsBundleSchema,
  packageDocsCatalog,
  PackageDocsCatalogEntrySchema,
  PackageDocsSearchResultSchema,
  packageNameFromString,
  resolveRootFrom,
  searchPackageDocs
} from "@theoria/source-proof"
import { Effect, Option, Schema, Stream } from "effect"

import {
  PackageDocsBundleEnvelope,
  PackageDocsCatalogEnvelope,
  PackageDocsSearchEnvelope
} from "../../app/contracts/presentation/package-docs.js"
import { PackageDocsLive } from "../../app/server/config/package-docs.js"
import { RuntimeInfoLive } from "../../app/server/config/runtime.js"
import { packageDocsRoute } from "../../app/server/routes/package-docs.js"

class ResponseJsonError extends Schema.TaggedError<ResponseJsonError>()("ResponseJsonError", {
  message: Schema.String
}) {}

const repositoryRootUrl = new URL("../../../../", import.meta.url)

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
      stderr,
      stdout
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
      stderr,
      stdout
    }
  }).pipe(Effect.scoped)

const decodeWebJson = <A, I>(
  response: HttpServerResponse.HttpServerResponse,
  schema: Schema.Schema<A, I>
) =>
  Effect.gen(function*() {
    const webResponse = HttpServerResponse.toWeb(response)
    const body = yield* Effect.tryPromise({
      try: () => webResponse.json(),
      catch: (cause) => new ResponseJsonError({ message: String(cause) })
    }).pipe(Effect.orDie)

    return yield* Schema.decodeUnknown(schema)(body).pipe(Effect.orDie)
  })

const provideServer = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provide(PackageDocsLive),
    Effect.provide(RuntimeInfoLive),
    Effect.provide(BunContext.layer)
  )

describe("server/package-doc-consumer-alignment", () => {
  it.scoped(
    "keeps the root query engine, root CLI, and thin app API on one canonical package-doc corpus",
    () =>
      provideServer(
        Effect.gen(function*() {
          const fileSystem = yield* FileSystem.FileSystem
          const path = yield* Path.Path
          const repositoryRoot = yield* resolveRootFrom(repositoryRootUrl)
          const corpus = yield* loadPackageDocsCorpus({ repositoryRoot })
          const temporaryDirectory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "package-doc-consumer-" })
          const bundlePath = path.join(temporaryDirectory, "sign-bundle.json")
          const bundlePackageId = packageNameFromString("@scenesystems/sign")
          const searchPackageId = packageNameFromString("effect-search")
          const expectedCatalog = packageDocsCatalog(corpus)
          const expectedBundle = packageDocsBundle(corpus, bundlePackageId)
          const expectedSearch = searchPackageDocs(corpus, {
            query: "study snapshot",
            packageId: searchPackageId,
            limit: 5
          })
          const catalogCli = yield* runCommand(repositoryRoot, ["scripts/docs-packages.ts", "--catalog"])
          const bundleCli = yield* runShellCommand(
            repositoryRoot,
            `bun scripts/docs-packages.ts --package @scenesystems/sign --view agent > ${bundlePath}`
          )
          const searchCli = yield* runCommand(repositoryRoot, [
            "scripts/docs-packages.ts",
            "--search",
            "study snapshot",
            "--package",
            "effect-search",
            "--limit",
            "5"
          ])
          const bundleCliOutput = yield* fileSystem.readFileString(bundlePath).pipe(Effect.orDie)
          const catalogCliJson = yield* Schema.decodeUnknown(PackageDocsCatalogJson)(catalogCli.stdout).pipe(
            Effect.orDie
          )
          const bundleCliJson = yield* Schema.decodeUnknown(PackageDocsBundleJson)(bundleCliOutput).pipe(
            Effect.orDie
          )
          const searchCliJson = yield* Schema.decodeUnknown(PackageDocsSearchResultsJson)(searchCli.stdout).pipe(
            Effect.orDie
          )
          const catalogResponse = yield* packageDocsRoute(
            "/api/package-docs/catalog",
            "req-catalog",
            "http://127.0.0.1/api/package-docs/catalog"
          )
          const bundleResponse = yield* packageDocsRoute(
            "/api/package-docs/bundle",
            "req-bundle",
            "http://127.0.0.1/api/package-docs/bundle?package=%40scenesystems%2Fsign"
          )
          const searchResponse = yield* packageDocsRoute(
            "/api/package-docs/search",
            "req-search",
            "http://127.0.0.1/api/package-docs/search?query=study%20snapshot&package=effect-search&limit=5"
          )
          const catalogEnvelope = yield* decodeWebJson(catalogResponse, PackageDocsCatalogEnvelope)
          const bundleEnvelope = yield* decodeWebJson(bundleResponse, PackageDocsBundleEnvelope)
          const searchEnvelope = yield* decodeWebJson(searchResponse, PackageDocsSearchEnvelope)

          expect(catalogCli.exitCode).toBe(0)
          expect(bundleCli.exitCode).toBe(0)
          expect(searchCli.exitCode).toBe(0)
          expect(catalogCli.stderr).toBe("")
          expect(bundleCli.stdout).toBe("")
          expect(bundleCli.stderr).toBe("")
          expect(searchCli.stderr).toBe("")
          expect(catalogEnvelope.ok).toBe(true)
          expect(bundleEnvelope.ok).toBe(true)
          expect(searchEnvelope.ok).toBe(true)
          expect(Option.isSome(expectedBundle)).toBe(true)

          if (!catalogEnvelope.ok || !bundleEnvelope.ok || !searchEnvelope.ok || Option.isNone(expectedBundle)) {
            return
          }

          expect(catalogCliJson).toEqual(expectedCatalog)
          expect(bundleCliJson).toEqual(expectedBundle.value)
          expect(searchCliJson).toEqual(expectedSearch)
          expect(catalogEnvelope.data).toEqual(expectedCatalog)
          expect(bundleEnvelope.data).toEqual(expectedBundle.value)
          expect(searchEnvelope.data).toEqual(expectedSearch)
          expect(catalogEnvelope.data).toEqual(catalogCliJson)
          expect(bundleEnvelope.data).toEqual(bundleCliJson)
          expect(searchEnvelope.data).toEqual(searchCliJson)
        })
      ),
    { timeout: 60_000 }
  )
})
