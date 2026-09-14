import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"
import * as Order from "effect/Order"
import * as Str from "effect/String"

import viteConfig from "../../vite.config.js"

/** The app's directory, from this file rather than the working directory: the root test run starts elsewhere. */
const appRoot: Effect.Effect<string, never, Path.Path> = Effect.gen(function*() {
  const path = yield* Path.Path
  return yield* path.fromFileUrl(yield* Url.fromString("../../", import.meta.url))
}).pipe(Effect.orDie)

/** The directories whose modules the browser loads from the dev server unbundled: the roots of the client graph. */
const clientRoots = ["app/web", "app/contracts"]

const isSource = (file: string): boolean =>
  (Str.endsWith(".ts")(file) || Str.endsWith(".tsx")(file)) && !Str.includes(".test.")(file)

/** Every `from "…"` naming a workspace package, then the type-only ones among them, which load nothing. */
const workspaceSpecifier = /\bfrom\s+"((?:@scenesystems|@theoria)\/[^"]+)"/g
const typeOnlySpecifier = /\b(?:import|export)\s+type\b[\s\S]*?\bfrom\s+"((?:@scenesystems|@theoria)\/[^"]+)"/g

const specifiers = (source: string, pattern: RegExp): ReadonlyArray<string> =>
  Arr.map(Arr.fromIterable(source.matchAll(pattern)), (match) => match[1] ?? "")

/** The specifiers a module loads at run time: each `from`, less one occurrence per type-only statement naming it. */
const loadedSpecifiers = (source: string): ReadonlyArray<string> =>
  Arr.reduce(
    specifiers(source, typeOnlySpecifier),
    specifiers(source, workspaceSpecifier),
    (remaining, typeOnly) =>
      Option.match(Arr.findFirstIndex(remaining, (specifier) => specifier === typeOnly), {
        onNone: () => remaining,
        onSome: (index) => Arr.remove(remaining, index)
      })
  )

const sortedUnique = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  Arr.sort(Arr.dedupe(values), Order.string)

/**
 * The workspace packages export their `src/*.ts`, so the dev server treats
 * them as linked source and serves every module of the graph one request at
 * a time unless the package is pre-bundled. This contract keeps
 * `optimizeDeps.include` equal to the set of workspace specifiers the client
 * loads: a new import of an unlisted subpath would bring the waterfall back,
 * and a stale entry would name a package the client no longer uses.
 */
describe("Dev pre-bundle contract", () => {
  it.effect("every workspace specifier the client loads is pre-bundled, and nothing else is", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* appRoot

      const files = yield* Effect.forEach(
        clientRoots,
        (directory) =>
          fileSystem.readDirectory(path.join(root, directory), { recursive: true }).pipe(
            Effect.map(Arr.filter(isSource)),
            Effect.map(Arr.map((file) => path.join(root, directory, file))),
            Effect.orDie
          )
      ).pipe(Effect.map(Arr.flatten))
      expect(files.length).toBeGreaterThan(0)

      const loaded = yield* Effect.forEach(
        files,
        (file) => fileSystem.readFileString(file).pipe(Effect.map(loadedSpecifiers), Effect.orDie),
        { concurrency: "unbounded" }
      ).pipe(Effect.map(Arr.flatten), Effect.map(sortedUnique))

      expect(viteConfig.optimizeDeps?.include).toEqual(loaded)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("a type-only import loads nothing, so it asks for no pre-bundle", () =>
    Effect.gen(function*() {
      expect(loadedSpecifiers(`import type { A } from "@scenesystems/effect-math/Complex"`)).toEqual([])
      expect(loadedSpecifiers(`export type { A } from "@scenesystems/effect-math/Complex"`)).toEqual([])
      expect(loadedSpecifiers(`import { type A, b } from "@scenesystems/effect-math/Complex"`)).toEqual([
        "@scenesystems/effect-math/Complex"
      ])
      expect(loadedSpecifiers([
        `import type { A } from "@scenesystems/effect-math/Complex"`,
        `import { b } from "@scenesystems/effect-math/Complex"`
      ].join("\n"))).toEqual(["@scenesystems/effect-math/Complex"])
    }))
})
