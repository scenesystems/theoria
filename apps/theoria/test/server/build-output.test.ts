import type { Path } from "@effect/platform"
import { Error as PlatformError, FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Effect, Either, Layer, type Scope } from "effect"
import * as Arr from "effect/Array"

import { type WebVitalBudgets, webVitalBudgets } from "../../app/contracts/performance.js"
import {
  type BuildOutputError,
  type BuildOutputSummary,
  checkBuildOutput,
  homepageScripts
} from "../../app/server/config/build-output.js"

/**
 * The smallest deployable layout, written literally so the test does not
 * inherit its expectations from the code under test; `mutate` then edits it.
 */
const checkLayout = (
  mutate: (root: string) => Effect.Effect<void, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>,
  budgets: WebVitalBudgets = webVitalBudgets
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
    return yield* checkBuildOutput(root, budgets).pipe(
      Effect.map(Either.right),
      Effect.catchTag("BuildOutputError", (error) => Effect.succeed(Either.left(error)))
    )
  }).pipe(Effect.scoped, Effect.provide(BunContext.layer))

const problemsOf = (result: Either.Either<BuildOutputSummary, BuildOutputError>) =>
  Either.match(result, { onLeft: (error) => error.problems, onRight: () => Arr.empty<string>() })

it.effect("finds the homepage module entry and modulepreloads in document order", () =>
  Effect.sync(() => {
    const html = `<script type="module" crossorigin src="/assets/index-a.js"></script>
<link rel="modulepreload" crossorigin href="/assets/runtime-b.js">
<link crossorigin href="/assets/vendor-c.js" rel="modulepreload">
<link rel="stylesheet" crossorigin href="/assets/index.css">
<link rel="icon" href="/icon.svg">
<script type="module" src="/assets/index-a.js"></script>`
    expect(homepageScripts(html)).toEqual([
      "/assets/index-a.js",
      "/assets/runtime-b.js",
      "/assets/vendor-c.js"
    ])
  }))

it.effect("accepts named homepage scripts and reports the bytes they take on the wire, gzip-encoded", () =>
  Effect.gen(function*() {
    // Two scripts of 8 KiB of one repeated line: raw they are 16 KiB; gzip
    // brings each under a few hundred bytes and cannot go below its own 18
    // bytes of header and trailer. The sum is in that band only if it is the
    // encoded size of both.
    const line = "export const value = 0;\n"
    const script = line.repeat(8192 / line.length)
    const result = yield* checkLayout((root) =>
      Effect.gen(function*() {
        const fileSystem = yield* FileSystem.FileSystem
        yield* fileSystem.makeDirectory(`${root}/dist/assets`)
        yield* fileSystem.writeFileString(
          `${root}/dist/index.html`,
          `<script type="module" src="/assets/entry.js"></script><link rel="modulepreload" href="/assets/vendor.js">`
        )
        yield* fileSystem.writeFileString(`${root}/dist/assets/entry.js`, script)
        yield* fileSystem.writeFileString(`${root}/dist/assets/vendor.js`, script)
      })
    )
    const bytes = Either.getOrElse(Either.map(result, (summary) => summary.homepageScriptGzipBytes), () => -1)
    expect(bytes).toBeGreaterThan(2 * 18)
    expect(bytes).toBeLessThan(2 * 512)
  }))

it.effect("rejects a homepage script named by the HTML that is missing", () =>
  Effect.gen(function*() {
    const result = yield* checkLayout((root) =>
      Effect.flatMap(FileSystem.FileSystem, (fileSystem) =>
        fileSystem.writeFileString(
          `${root}/dist/index.html`,
          `<script type="module" src="/assets/missing.js"></script>`
        ))
    )
    expect(problemsOf(result)).toEqual(["dist/assets/missing.js: named by dist/index.html but missing"])
  }))

it.effect("rejects homepage scripts whose gzip sum exceeds the budget", () =>
  Effect.gen(function*() {
    const result = yield* checkLayout(
      (root) =>
        Effect.gen(function*() {
          const fileSystem = yield* FileSystem.FileSystem
          yield* fileSystem.makeDirectory(`${root}/dist/assets`)
          yield* fileSystem.writeFileString(
            `${root}/dist/index.html`,
            `<script type="module" src="/assets/entry.js"></script>`
          )
          yield* fileSystem.writeFileString(`${root}/dist/assets/entry.js`, "a script beyond this test's budget")
        }),
      // Below gzip's own 18 bytes of header and trailer, so any script is over it.
      { ...webVitalBudgets, homepageScriptGzipBytes: 10 }
    )
    expect(problemsOf(result)).toEqual([
      expect.stringMatching(/^dist\/index\.html: homepage scripts are \d+ gzip bytes, over the budget of 10$/u)
    ])
  }))

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
