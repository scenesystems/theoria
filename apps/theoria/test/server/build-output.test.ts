import type { Path } from "@effect/platform"
import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Effect, Either } from "effect"
import * as Arr from "effect/Array"

import { checkBuildOutput } from "../../app/server/config/build-output.js"

/**
 * The smallest deployable layout, written literally so the test does not
 * inherit its expectations from the code under test; `mutate` then edits it.
 */
const checkLayout = (mutate: (root: string) => Effect.Effect<void, unknown, FileSystem.FileSystem | Path.Path>) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const root = yield* fileSystem.makeTempDirectoryScoped()
    yield* fileSystem.makeDirectory(`${root}/dist/docs-data`, { recursive: true })
    yield* fileSystem.makeDirectory(`${root}/.wrangler-out`)
    yield* fileSystem.writeFileString(`${root}/dist/index.html`, "<title>x</title>")
    yield* fileSystem.writeFileString(`${root}/dist/_headers`, "/*\n  X-Frame-Options: DENY\n")
    yield* fileSystem.writeFileString(`${root}/dist/robots.txt`, "User-agent: *\n")
    yield* fileSystem.writeFileString(`${root}/dist/docs-data/manifest.json`, "{}")
    yield* fileSystem.writeFileString(`${root}/.wrangler-out/worker.js`, "export default {}")
    yield* mutate(root)
    return yield* Effect.either(checkBuildOutput(root))
  }).pipe(Effect.scoped, Effect.provide(BunContext.layer))

const problemsOf = (result: Either.Either<{ readonly assets: number }, { readonly problems: ReadonlyArray<string> }>) =>
  Either.match(result, { onLeft: (error) => error.problems, onRight: () => Arr.empty<string>() })

it.effect("accepts a build whose every asset has a served content type", () =>
  Effect.gen(function*() {
    const result = yield* checkLayout((root) =>
      Effect.gen(function*() {
        const fileSystem = yield* FileSystem.FileSystem
        yield* fileSystem.makeDirectory(`${root}/dist/assets`)
        yield* fileSystem.writeFileString(`${root}/dist/assets/app-1a2b.js`, "")
        yield* fileSystem.writeFileString(`${root}/dist/site.webmanifest`, "{}")
        yield* fileSystem.writeFileString(`${root}/.wrangler-out/worker.js.map`, "{}")
        yield* fileSystem.writeFileString(`${root}/.wrangler-out/README.md`, "")
        yield* fileSystem.writeFileString(`${root}/.wrangler-out/abc-tiktoken_bg.wasm`, "")
      })
    )
    expect(Either.map(result, (summary) => summary.assets)).toEqual(Either.right(6))
  }))

it.effect("rejects an asset the server cannot type, naming it", () =>
  Effect.gen(function*() {
    const result = yield* checkLayout((root) =>
      Effect.flatMap(FileSystem.FileSystem, (fileSystem) => fileSystem.writeFileString(`${root}/dist/hero.avif`, ""))
    )
    expect(problemsOf(result)).toEqual(["dist/hero.avif: the server has no content type for this file"])
  }))

it.effect("rejects symbolic links even when they point at a typed file", () =>
  Effect.gen(function*() {
    const result = yield* checkLayout((root) =>
      Effect.flatMap(FileSystem.FileSystem, (fileSystem) =>
        fileSystem.symlink(`${root}/dist/index.html`, `${root}/dist/alias.html`))
    )
    expect(problemsOf(result)).toEqual(["dist/alias.html: is a SymbolicLink, not a regular file"])
  }))

it.effect("reports every problem in one run: missing files and stray Worker output", () =>
  Effect.gen(function*() {
    const result = yield* checkLayout((root) =>
      Effect.flatMap(FileSystem.FileSystem, (fileSystem) =>
        Effect.zipRight(
          fileSystem.remove(`${root}/dist/robots.txt`),
          fileSystem.writeFileString(`${root}/.wrangler-out/index.js`, "")
        ))
    )
    expect(problemsOf(result)).toEqual([
      "dist/robots.txt: missing",
      ".wrangler-out/index.js: only the Worker bundle, its source map, README and wasm modules ship"
    ])
  }))
