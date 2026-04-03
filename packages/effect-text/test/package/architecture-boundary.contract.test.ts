import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { listTypeScriptFilesInDir, moduleSpecifiers, parseTypeScript } from "@theoria/source-proof"

const packageRootUrl = new URL("../../", import.meta.url)

const pathSegments = (value: string): ReadonlyArray<string> => value.split("/").filter((segment) => segment.length > 0)

const isPackageGlobalInternalSpecifier = (specifier: string): boolean => {
  const segments = pathSegments(specifier)
  const nonParentSegments = segments.filter((segment) => segment !== "..")
  return segments.includes("..") && nonParentSegments.length > 0 && nonParentSegments[0] === "internal"
}

const containsPathSegmentSequence = (specifier: string, expected: ReadonlyArray<string>): boolean => {
  const segments = pathSegments(specifier)

  if (expected.length === 0) {
    return false
  }

  const firstSegment = expected[0] ?? ""
  const startIndex = segments.indexOf(firstSegment)

  if (startIndex < 0) {
    return false
  }

  return expected.every((segment, index) => segments[index + startIndex] === segment)
}

describe("package architecture boundaries", () => {
  const parsedSourceFiles = Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const sourceFiles = yield* listTypeScriptFilesInDir(packageRootUrl, "src")

    return yield* Effect.forEach(sourceFiles, (file) =>
      fileSystem.readFileString(file.absolute).pipe(
        Effect.orDie,
        Effect.map((source) => ({
          path: file.relative,
          specifiers: moduleSpecifiers(parseTypeScript(file.relative, source))
        }))
      ))
  })

  it.effect("removes package-global internal imports and lowercases shared contracts imports", () =>
    Effect.gen(function*() {
      const sourceFiles = yield* parsedSourceFiles
      const packageGlobalInternalImports = sourceFiles.filter((file) =>
        file.specifiers.some((specifier) => isPackageGlobalInternalSpecifier(specifier))
      )
      const uppercaseContractsImports = sourceFiles.filter((file) =>
        file.specifiers.some((specifier) => specifier.endsWith("/Contracts/index.js"))
      )

      expect(packageGlobalInternalImports.map((file) => file.path)).toStrictEqual([])
      expect(uppercaseContractsImports.map((file) => file.path)).toStrictEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps domain-local internals private to the owning domain", () =>
    Effect.gen(function*() {
      const sourceFiles = yield* parsedSourceFiles
      const crossDomainInternalImports = sourceFiles.filter((file) =>
        file.specifiers.some(
          (specifier) =>
            (!file.path.startsWith("src/Text/") && containsPathSegmentSequence(specifier, ["Text", "internal"])) ||
            (!file.path.startsWith("src/Browser/") &&
              containsPathSegmentSequence(specifier, ["Browser", "internal"])) ||
            (!file.path.startsWith("src/experimental/Calibration/") &&
              containsPathSegmentSequence(specifier, ["experimental", "Calibration", "internal"]))
        )
      )

      expect(crossDomainInternalImports.map((file) => file.path)).toStrictEqual([])
    }).pipe(Effect.provide(BunContext.layer)))
})
