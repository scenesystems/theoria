import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "@effect/vitest"
import * as Arr from "effect/Array"

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const sourceRoot = join(packageRoot, "src")

const readTypeScriptFiles = (directory: string): ReadonlyArray<string> =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolvedPath = join(directory, entry.name)

    return entry.isDirectory()
      ? readTypeScriptFiles(resolvedPath)
      : resolvedPath.endsWith(".ts")
      ? [resolvedPath]
      : []
  })

const relativePath = (file: string): string => relative(packageRoot, file).replaceAll("\\", "/")

const importSpecifiers = (file: string): ReadonlyArray<string> =>
  Arr.fromIterable(
    readFileSync(file, "utf8").matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g)
  ).map((match) => match[1] ?? "")

describe("package architecture boundaries", () => {
  const sourceFiles = readTypeScriptFiles(sourceRoot)

  it("removes package-global internal imports and lowercases shared contracts imports", () => {
    const packageGlobalInternalImports = sourceFiles.filter((file) =>
      importSpecifiers(file).some((specifier) => /(?:\.\.\/)+internal\//.test(specifier))
    )
    const uppercaseContractsImports = sourceFiles.filter((file) =>
      importSpecifiers(file).some((specifier) => specifier.includes("/Contracts/index.js"))
    )

    expect(packageGlobalInternalImports.map(relativePath)).toStrictEqual([])
    expect(uppercaseContractsImports.map(relativePath)).toStrictEqual([])
  })

  it("keeps domain-local internals private to the owning domain", () => {
    const crossDomainInternalImports = sourceFiles.filter((file) => {
      const path = relativePath(file)
      const specifiers = importSpecifiers(file)

      return specifiers.some(
        (specifier) =>
          (!path.startsWith("src/Text/") && specifier.includes("/Text/internal/")) ||
          (!path.startsWith("src/Browser/") && specifier.includes("/Browser/internal/")) ||
          (!path.startsWith("src/experimental/Calibration/") &&
            specifier.includes("/experimental/Calibration/internal/"))
      )
    })

    expect(crossDomainInternalImports.map(relativePath)).toStrictEqual([])
  })
})
