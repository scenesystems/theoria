import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import { listTypeScriptFilesInDir, moduleSpecifiers, parseTypeScript } from "@theoria/source-proof"

const packageRootUrl = new URL("../../", import.meta.url)

const pathSegments = (value: string): ReadonlyArray<string> =>
  Arr.filter(Arr.fromIterable(value.split("/")), (segment) => segment.length > 0)

const isPackageGlobalInternalSpecifier = (specifier: string): boolean => {
  const segments = pathSegments(specifier)
  const nonParentSegments = Arr.filter(segments, (segment) => segment !== "..")

  return Arr.some(segments, (segment) => segment === "..") &&
    Arr.get(nonParentSegments, 0).pipe(
      Option.match({
        onNone: () => false,
        onSome: (segment) => segment === "internal"
      })
    )
}

const containsPathSegmentSequence = (specifier: string, expected: ReadonlyArray<string>): boolean => {
  const segments = pathSegments(specifier)

  return Arr.head(expected).pipe(
    Option.match({
      onNone: () => false,
      onSome: (firstSegment) =>
        Arr.findFirstIndex(segments, (segment) => segment === firstSegment).pipe(
          Option.match({
            onNone: () => false,
            onSome: (startIndex) => Arr.every(expected, (segment, index) => segments[index + startIndex] === segment)
          })
        )
    })
  )
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
      const packageGlobalInternalImports = Arr.filter(
        sourceFiles,
        (file) => Arr.some(file.specifiers, (specifier) => isPackageGlobalInternalSpecifier(specifier))
      )
      const uppercaseContractsImports = Arr.filter(
        sourceFiles,
        (file) => Arr.some(file.specifiers, (specifier) => specifier.endsWith("/Contracts/index.js"))
      )

      expect(Arr.map(packageGlobalInternalImports, (file) => file.path)).toStrictEqual([])
      expect(Arr.map(uppercaseContractsImports, (file) => file.path)).toStrictEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps domain-local internals private to the owning domain", () =>
    Effect.gen(function*() {
      const sourceFiles = yield* parsedSourceFiles
      const crossDomainInternalImports = Arr.filter(
        sourceFiles,
        (file) =>
          Arr.some(
            file.specifiers,
            (specifier) =>
              (!file.path.startsWith("src/Text/") && containsPathSegmentSequence(specifier, ["Text", "internal"])) ||
              (!file.path.startsWith("src/Browser/") &&
                containsPathSegmentSequence(specifier, ["Browser", "internal"])) ||
              (!file.path.startsWith("src/experimental/Calibration/") &&
                containsPathSegmentSequence(specifier, ["experimental", "Calibration", "internal"]))
          )
      )
      expect(Arr.map(crossDomainInternalImports, (file) => file.path)).toStrictEqual([])
    }).pipe(Effect.provide(BunContext.layer)))
})
