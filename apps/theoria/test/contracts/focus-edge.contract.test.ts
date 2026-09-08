import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { focusEdgeClassName, forcedColorsFocusClassName } from "../../app/web/view/primitives/designSystem.js"

/** The app's `app/web` directory, from this file rather than the working directory: the root test run starts elsewhere. */
const webRoot: Effect.Effect<string, never, Path.Path> = Effect.gen(function*() {
  const path = yield* Path.Path
  return yield* path.fromFileUrl(yield* Url.fromString("../../app/web/", import.meta.url))
}).pipe(Effect.orDie)

/** The one module allowed to write `outline-none`: it pairs the word with its forced-colours restoration. */
const focusEdgeAuthority = "view/primitives/designSystem.ts"

const isSource = (file: string): boolean =>
  (Str.endsWith(".ts")(file) || Str.endsWith(".tsx")(file)) && !Str.includes(".generated.")(file)

describe("Focus edge contract", () => {
  it.effect("no class string drops the focus outline without the forced-colours restoration", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* webRoot
      const files = yield* fileSystem.readDirectory(root, { recursive: true }).pipe(
        Effect.map(Arr.filter(isSource)),
        Effect.orDie
      )
      expect(files).toContain(focusEdgeAuthority)

      const offenders = yield* Effect.forEach(
        Arr.filter(files, (file) => file !== focusEdgeAuthority),
        (file) =>
          fileSystem.readFileString(path.join(root, file)).pipe(
            Effect.map((source) => Str.includes("outline-none")(source) ? Arr.of(file) : Arr.empty<string>()),
            Effect.orDie
          ),
        { concurrency: "unbounded" }
      ).pipe(Effect.map(Arr.flatten))

      expect(offenders).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("the sanctioned focus edge restores a solid Highlight outline under forced colours", () =>
    Effect.gen(function*() {
      expect(focusEdgeClassName).toContain("focus-visible:outline-none")
      expect(focusEdgeClassName).toContain(forcedColorsFocusClassName)
      expect(forcedColorsFocusClassName).toContain("forced-colors:focus-visible:outline-solid")
      expect(forcedColorsFocusClassName).toContain("forced-colors:focus-visible:outline-[Highlight]")
      expect(forcedColorsFocusClassName).not.toContain("outline-none")
    }))
})
