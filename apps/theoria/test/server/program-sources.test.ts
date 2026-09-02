import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { resolveRootFrom } from "@theoria/source-proof"
import { Effect, Layer, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import * as EffectRecord from "effect/Record"

import { ProgramSourcesJson, runtimeDataPathnames } from "../../app/server/config/runtime-data.js"
import { StaticStore, StaticStoreError } from "../../app/server/config/static-store.js"
import { preloadProgram as preloadDigestProgram } from "../../app/server/demos/digest/run.js"
import { preloadProgram as preloadEffectDspProgram } from "../../app/server/demos/effect-dsp/run.js"
import { preloadProgram as preloadEffectSearchProgram } from "../../app/server/demos/effect-search/preload.js"
import { preloadProgram as preloadEffectTextProgram } from "../../app/server/demos/effect-text/preload.js"
import {
  allProgramSourcePaths,
  programDemoIds,
  programEntriesForDemo,
  programFromSources,
  ProgramSourcesLive
} from "../../app/server/demos/program-sources.js"

const projectRootUrl = new URL("../../", import.meta.url)

const fixtureSources: Record<string, string> = EffectRecord.fromEntries(
  Arr.map(allProgramSourcePaths, (appPath) => [appPath, `// ${appPath}\nexport const marker = 1\n`])
)

const staticStoreFromTable = (table: Record<string, string>) =>
  Layer.succeed(
    StaticStore,
    StaticStore.of({
      text: (pathname) =>
        EffectRecord.get(table, pathname).pipe(
          Effect.mapError(() => new StaticStoreError({ pathname, message: "missing" }))
        ),
      response: () => Effect.succeed(Option.none())
    })
  )

const runtimeDataLayer = (sources: Record<string, string>) =>
  ProgramSourcesLive.pipe(
    Layer.provide(
      Layer.unwrapEffect(
        Schema.encode(ProgramSourcesJson)(sources).pipe(
          Effect.map((json) => staticStoreFromTable({ [runtimeDataPathnames.programSources]: json }))
        )
      )
    )
  )

it("publishes a virtual workspace for prepared effect-text sources", () => {
  expect(programEntriesForDemo("effect-text")).toEqual([
    "server/run.ts",
    "server/package-story.ts",
    "web/text/browserTextLayout.ts",
    "web/view/text/authority.ts",
    "web/atoms/text.ts",
    "web/atoms/reflow.ts"
  ])
})

it("keeps related contract and animation files in the prepared workspace", () => {
  expect(programEntriesForDemo("effect-search")).toEqual([
    "server/run.ts",
    "contracts/demo/objective.ts",
    "web/atoms/optimization-animation.ts"
  ])
})

it("publishes the DSP contract beside the runnable workspace", () => {
  expect(programEntriesForDemo("effect-dsp")).toEqual(["server/run.ts", "contracts/demo/dsp.ts"])
})

it("strips repository coordinates from single-file demo workspaces", () => {
  expect(programEntriesForDemo("digest")).toEqual(["server/run.ts"])
})

it.effect("every registered program source exists in the app tree", () =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const projectRoot = yield* resolveRootFrom(projectRootUrl)
    const missing = yield* Effect.filter(
      allProgramSourcePaths,
      (appPath) => Effect.map(fileSystem.exists(path.join(projectRoot, "app", appPath)), (exists) => !exists)
    )

    expect(missing).toEqual([])
  }).pipe(Effect.provide(BunContext.layer)))

it.effect("demo preloads read their programs from the generated runtime data", () =>
  Effect.gen(function*() {
    const digest = yield* preloadDigestProgram
    const dsp = yield* preloadEffectDspProgram
    const search = yield* preloadEffectSearchProgram
    const text = yield* preloadEffectTextProgram

    expect(digest.files.map((file) => file.entry)).toEqual(["server/run.ts"])
    expect(digest.files[0].source).toBe(fixtureSources["server/demos/digest/run.ts"])
    expect(dsp.files.map((file) => file.name)).toEqual(["run.ts", "dsp.ts"])
    expect(search.files).toHaveLength(3)
    expect(text.files).toHaveLength(6)
  }).pipe(Effect.provide(runtimeDataLayer(fixtureSources))))

it.effect("fails with the missing entry when the runtime data is incomplete", () =>
  Effect.gen(function*() {
    const error = yield* Effect.flip(programFromSources("effect-dsp", { "server/demos/effect-dsp/run.ts": "x" }))

    expect(error._tag).toBe("ProgramSourceReadError")
    expect(error.entry).toBe("contracts/demo/dsp.ts")
  }))

it("registers a program for every demo id", () => {
  expect(programDemoIds).toEqual([
    "effect-text",
    "effect-search",
    "effect-math",
    "effect-dsp",
    "digest",
    "sign",
    "seal"
  ])
})
