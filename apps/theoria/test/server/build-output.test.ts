import type { Path } from "@effect/platform"
import { Error as PlatformError, FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Effect, Either, Layer, type Scope } from "effect"
import * as Arr from "effect/Array"

import {
  type BuildOutputError,
  type BuildOutputSummary,
  checkBuildOutput
} from "../../app/server/config/build-output.js"

/**
 * The smallest deployable layout, written literally so the test does not
 * inherit its expectations from the code under test; `mutate` then edits it.
 */
const checkLayout = (
  mutate: (root: string) => Effect.Effect<void, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>
) =>
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
    // Only a verdict is an outcome; a filesystem the check could not examine fails the test.
    return yield* checkBuildOutput(root).pipe(
      Effect.map(Either.right),
      Effect.catchTag("BuildOutputError", (error) => Effect.succeed(Either.left(error)))
    )
  }).pipe(Effect.scoped, Effect.provide(BunContext.layer))

const problemsOf = (result: Either.Either<BuildOutputSummary, BuildOutputError>) =>
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

it.effect("a link out of the artifact is rejected even when its target is a typed file", () =>
  Effect.gen(function*() {
    const result = yield* checkLayout((root) =>
      Effect.gen(function*() {
        const fileSystem = yield* FileSystem.FileSystem
        const outside = yield* fileSystem.makeTempDirectoryScoped()
        yield* fileSystem.writeFileString(`${outside}/leak.html`, "")
        yield* fileSystem.symlink(`${outside}/leak.html`, `${root}/dist/leak.html`)
      })
    )
    expect(problemsOf(result)).toEqual(["dist/leak.html: is a SymbolicLink, not a regular file"])
  }))

it.effect("a filesystem that cannot be examined fails the check instead of producing a verdict", () =>
  Effect.gen(function*() {
    const denied = new PlatformError.SystemError({
      reason: "PermissionDenied",
      module: "FileSystem",
      method: "realPath",
      pathOrDescriptor: "dist/index.html"
    })
    const denyingFileSystem = Layer.effect(
      FileSystem.FileSystem,
      Effect.map(FileSystem.FileSystem, (fileSystem) =>
        FileSystem.make({
          ...fileSystem,
          realPath: (target) => target.endsWith("dist/index.html") ? Effect.fail(denied) : fileSystem.realPath(target)
        }))
    )
    const fileSystem = yield* FileSystem.FileSystem
    const root = yield* fileSystem.makeTempDirectoryScoped()
    yield* fileSystem.makeDirectory(`${root}/dist/docs-data`, { recursive: true })
    yield* fileSystem.makeDirectory(`${root}/.wrangler-out`)
    yield* fileSystem.writeFileString(`${root}/dist/index.html`, "<title>x</title>")
    yield* fileSystem.writeFileString(`${root}/dist/_headers`, "")
    yield* fileSystem.writeFileString(`${root}/dist/robots.txt`, "")
    yield* fileSystem.writeFileString(`${root}/dist/docs-data/manifest.json`, "{}")
    yield* fileSystem.writeFileString(`${root}/.wrangler-out/worker.js`, "")

    const outcome = yield* checkBuildOutput(root).pipe(
      Effect.provide(Layer.provideMerge(denyingFileSystem, BunContext.layer)),
      Effect.either
    )
    expect(outcome).toEqual(Either.left(denied))
  }).pipe(Effect.scoped, Effect.provide(BunContext.layer)))
