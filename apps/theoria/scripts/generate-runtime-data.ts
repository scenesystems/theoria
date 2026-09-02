/**
 * Writes the build-time runtime data the Theoria server reads through
 * `StaticStore` (see `app/server/config/runtime-data.ts`):
 *
 * - `public/runtime-data/program-sources.json` — demo program source files
 *
 * Run before `vite build` so the file lands in `dist/`. The output is
 * gitignored.
 */
import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect, Schema } from "effect"
import * as EffectRecord from "effect/Record"
import * as Tuple from "effect/Tuple"

import { ProgramSourcesJson, runtimeDataPathnames } from "../app/server/config/runtime-data.js"
import { runtimeDataPrefix } from "../app/server/config/static-store.js"
import { allProgramSourcePaths } from "../app/server/demos/program-sources.js"

const applicationRootUrl = new URL("../", import.meta.url)

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

  const sources = yield* programSources

  yield* fileSystem.writeFileString(
    outputPath(runtimeDataPathnames.programSources),
    yield* Schema.encode(ProgramSourcesJson)(sources)
  )

  yield* Console.log(`Wrote runtime data: ${String(EffectRecord.size(sources))} program sources.`)
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
