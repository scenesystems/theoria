import { existsSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "@effect/vitest"

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const srcRoot = join(packageRoot, "src")

describe("package structure contracts", () => {
  it("keeps the converged shared authority and runtime internals in canonical locations", () => {
    const expectedPaths = [
      "src/contracts/index.ts",
      "src/Text/internal/analysis.ts",
      "src/Text/internal/layout.ts",
      "src/Text/internal/preparation.ts",
      "src/Browser/internal/canvas.ts"
    ]
    const srcEntries = readdirSync(srcRoot)

    expect(expectedPaths.every((path) => existsSync(join(packageRoot, path)))).toStrictEqual(true)
    expect(srcEntries.includes("Contracts")).toStrictEqual(false)
    expect(srcEntries.includes("internal")).toStrictEqual(false)
  })

  it("keeps Text as the canonical runtime domain root", () => {
    expect(readdirSync(join(srcRoot, "Text")).sort()).toStrictEqual(
      ["constructors.ts", "index.ts", "internal", "layers.ts", "layout.ts", "model.ts", "schema.ts"].sort()
    )
  })

  it("reserves companion-domain barrels and experimental internals in the converged package anatomy", () => {
    expect(existsSync(join(packageRoot, "src/Browser/index.ts"))).toStrictEqual(true)
    expect(existsSync(join(packageRoot, "src/React/index.ts"))).toStrictEqual(true)
    expect(existsSync(join(packageRoot, "src/experimental/Calibration/internal"))).toStrictEqual(true)
  })
})
