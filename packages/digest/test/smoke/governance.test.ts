/**
 * Structural governance tests for @scenesystems/digest.
 *
 * Enforces three invariants:
 * 1. File size discipline — src files stay under 240 LOC
 * 2. Internal boundary — only approved src files import from internal/
 * 3. Export governance — package.json exports match expected surface
 */

import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Data, Effect, HashMap, Number as Num, Option, Order, Record, Schema } from "effect"

import {
  callInvocations,
  ConditionalInvocation,
  conditionalInvocations,
  ExpressionInvocation,
  moduleSpecifiers,
  parseTypeScript,
  readProjectFile,
  referencesInternalBoundary,
  resolveRootFrom,
  toSourceFilePath,
  variableInitializerTexts
} from "@theoria/source-proof"

const MAX_SOURCE_FILE_LINES = 240

const OVERSIZE_SOURCE_FILE_NOTES: ReadonlyArray<readonly [string, string]> = []

const OVERSIZE_SOURCE_FILE_NOTES_MAP = HashMap.fromIterable(OVERSIZE_SOURCE_FILE_NOTES)

const INTERNAL_IMPORT_ALLOWED_PREFIXES = [
  "src/canonicalize.ts",
  "src/convenience.ts",
  "src/digest.ts",
  "src/digestSchemaValue.ts",
  "src/encoding.ts",
  "src/streaming.ts"
]

const ManifestExportKeysSchema = Schema.parseJson(
  Schema.Struct({
    exports: Schema.Record({
      key: Schema.String,
      value: Schema.Unknown
    })
  })
)

const EXPECTED_EXPORT_KEYS = [
  "."
]

class SourceFilePath extends Data.Class<{
  readonly absolute: string
  readonly relative: string
}> {}

const packageRootUrl = new URL("../../", import.meta.url)

const initializerText = (relativePath: string, variableName: string) =>
  readProjectFile(packageRootUrl, relativePath).pipe(
    Effect.map((source) => parseTypeScript(relativePath, source)),
    Effect.map((sourceFile) => variableInitializerTexts(sourceFile, variableName)),
    Effect.flatMap((initializers) =>
      Option.match(Arr.head(initializers), {
        onNone: () => Effect.dieMessage(`Missing initializer for ${variableName}`),
        onSome: Effect.succeed
      })
    )
  )

const listTypeScriptFiles: Effect.Effect<Array<SourceFilePath>, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* resolveRootFrom(packageRootUrl)
    const absoluteSourceRoot = path.join(root, "src")
    const entries = yield* fileSystem.readDirectory(absoluteSourceRoot, { recursive: true }).pipe(Effect.orDie)

    return Arr.flatMap(entries, (entry) =>
      entry.endsWith(".ts")
        ? [toSourceFilePath(path, root, absoluteSourceRoot, entry)]
        : [])
  }
)

class OversizeSourceFinding extends Data.Class<{
  readonly path: string
  readonly lines: number
}> {}

const oversizeSourceFindings: Effect.Effect<Array<OversizeSourceFinding>, never, FileSystem.FileSystem | Path.Path> =
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const files = yield* listTypeScriptFiles
    const findings = yield* Effect.forEach(files, (file) =>
      fileSystem.readFileString(file.absolute).pipe(
        Effect.orDie,
        Effect.map((content) => content.split("\n").length),
        Effect.map((lines) =>
          Num.greaterThan(lines, MAX_SOURCE_FILE_LINES)
            ? Option.some<OversizeSourceFinding>(new OversizeSourceFinding({ path: file.relative, lines }))
            : Option.none<OversizeSourceFinding>()
        )
      ))

    return Arr.filterMap(findings, (finding) => finding)
  })

const hasAllowedInternalImport = (relativePath: string): boolean =>
  INTERNAL_IMPORT_ALLOWED_PREFIXES.some((allowed) => relativePath === allowed)

const internalBoundaryViolations: Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const files = yield* listTypeScriptFiles
    const findings = yield* Effect.forEach(files, (file) =>
      fileSystem.readFileString(file.absolute).pipe(
        Effect.orDie,
        Effect.map((content) =>
          moduleSpecifiers(parseTypeScript(file.relative, content)).some((specifier) =>
            referencesInternalBoundary(specifier)
          )
          && !hasAllowedInternalImport(file.relative)
        ),
        Effect.map((isViolation) =>
          isViolation
            ? Option.some(file.relative)
            : Option.none<string>()
        )
      ))

    return Arr.filterMap(findings, (finding) => finding)
  }
)

