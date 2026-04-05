import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Order, Record as Rec } from "effect"

import {
  loadPublishReadinessManifest,
  moduleSpecifiers,
  parseTypeScript,
  resolveRootFrom,
  toSourceFilePath
} from "../../../source-proof/src/index.js"

const EFFECT_MATH_DOMAINS = Arr.make(
  "Numeric",
  "Algebra",
  "LinearAlgebra",
  "Calculus",
  "Special",
  "Probability",
  "Statistics",
  "Optimization",
  "Geometry",
  "Complex",
  "Distribution"
)

const BLOCKED_INTERNAL_EXPORTS = Arr.make(
  "./internal/*",
  "./Numeric/internal/*",
  "./Algebra/internal/*",
  "./LinearAlgebra/internal/*",
  "./Calculus/internal/*",
  "./Special/internal/*",
  "./Probability/internal/*",
  "./Statistics/internal/*",
  "./Optimization/internal/*",
  "./Geometry/internal/*",
  "./Complex/internal/*",
  "./Distribution/internal/*"
)

const EXPECTED_FIXTURE_GENERATOR_MODULES = Arr.make(
  "__init__.py",
  "_common.py",
  "algebra.py",
  "calculus.py",
  "complex.py",
  "distribution.py",
  "geometry.py",
  "linalg.py",
  "numeric.py",
  "numeric_logspace.py",
  "optimization.py",
  "probability.py",
  "special.py",
  "special_inverse.py",
  "statistics.py"
)

const packageRootUrl = new URL("../../", import.meta.url)

const listTypeScriptFiles = (
  directoryName: "src" | "test"
): Effect.Effect<
  Array<{ readonly absolute: string; readonly relative: string }>,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* resolveRootFrom(packageRootUrl)
    const absoluteDirectory = path.join(root, directoryName)
    const entries = yield* fileSystem.readDirectory(absoluteDirectory, { recursive: true }).pipe(Effect.orDie)

    return Arr.flatMap(entries, (entry) =>
      entry.endsWith(".ts")
        ? [toSourceFilePath(path, root, absoluteDirectory, entry)]
        : [])
  })

const toDomain = (relativePath: string): Option.Option<string> => {
  const parts = relativePath.split("/")

  return Option.fromNullable(parts[1]).pipe(
    Option.filter((domain) => parts[0] === "src" && EFFECT_MATH_DOMAINS.includes(domain))
  )
}

const toInternalDomain = (relativePath: string): Option.Option<string> => {
  const parts = relativePath.split("/")

  return Option.fromNullable(parts[1]).pipe(
    Option.filter((domain) => parts[0] === "src" && parts[2] === "internal" && EFFECT_MATH_DOMAINS.includes(domain))
  )
}

const normalizedRelativeImport = (input: {
  readonly importerAbsolute: string
  readonly root: string
  readonly path: Path.Path
  readonly specifier: string
}): Option.Option<string> =>
  input.specifier.startsWith(".")
    ? Option.some(
      input.path.relative(
        input.root,
        input.path.normalize(input.path.join(input.path.dirname(input.importerAbsolute), input.specifier))
      ).replace(/\.js$/u, ".ts")
    )
    : Option.none()

const publicEntrypointRelativePaths: Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> =
  Effect.gen(
    function*() {
      const path = yield* Path.Path
      const root = yield* resolveRootFrom(packageRootUrl)
      const manifest = yield* loadPublishReadinessManifest(path.join(root, "package.json"))

      return Arr.sort(
        Arr.filterMap(
          Rec.toEntries(manifest.exports ?? {}),
          ([, target]) =>
            typeof target === "string" && target.startsWith("./src/") && target.endsWith("/index.ts")
              ? Option.some(target.slice(2))
              : Option.none<string>()
        ),
        Order.string
      )
    }
  )

