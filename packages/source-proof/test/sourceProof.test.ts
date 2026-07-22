import { Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { moduleSpecifiers, parseTypeScript, readProjectFile, resolveRootFrom } from "../src/index.js"

const packageRootUrl = new URL("../", import.meta.url)

describe("source proof", () => {
  it.effect("resolves project roots from file URLs", () =>
    Effect.gen(function*() {
      const pathService = yield* Path.Path
      const expectedRoot = yield* pathService.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const resolvedRoot = yield* resolveRootFrom(packageRootUrl)

      expect(resolvedRoot).toBe(expectedRoot)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("reads project files from vite @fs roots", () =>
    Effect.gen(function*() {
      const pathService = yield* Path.Path
      const expectedRoot = yield* pathService.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const viteRootUrl = new URL(`http://localhost:5175/@fs${encodeURI(expectedRoot)}`)
      const resolvedRoot = yield* resolveRootFrom(viteRootUrl)
      const packageIndex = yield* readProjectFile(viteRootUrl, "src/index.ts")

      expect(resolvedRoot).toBe(expectedRoot)
      expect(packageIndex.includes("AST-backed source-structure proof helpers for Theoria tests.")).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("collects declaration import-type module specifiers", () =>
    Effect.sync(() => {
      const sourceFile = parseTypeScript(
        "fixture.d.ts",
        "export declare const digest: import(\"@noble/hashes/utils.js\").Hash<unknown>\n"
      )

      expect(moduleSpecifiers(sourceFile)).toEqual(["@noble/hashes/utils.js"])
    }))
})