const packageExportKeys: Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* resolveRootFrom(packageRootUrl)
    const packageJsonPath = path.join(root, "package.json")
    const packageJson = yield* fileSystem.readFileString(packageJsonPath).pipe(Effect.orDie)
    const decoded = yield* Schema.decodeUnknown(ManifestExportKeysSchema)(packageJson).pipe(Effect.orDie)

    return Arr.sort(Record.keys(decoded.exports), Order.string)
  }
)

describe("governance", () => {
  it.effect("documents every src file over 240 LOC", () =>
    Effect.gen(function*() {
      const oversized = yield* oversizeSourceFindings
      const oversizedPaths = Arr.sort(Arr.map(oversized, (entry) => entry.path), Order.string)
      const documentedPaths = Arr.sort(Arr.map(OVERSIZE_SOURCE_FILE_NOTES, ([path]) => path), Order.string)

      expect(oversizedPaths).toEqual(documentedPaths)

      const undocumented = Arr.filter(oversized, (entry) => !HashMap.has(OVERSIZE_SOURCE_FILE_NOTES_MAP, entry.path))
      expect(undocumented).toEqual([])

      const emptyNotes = Arr.filter(OVERSIZE_SOURCE_FILE_NOTES, ([, note]) => note.trim().length <= 0)
      expect(emptyNotes).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps internal imports behind approved file boundaries", () =>
    Effect.gen(function*() {
      expect(yield* internalBoundaryViolations).toEqual([])
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("preserves export governance contracts", () =>
    Effect.gen(function*() {
      const exportKeys = yield* packageExportKeys
      expect(exportKeys).toEqual(Arr.sort(EXPECTED_EXPORT_KEYS, Order.string))
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps bounded canonical emission incremental without full-preimage assembly or one-shot dispatch", () =>
    Effect.gen(function*() {
      const boundedInitializer = yield* initializerText(
        "src/digestSchemaValue.ts",
        "digestSchemaValueWithByteLimit"
      )
      const bounded = parseTypeScript(
        "digestSchemaValueWithByteLimit.initializer.ts",
        `const value = ${boundedInitializer}`
      )
      const invocations = callInvocations(bounded)

      expect(Arr.filter(invocations, ({ target }) => target === "Schema.encode")).toEqual([
        new ExpressionInvocation({ kind: "call", target: "Schema.encode", arguments: ["schema"] })
      ])
      expect(Arr.filter(invocations, ({ target }) => target === "Schema.encode()")).toEqual([
        new ExpressionInvocation({ kind: "call", target: "Schema.encode()", arguments: ["value"] })
      ])
      expect(conditionalInvocations(bounded)).toContainEqual(
        new ConditionalInvocation({
          condition: new ExpressionInvocation({
            kind: "call",
            target: "isByteLimit",
            arguments: ["maximumBytes"]
          }),
          whenTrue: new ExpressionInvocation({
            kind: "call",
            target: "Effect.flatMap",
            arguments: [
              "Schema.encode(schema)(value)",
              "(encoded) => digestEncodedBounded(encoded, maximumBytes, algorithm)"
            ]
          }),
          whenFalse: new ExpressionInvocation({
            kind: "new",
            target: "InvalidCanonicalByteLimit",
            arguments: ["{}"]
          })
        })
      )

      const digestEncodedBoundedInitializer = yield* initializerText(
        "src/digestSchemaValue.ts",
        "digestEncodedBounded"
      )
      const digestEncodedBounded = parseTypeScript(
        "digestEncodedBounded.initializer.ts",
        `const value = ${digestEncodedBoundedInitializer}`
      )
      const boundedInvocations = callInvocations(digestEncodedBounded)
      expect(Arr.filter(boundedInvocations, ({ target }) => target === "makeIncrementalHasher")).toEqual([
        new ExpressionInvocation({
          kind: "call",
          target: "makeIncrementalHasher",
          arguments: ["algorithm"]
        })
      ])
      expect(Arr.filter(boundedInvocations, ({ target }) => target === "canonicalizeWithByteLimit")).toEqual([
        new ExpressionInvocation({
          kind: "call",
          target: "canonicalizeWithByteLimit",
          arguments: [
            "encoded",
            "maximumBytes",
            "(segment) => updateIncrementalHasher(hasher, encodeUtf8Unchecked(segment))"
          ]
        })
      ])
      expect(Arr.filter(boundedInvocations, ({ target }) => target === "updateIncrementalHasher")).toEqual([
        new ExpressionInvocation({
          kind: "call",
          target: "updateIncrementalHasher",
          arguments: ["hasher", "encodeUtf8Unchecked(segment)"]
        })
      ])
      expect(Arr.filter(boundedInvocations, ({ target }) => target === "finalizeIncrementalHasherTagged")).toEqual([
        new ExpressionInvocation({
          kind: "call",
          target: "finalizeIncrementalHasherTagged",
          arguments: ["algorithm", "hasher"]
        })
      ])
      expect(Arr.filter(boundedInvocations, ({ target }) => target === "Effect.flatMap")).toContainEqual(
        new ExpressionInvocation({
          kind: "call",
          target: "Effect.flatMap",
          arguments: [
            "canonicalizeWithByteLimit(\n          encoded,\n          maximumBytes,\n          (segment) => updateIncrementalHasher(hasher, encodeUtf8Unchecked(segment))\n        )",
            "(canonicalByteLength) =>\n          Effect.map(\n            finalizeIncrementalHasherTagged(algorithm, hasher),\n            (tagged) => new SchemaValueDigest({ digest: tagged, canonicalByteLength })\n          )"
          ]
        })
      )
      expect(
        Arr.filter(
          boundedInvocations,
          ({ target }) =>
            target === "encodeCanonicalSegments" ||
            target === "digestBytesTagged" ||
            target === "hashBytes" ||
            target === "blake3Hash" ||
            target === "sha256"
        )
      ).toEqual([])

      const synchronousInitializer = yield* initializerText(
        "src/digestSchemaValue.ts",
        "digestSchemaValueWithByteLimitSync"
      )
      const synchronous = parseTypeScript(
        "digestSchemaValueWithByteLimitSync.initializer.ts",
        `const value = ${synchronousInitializer}`
      )
      expect(
        Arr.filter(callInvocations(synchronous), ({ target }) => target === "Schema.encodeEither")
      ).toEqual([
        new ExpressionInvocation({ kind: "call", target: "Schema.encodeEither", arguments: ["schema"] })
      ])

      const synchronousInitializers: ReadonlyArray<readonly [string, string]> = [
        ["src/digestSchemaValue.ts", "digestSchemaValueWithByteLimitSync"],
        ["src/digestSchemaValue.ts", "digestEncodedBoundedSync"],
        ["src/internal/jcs-machine.ts", "canonicalizeWithByteLimitEither"],
        ["src/internal/jcs-machine.ts", "executeSynchronously"],
        ["src/internal/digest-bytes.ts", "makeIncrementalHasherSync"],
        ["src/internal/digest-bytes.ts", "finalizeIncrementalHasherTaggedSync"]
      ]
      const synchronousInvocations = yield* Effect.forEach(
        synchronousInitializers,
        ([relativePath, variableName]) =>
          initializerText(relativePath, variableName).pipe(
            Effect.map((initializer) =>
              callInvocations(parseTypeScript(`${variableName}.initializer.ts`, `const value = ${initializer}`))
            )
          )
      )
      expect(
        Arr.filter(
          Arr.flatten(synchronousInvocations),
          ({ target }) =>
            target.startsWith("Effect.") ||
            target.startsWith("Runtime.") ||
            target.startsWith("Clock.") ||
            target.startsWith("Scheduler.")
        )
      ).toEqual([])

      const streamingSource = yield* readProjectFile(packageRootUrl, "src/streaming.ts")
      expect(
        Arr.filter(
          moduleSpecifiers(parseTypeScript("src/streaming.ts", streamingSource)),
          (specifier) => specifier.startsWith("@noble/hashes")
        )
      ).toEqual([])

      const hasherInitializer = yield* initializerText("src/internal/digest-bytes.ts", "makeIncrementalHasherSync")
      const hasher = parseTypeScript("makeIncrementalHasherSync.initializer.ts", `const value = ${hasherInitializer}`)
      expect(
        Arr.filter(
          callInvocations(hasher),
          ({ target }) => target === "blake3.create" || target === "nobleSha256.create"
        )
      ).toEqual([
        new ExpressionInvocation({ kind: "call", target: "blake3.create", arguments: [] }),
        new ExpressionInvocation({ kind: "call", target: "nobleSha256.create", arguments: [] })
      ])
    }).pipe(Effect.provide(BunContext.layer)))
})