const internalImportFindings: Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> = Effect
  .gen(
    function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* resolveRootFrom(packageRootUrl)
      const sourceFiles = yield* listTypeScriptFiles("src")
      const publicEntrypoints = yield* publicEntrypointRelativePaths
      const findings = yield* Effect.forEach(
        sourceFiles,
        (sourceFile) =>
          fileSystem.readFileString(sourceFile.absolute).pipe(
            Effect.orDie,
            Effect.map((content) => moduleSpecifiers(parseTypeScript(sourceFile.relative, content))),
            Effect.map((specifiers) =>
              Arr.filterMap(specifiers, (specifier) => {
                const resolvedImport = normalizedRelativeImport({
                  importerAbsolute: sourceFile.absolute,
                  root,
                  path,
                  specifier
                })

                return Option.flatMap(resolvedImport, (resolvedRelativePath) => {
                  const importerDomain = toDomain(sourceFile.relative)
                  const importedInternalDomain = toInternalDomain(resolvedRelativePath)
                  const crossesDomainBoundary = Option.match(Option.all([importerDomain, importedInternalDomain]), {
                    onNone: () => false,
                    onSome: ([currentDomain, importedDomain]) => currentDomain !== importedDomain
                  })
                  const leaksFromPublicEntrypoint = publicEntrypoints.includes(sourceFile.relative)
                    && Option.isSome(importedInternalDomain)

                  return crossesDomainBoundary || leaksFromPublicEntrypoint
                    ? Option.some(`${sourceFile.relative} -> ${specifier}`)
                    : Option.none<string>()
                })
              })
            )
          ),
        { concurrency: "unbounded" }
      )

      return Arr.sort(Arr.flatten(findings), Order.string)
    }
  )

const fixtureParityGovernanceFindings: Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> =
  Effect.gen(
    function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const testFiles = yield* listTypeScriptFiles("test")
      const parityFiles = Arr.filter(testFiles, (file) => file.relative.endsWith("fixture-parity.test.ts"))
      const findings = yield* Effect.forEach(
        parityFiles,
        (parityFile) =>
          fileSystem.readFileString(parityFile.absolute).pipe(
            Effect.orDie,
            Effect.map((content) => moduleSpecifiers(parseTypeScript(parityFile.relative, content))),
            Effect.map((specifiers) => {
              const importsRegistryAuthority = specifiers.some((specifier) => specifier.includes("/helpers/fixtures/"))
              const importsRawJson = specifiers.some((specifier) => specifier.endsWith(".json"))

              return !importsRegistryAuthority || importsRawJson
                ? Option.some(parityFile.relative)
                : Option.none<string>()
            })
          ),
        { concurrency: "unbounded" }
      )

      return Arr.sort(Arr.filterMap(findings, (finding) => finding), Order.string)
    }
  )

describe("smoke governance", () => {
  it.effect("keeps blocked internal exports and the experimental seam explicit", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const root = yield* resolveRootFrom(packageRootUrl)
      const manifest = yield* loadPublishReadinessManifest(path.join(root, "package.json"))
      const exportsMap = manifest.exports ?? {}

      yield* Effect.forEach(
        BLOCKED_INTERNAL_EXPORTS,
        (subpath) => Effect.sync(() => expect(exportsMap[subpath]).toBeNull()),
        { discard: true }
      )

      expect(exportsMap["./experimental"]).toBe("./src/experimental/index.ts")
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps consumer-facing and cross-domain source imports off blocked internal subpaths", () =>
    Effect.gen(function*() {
      expect(yield* internalImportFindings).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps fixture generation decomposed by domain and parity suites on the shared registry", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* resolveRootFrom(packageRootUrl)
      const fixtureModules = yield* fileSystem.readDirectory(path.join(root, "scripts/fixtures")).pipe(
        Effect.orDie,
        Effect.map((entries) => Arr.sort(Arr.filter(entries, (entry) => entry.endsWith(".py")), Order.string))
      )

      expect(fixtureModules).toEqual(Arr.sort(EXPECTED_FIXTURE_GENERATOR_MODULES, Order.string))
      expect(yield* fixtureParityGovernanceFindings).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))
})
