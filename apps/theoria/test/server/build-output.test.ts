import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { checkBuildOutput, requiredBuildFiles } from "../../app/server/config/build-output.js"

/** A minimal deployable layout, then `mutate` it before the check runs. */
const checkLayout = (mutate: (root: string) => Effect.Effect<void, unknown, FileSystem.FileSystem | Path.Path>) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* fileSystem.makeTempDirectoryScoped()
    yield* Effect.forEach(requiredBuildFiles, (file) =>
      Effect.zipRight(
        fileSystem.makeDirectory(path.dirname(path.join(root, file)), { recursive: true }),
        fileSystem.writeFileString(path.join(root, file), file)
      ))
    yield* mutate(root)
    return yield* Effect.either(checkBuildOutput(root))
  }).pipe(Effect.scoped, Effect.provide(BunContext.layer))

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
    expect(result._tag).toBe("Right")
    if (result._tag === "Right") expect(result.right.assets).toBe(6)
  }))

it.effect("rejects an asset the server cannot type, naming it", () =>
  Effect.gen(function*() {
    const result = yield* checkLayout((root) =>
      Effect.flatMap(FileSystem.FileSystem, (fileSystem) => fileSystem.writeFileString(`${root}/dist/hero.avif`, ""))
    )
    expect(result._tag).toBe("Left")
    if (result._tag === "Left") {
      expect(result.left.problems).toEqual(["dist/hero.avif: the server has no content type for this file"])
    }
  }))

it.effect("rejects stray Worker output and missing required files", () =>
  Effect.gen(function*() {
    const stray = yield* checkLayout((root) =>
      Effect.flatMap(FileSystem.FileSystem, (fileSystem) =>
        fileSystem.writeFileString(`${root}/.wrangler-out/index.js`, ""))
    )
    expect(stray._tag).toBe("Left")
    if (stray._tag === "Left") {
      expect(stray.left.problems[0]).toMatch(/^\.wrangler-out\/index\.js: only the Worker bundle/)
    }

    const missing = yield* checkLayout((root) =>
      Effect.flatMap(FileSystem.FileSystem, (fileSystem) =>
        fileSystem.remove(`${root}/dist/robots.txt`))
    )
    expect(missing._tag).toBe("Left")
    if (missing._tag === "Left") expect(missing.left.problems).toEqual(["dist/robots.txt: missing"])
  }))
