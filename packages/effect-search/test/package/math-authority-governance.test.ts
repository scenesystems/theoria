import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Order } from "effect"

import {
  exportedDeclarationNames,
  listTypeScriptFilesInDir,
  moduleSpecifiers,
  parseTypeScript,
  readProjectFile
} from "@theoria/source-proof"

const packageRootUrl = new URL("../../", import.meta.url)

const APPROVED_EFFECT_MATH_IMPORTS = Arr.sort(
  Arr.make(
    "effect-math/Geometry",
    "effect-math/LinearAlgebra",
    "effect-math/Numeric",
    "effect-math/Probability",
    "effect-math/Special",
    "effect-math/Statistics"
  ),
  Order.string
)

const SCALAR_AUTHORITY_EXPORTS = Arr.sort(
  Arr.make("E", "EPSILON", "LN_2", "PI", "SQRT_2", "abs", "exp", "expm1", "log", "log1p", "sqrt"),
  Order.string
)

const sourceFiles = listTypeScriptFilesInDir(packageRootUrl, "src")

describe("package/math-authority-governance", () => {
  it.effect("keeps effect-math imports on approved public subpaths only", () =>
    Effect.gen(function*() {
      const files = yield* sourceFiles
      const usedSpecifiers = yield* Effect.forEach(files, (file) =>
        readProjectFile(packageRootUrl, file.relative).pipe(
          Effect.map((source) =>
            Arr.filter(
              moduleSpecifiers(parseTypeScript(file.relative, source)),
              (specifier) => specifier.startsWith("effect-math/")
            )
          )
        ))

      const flattened = Arr.sort(Arr.dedupe(Arr.flatMap(usedSpecifiers, (specifiers) => specifiers)), Order.string)

      expect(flattened).toEqual(APPROVED_EFFECT_MATH_IMPORTS)
      expect(Arr.every(flattened, (specifier) => !specifier.includes("/internal/"))).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps scalar authority out of effect-search source modules", () =>
    Effect.gen(function*() {
      const files = yield* sourceFiles
      const findings = yield* Effect.forEach(files, (file) =>
        readProjectFile(packageRootUrl, file.relative).pipe(
          Effect.map((source) =>
            Arr.filter(
              Arr.sort(Arr.dedupe(exportedDeclarationNames(parseTypeScript(file.relative, source))), Order.string),
              (name) => SCALAR_AUTHORITY_EXPORTS.includes(name)
            )
          ),
          Effect.map((exports) => ({
            path: file.relative,
            exports
          }))
        ))

      const duplicatedAuthority = Arr.filter(findings, ({ exports }) => exports.length > 0)

      expect(duplicatedAuthority).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps the old float64 adapter file absent from the source tree", () =>
    Effect.gen(function*() {
      const files = yield* sourceFiles

      expect(Arr.some(files, (file) => file.relative === "src/internal/float64.ts")).toBe(false)
    }).pipe(Effect.provide(BunContext.layer)))
})
