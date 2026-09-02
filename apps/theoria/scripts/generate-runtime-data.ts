/**
 * Writes the build-time runtime data the Theoria server reads through
 * `StaticStore` (see `app/server/config/runtime-data.ts`):
 *
 * - `public/runtime-data/package-versions.json` — workspace package versions
 * - `public/runtime-data/program-sources.json` — demo program source files
 *
 * Run before `vite build` so the files land in `dist/`. Both outputs are
 * gitignored.
 */
import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect, Schema } from "effect"
import * as Arr from "effect/Array"
import * as EffectRecord from "effect/Record"
import * as Tuple from "effect/Tuple"

import { PackageVersionsJson, ProgramSourcesJson, runtimeDataPathnames } from "../app/server/config/runtime-data.js"
import { runtimeDataPrefix } from "../app/server/config/static-store.js"
import { allProgramSourcePaths } from "../app/server/demos/program-sources.js"

const applicationRootUrl = new URL("../", import.meta.url)
const repositoryRootUrl = new URL("../../../", import.meta.url)

const PackageJson = Schema.parseJson(Schema.Struct({ name: Schema.String, version: Schema.String }))

const readPackageVersion = (packageJsonPath: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const content = yield* fileSystem.readFileString(packageJsonPath)
    const parsed = yield* Schema.decode(PackageJson)(content)

    return Tuple.make(parsed.name, parsed.version)
  }).pipe(Effect.option)

const packageVersions = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const repositoryRoot = yield* path.fromFileUrl(repositoryRootUrl)
  const packagesDir = path.join(repositoryRoot, "packages")
  const entries = yield* fileSystem.readDirectory(packagesDir)
  const pairs = yield* Effect.forEach(
    entries,
    (entry) => readPackageVersion(path.join(packagesDir, entry, "package.json")),
    { concurrency: "unbounded" }
  )

  return EffectRecord.fromEntries(Arr.getSomes(pairs))
})

const programSources = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const applicationRoot = yield* path.fromFileUrl(applicationRootUrl)
  const pairs = yield* Effect.forEach(
    allProgramSourcePaths,
    (appPath) =>
      fileSystem.readFileString(path.join(applicationRoot, "app", appPath)).pipe(
        Effect.map((source) => Tuple.make(appPath, source))
      ),
    { concurrency: 16 }
  )

  return EffectRecord.fromEntries(pairs)
})

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const applicationRoot = yield* path.fromFileUrl(applicationRootUrl)
  const outputPath = (pathname: string) => path.join(applicationRoot, "public", pathname.slice(1))

  yield* fileSystem.makeDirectory(outputPath(runtimeDataPrefix), { recursive: true })

  const versions = yield* packageVersions
  const sources = yield* programSources

  yield* fileSystem.writeFileString(
    outputPath(runtimeDataPathnames.packageVersions),
    yield* Schema.encode(PackageVersionsJson)(versions)
  )
  yield* fileSystem.writeFileString(
    outputPath(runtimeDataPathnames.programSources),
    yield* Schema.encode(ProgramSourcesJson)(sources)
  )

  yield* Console.log(
    `Wrote runtime data: ${String(EffectRecord.size(versions))} package versions, ${
      String(EffectRecord.size(sources))
    } program sources.`
  )
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
