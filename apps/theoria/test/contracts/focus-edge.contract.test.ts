import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"
import * as Equal from "effect/Equal"
import * as Predicate from "effect/Predicate"
import * as Str from "effect/String"

import {
  focusEdgeClassName,
  forcedColorsAnsweringOutlineClassName,
  forcedColorsFocusClassName,
  silentOutlineClassName
} from "../../app/web/view/primitives/designSystem.js"

/** The app's `app/web` directory, from this file rather than the working directory: the root test run starts elsewhere. */
const webRoot: Effect.Effect<string, never, Path.Path> = Effect.gen(function*() {
  const path = yield* Path.Path
  return yield* path.fromFileUrl(yield* Url.fromString("../../app/web/", import.meta.url))
}).pipe(Effect.orDie)

/** The one module allowed to write `outline-none`: it pairs the word with its forced-colours restoration. */
const focusEdgeAuthority = "view/primitives/designSystem.ts"

const isSource: Predicate.Predicate<string> = Predicate.and(
  Predicate.or(Str.endsWith(".ts"), Str.endsWith(".tsx")),
  Predicate.not(Str.includes(".generated."))
)

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

      const offenders = yield* Effect.filter(
        Arr.filter(files, Predicate.not(Equal.equals(focusEdgeAuthority))),
        (file) =>
          fileSystem.readFileString(path.join(root, file)).pipe(
            Effect.map(Str.includes("outline-none")),
            Effect.orDie
          ),
        { concurrency: "unbounded" }
      )

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

  it.effect("the silent outline is none under forced colours, and answering says solid Highlight again", () =>
    Effect.gen(function*() {
      expect(silentOutlineClassName).toContain("outline-transparent")
      expect(silentOutlineClassName).toContain("forced-colors:outline-none")
      expect(forcedColorsAnsweringOutlineClassName).toContain("forced-colors:data-[popup-open]:outline-solid")
      expect(forcedColorsAnsweringOutlineClassName).toContain("forced-colors:data-[popup-open]:outline-[Highlight]")
      expect(forcedColorsAnsweringOutlineClassName).toContain("forced-colors:data-[place-focused]:outline-solid")
      expect(forcedColorsAnsweringOutlineClassName).toContain("forced-colors:data-[place-focused]:outline-[Highlight]")
      expect(forcedColorsAnsweringOutlineClassName).not.toContain("outline-none")
    }))
})
