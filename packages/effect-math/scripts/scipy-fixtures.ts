/**
 * Shared SciPy fixture orchestration: evaluates the pinned Python reference
 * families, writes canonical fixture bytes with their manifest SHA-256 values,
 * checks committed or regenerated trees, and compares trees byte for byte.
 *
 * @since 0.1.0
 * @module
 */
import {
  Array,
  Boolean,
  Chunk,
  Console,
  Effect,
  FileSystem,
  Inspectable,
  Match,
  Number,
  Option,
  Order,
  Path,
  pipe,
  Result,
  Schema,
  Stream,
  String,
  Struct
} from "effect"
import { ChildProcess } from "effect/process"

import { fixtureSha256, loadFixtureByEntry, loadManifest } from "../test/helpers/fixtures/io.js"
import type { KnownFixture } from "../test/helpers/fixtures/schemas.js"
import {
  FixtureCpuDispatchProvenanceSchema,
  FixtureManifestEntrySchema,
  FixtureManifestProvenanceSchema,
  FixtureManifestSchema,
  KnownFixtureSchema
} from "../test/helpers/fixtures/schemas.js"

/** Reproducible default timestamp shared by fresh generation and committed references. */
export const defaultGeneratedAt = "2026-10-06T10:08:01Z"

/** Committed fixture directory, relative to the package root. */
export const committedFixtureDirectory = "test/fixtures/scipy"

/** Manifest file name inside every fixture tree. */
export const manifestFile = "manifest.json"

const ReferenceRequest = Schema.Struct({
  family: Schema.String,
  generatedAt: Schema.String
})

const GeneratedFixture = Schema.Struct({
  fixture: Schema.String,
  metadata: Schema.Unknown,
  payload: Schema.Unknown,
  file: Schema.String
})

const ReferenceBatch = Schema.Struct({
  generator: FixtureManifestSchema.fields.generator,
  fixtures: Schema.NonEmptyArray(GeneratedFixture)
})

const GeneratedFixtures = Schema.NonEmptyArray(GeneratedFixture)

export class ReferenceEvaluationError extends Schema.TaggedError<ReferenceEvaluationError>(
  "@scenesystems/effect-math/scripts/scipy-fixtures/ReferenceEvaluationError"
)(
  "ReferenceEvaluationError",
  {
    family: Schema.String,
    exitCode: Schema.Finite,
    message: Schema.String
  }
) {}

export class FixtureCheckError extends Schema.TaggedError<FixtureCheckError>(
  "@scenesystems/effect-math/scripts/scipy-fixtures/FixtureCheckError"
)("FixtureCheckError", {
  name: Schema.String,
  file: Schema.String,
  reason: Schema.String,
  cause: Schema.Option(Schema.Unknown)
}) {
  override get message() {
    return Array.join(
      Array.make(
        this.name,
        " (",
        this.file,
        "): ",
        this.reason,
        Option.match(this.cause, {
          onNone: () => "",
          onSome: (cause) => String.concat(": ", Inspectable.toStringUnknown(cause, 0))
        })
      ),
      ""
    )
  }
}

const collectProcess = (
  label: string,
  command: string,
  args: ReadonlyArray<string>,
  input: string,
  cwd: string
) =>
  Effect.gen(function*() {
    const child = yield* ChildProcess.make(command, args, {
      cwd,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe"
    })
    yield* Stream.make(input).pipe(Stream.encodeText, Stream.run(child.stdin))
    return yield* Effect.all({
      exitCode: child.exitCode,
      stdout: child.stdout.pipe(Stream.decodeText(), Stream.mkString),
      stderr: child.stderr.pipe(Stream.decodeText(), Stream.mkString)
    }, { concurrency: "unbounded" }).pipe(
      Effect.filterOrFail(
        (result) => Number.Equivalence(result.exitCode, 0),
        (result) =>
          new ReferenceEvaluationError({
            family: label,
            exitCode: result.exitCode,
            message: result.stderr
          })
      )
    )
  }).pipe(Effect.scoped)

const evaluateFamily = (repositoryRoot: string, script: string, request: typeof ReferenceRequest.Type) =>
  Effect.gen(function*() {
    const input = yield* Schema.encodeEffect(Schema.fromJsonString(ReferenceRequest))(request)
    const result = yield* collectProcess(
      request.family,
      "uv",
      ["run", "--locked", "--project", repositoryRoot, "python", script],
      input,
      repositoryRoot
    )
    yield* Console.error(result.stderr).pipe(Effect.when(Effect.succeed(String.isNonEmpty(result.stderr))))
    return yield* Schema.decodeEffect(Schema.fromJsonString(ReferenceBatch))(result.stdout, {
      onExcessProperty: "error"
    })
  })

/**
 * Formats JSON with the repository's pinned Prettier configuration, resolved
 * for the committed path, so fresh output has the exact committed bytes.
 */
const formatJson = (prettier: string, repositoryRoot: string, canonicalPath: string, content: string) =>
  collectProcess(canonicalPath, prettier, ["--stdin-filepath", canonicalPath], content, repositoryRoot).pipe(
    Effect.map((result) => result.stdout)
  )

/** Python reference family whose bytes do not depend on the CPU; its module pins its own dispatch environment. */
export const portableFamily = "cpython_sum"

/**
 * Additive manifest provenance recording the CPU-dispatch observation approved
 * for the legacy SciPy fixtures. It states only what was reproduced; it does
 * not describe the machine that originally generated the committed bytes.
 */
export const manifestProvenance = FixtureManifestProvenanceSchema.make({
  cpuDispatch: FixtureCpuDispatchProvenanceSchema.make({
    observation:
      "Regenerating with the locked uv environment while NumPy's AVX-512 SVML dispatch was active reproduced every committed legacy fixture byte. With AVX512F disabled (NPY_DISABLE_CPU_FEATURES=AVX512F) the cpuSensitiveFiles regenerate with different bytes. The generator pins only PYTHONHASHSEED, not CPU dispatch, so byte regeneration of these files is CPU-dependent; portable verification checks their schema and SHA-256 instead.",
    generatorPinnedEnvironment: Array.make("PYTHONHASHSEED"),
    cpuSensitiveFiles: Array.make(
      "complex/arithmetic-parity.json",
      "distribution/algebra-parity.json",
      "numeric/logspace-parity.json",
      "numeric/scalar-parity.json",
      "probability/distribution-parity.json"
    ),
    evidence: {
      file: "numeric/scalar-parity.json",
      case: "expm1-one",
      operation: "numpy.expm1",
      input: "1.0",
      committed: "1.7182818284590453",
      avx512fDisabled: "1.718281828459045"
    }
  })
})

/** Python reference family modules under `scripts/fixtures`, sorted by name. */
const discoverFamilies = (packageRoot: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const modules = yield* fileSystem.readDirectory(path.join(packageRoot, "scripts/fixtures"))
    return yield* Schema.decodeUnknownEffect(Schema.NonEmptyArray(Schema.String))(
      pipe(
        modules,
        Array.filter((name) => Boolean.and(String.endsWith(".py")(name), Boolean.not(String.startsWith("_")(name)))),
        Array.map(String.replace(/\.py$/, "")),
        Array.sort(String.Order)
      ),
      { onExcessProperty: "error" }
    )
  })

/**
 * Evaluates `families` with the root uv lock, validates every produced
 * document, and writes canonical fixture bytes into `outputDirectory`. Returns
 * the reference process provenance and one manifest entry per written file.
 */
const writeReferenceFixtures = (options: {
  readonly packageRoot: string
  readonly outputDirectory: string
  readonly generatedAt: string
  readonly families: Array.NonEmptyReadonlyArray<string>
}) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const repositoryRoot = path.resolve(options.packageRoot, "../..")
    const canonicalRoot = path.join(options.packageRoot, committedFixtureDirectory)
    const prettier = path.join(repositoryRoot, "node_modules", ".bin", "prettier")
    const script = path.join(options.packageRoot, "scripts/generate-scipy-fixtures.py")
    const provenance = yield* evaluateFamily(repositoryRoot, script, {
      family: Array.headNonEmpty(options.families),
      generatedAt: options.generatedAt
    })
    const batches = yield* Effect.forEach(
      Array.tailNonEmpty(options.families),
      (family) => evaluateFamily(repositoryRoot, script, { family, generatedAt: options.generatedAt }),
      { concurrency: 2 }
    )
    const generatedFixtures = yield* Schema.decodeEffect(GeneratedFixtures)(
      Array.flatMap(Array.prepend(batches, provenance), (batch) => batch.fixtures),
      { onExcessProperty: "error" }
    )
    const fixtures = yield* Effect.forEach(
      generatedFixtures,
      (fixture) =>
        Schema.decodeUnknownEffect(KnownFixtureSchema)(Struct.omit(fixture, ["file"]), { onExcessProperty: "error" })
          .pipe(
            Effect.map((validated) => ({ ...validated, file: fixture.file }))
          )
    )
    yield* Effect.forEach(fixtures, (fixture) =>
      Effect.filterOrFail(
        Effect.succeed(fixture.file),
        (file) => String.Equivalence(file, String.concat(String.replace(".", "/")(fixture.fixture), ".json")),
        () =>
          new ReferenceEvaluationError({
            family: fixture.fixture,
            exitCode: 0,
            message: "Fixture output path must match its canonical fixture name"
          })
      ), { discard: true })
    yield* Effect.filterOrFail(
      Effect.succeed(fixtures),
      (values) =>
        Number.Equivalence(
          Array.length(values),
          Array.length(Array.dedupe(Array.map(values, (fixture) => fixture.fixture)))
        ),
      () =>
        new ReferenceEvaluationError({
          family: "all",
          exitCode: 0,
          message: "Reference families must not produce duplicate fixtures"
        })
    )
    const entries = yield* Effect.forEach(
      fixtures,
      (fixture) =>
        Effect.gen(function*() {
          const encoded = yield* Schema.encodeEffect(Schema.fromJsonString(KnownFixtureSchema, { space: 2 }))(fixture)
          const content = yield* formatJson(prettier, repositoryRoot, path.join(canonicalRoot, fixture.file), encoded)
          const destination = path.join(options.outputDirectory, fixture.file)
          yield* fileSystem.makeDirectory(path.dirname(destination), { recursive: true })
          yield* fileSystem.writeFileString(destination, content)
          const sha256 = yield* fixtureSha256(yield* fileSystem.readFile(destination))
          yield* Console.log("✓", fixture.file)
          return FixtureManifestEntrySchema.make({ name: fixture.fixture, file: fixture.file, sha256 })
        }),
      { concurrency: 4 }
    )
    return {
      generator: provenance.generator,
      entries: Array.sort(
        entries,
        Order.mapInput(String.Order, (entry: typeof FixtureManifestEntrySchema.Type) => entry.name)
      ),
      cases: Number.sumAll(
        Array.map(fixtures, (fixture) => Array.length<KnownFixture["payload"]["cases"][number]>(fixture.payload.cases))
      )
    }
  })

/**
 * Evaluates every Python reference family with the root uv lock and writes
 * canonical fixture documents plus a manifest recording each document's
 * SHA-256 and the approved provenance into `outputDirectory`.
 */
export const generateReferenceFixtures = (options: {
  readonly packageRoot: string
  readonly outputDirectory: string
  readonly generatedAt: string
}) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const repositoryRoot = path.resolve(options.packageRoot, "../..")
    const prettier = path.join(repositoryRoot, "node_modules", ".bin", "prettier")
    const families = yield* discoverFamilies(options.packageRoot)
    const written = yield* writeReferenceFixtures({ ...options, families })
    const manifest = FixtureManifestSchema.make({
      generator: written.generator,
      provenance: manifestProvenance,
      fixtures: written.entries
    })
    const manifestContent = yield* Schema.encodeEffect(Schema.fromJsonString(FixtureManifestSchema, { space: 2 }))(
      manifest
    ).pipe(
      Effect.flatMap((encoded) =>
        formatJson(
          prettier,
          repositoryRoot,
          path.join(options.packageRoot, committedFixtureDirectory, manifestFile),
          encoded
        )
      )
    )
    yield* fileSystem.writeFileString(path.join(options.outputDirectory, manifestFile), manifestContent)
    return { fixtures: Array.length(written.entries), cases: written.cases }
  })

/**
 * Regenerates only the CPU-independent `portableFamily` into
 * `outputDirectory`, without a manifest, and returns its manifest entries.
 */
export const generatePortableFixtures = (options: {
  readonly packageRoot: string
  readonly outputDirectory: string
  readonly generatedAt: string
}) =>
  writeReferenceFixtures({ ...options, families: Array.of(portableFamily) }).pipe(
    Effect.map((written) => ({ entries: written.entries, cases: written.cases }))
  )

const findJsonFiles = (
  fileSystem: FileSystem.FileSystem,
  pathService: Path.Path,
  root: string,
  prefix: string
): Effect.Effect<Chunk.Chunk<Result.Result<string, FixtureCheckError>>> =>
  Effect.gen(function*() {
    const directory = Boolean.match(String.isEmpty(prefix), {
      onFalse: () => pathService.join(root, prefix),
      onTrue: () => root
    })
    const entries = yield* Effect.result(fileSystem.readDirectory(directory))

    return yield* Result.match(entries, {
      onFailure: (cause) =>
        Effect.succeed(
          Chunk.of(
            Result.fail(
              new FixtureCheckError({
                name: "scan",
                file: directory,
                reason: "could not read directory",
                cause: Option.some(cause)
              })
            )
          )
        ),
      onSuccess: (names) =>
        Effect.map(
          Effect.forEach(names, (name) =>
            Effect.gen(function*() {
              const relative = Boolean.match(String.isEmpty(prefix), {
                onFalse: () => String.concat(String.concat(prefix, "/"), name),
                onTrue: () => name
              })
              const absolute = pathService.join(root, relative)
              const stat = yield* Effect.result(fileSystem.stat(absolute))

              return yield* Result.match(stat, {
                onFailure: (cause) =>
                  Effect.succeed(
                    Chunk.of(
                      Result.fail(
                        new FixtureCheckError({
                          name: "scan",
                          file: absolute,
                          reason: "could not stat filesystem entry",
                          cause: Option.some(cause)
                        })
                      )
                    )
                  ),
                onSuccess: (info) =>
                  Match.value(info.type).pipe(
                    Match.when("Directory", () => findJsonFiles(fileSystem, pathService, root, relative)),
                    Match.when(
                      Match.is("File", "SymbolicLink", "BlockDevice", "CharacterDevice", "FIFO", "Socket", "Unknown"),
                      () =>
                        Effect.succeed(
                          Boolean.match(String.endsWith(".json")(name), {
                            onFalse: () => Chunk.empty<Result.Result<string, FixtureCheckError>>(),
                            onTrue: () => Chunk.of(Result.succeed(relative))
                          })
                        )
                    ),
                    Match.exhaustive
                  )
              })
            })),
          (entries) => Chunk.flatten(Chunk.fromIterable(entries))
        )
    })
  })

/** Sorted `/`-separated relative paths of every JSON file under `root`. */
const scanJsonFiles = (root: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const scanned = yield* findJsonFiles(fileSystem, pathService, root, "")
    const [files, errors] = Array.separate(scanned)
    return { files: Array.sort(files, String.Order), errors }
  })

/** The outcome of checking one fixture tree. */
export const FixtureTreeReport = Schema.Struct({
  manifest: Schema.Option(FixtureManifestSchema),
  passed: Schema.Array(Schema.String),
  errors: Schema.Array(FixtureCheckError)
})

export type FixtureTreeReport = typeof FixtureTreeReport.Type

/**
 * Decodes the manifest with excess properties rejected, verifies every entry's
 * SHA-256 against its exact bytes, schema-decodes every document, and reports
 * JSON files that the manifest does not declare.
 */
export const checkFixtureTree = (root: string) =>
  Effect.gen(function*() {
    const pathService = yield* Path.Path
    const manifest = yield* loadManifest(root, manifestFile).pipe(
      Effect.mapError(
        (cause) =>
          new FixtureCheckError({
            name: "manifest",
            file: pathService.join(root, manifestFile),
            reason: Match.value(cause).pipe(
              Match.tag("FixtureManifestReadError", () => "could not read manifest"),
              Match.tag("FixtureMalformedJsonError", () => "malformed manifest JSON"),
              Match.tag("FixtureManifestDecodeError", () => "manifest schema decode failed"),
              Match.exhaustive
            ),
            cause: Option.some(cause)
          })
      ),
      Effect.result
    )

    return yield* Result.match(manifest, {
      onFailure: (error) =>
        Effect.succeed(
          FixtureTreeReport.make({ manifest: Option.none(), passed: Array.empty(), errors: Array.of(error) })
        ),
      onSuccess: (manifest) =>
        Effect.gen(function*() {
          const fixtureResults = yield* Effect.forEach(manifest.fixtures, (entry) =>
            loadFixtureByEntry(root, entry).pipe(
              Effect.as(entry.name),
              Effect.mapError(
                (cause) =>
                  new FixtureCheckError({
                    name: entry.name,
                    file: entry.file,
                    reason: Match.value(cause).pipe(
                      Match.tag("FixtureFileReadError", () => "read failed"),
                      Match.tag("FixtureHashMismatchError", (mismatch) =>
                        Array.join(
                          Array.make("sha256 mismatch: manifest ", mismatch.expected, ", bytes ", mismatch.actual),
                          ""
                        )),
                      Match.tag("FixtureMalformedJsonError", () => "malformed JSON"),
                      Match.tag(
                        "FixtureSchemaDecodeError",
                        () =>
                          "schema decode failed — fixture JSON does not match its declared KnownFixtureSchema variant"
                      ),
                      Match.exhaustive
                    ),
                    cause: Option.some(cause)
                  })
              ),
              Effect.result
            ))
          const manifestFiles = Array.map(manifest.fixtures, (entry) => entry.file)
          const declared = (file: string) =>
            Array.filter(manifestFiles, (entryFile) => String.Equivalence(entryFile, file))
          const duplicateErrors = Array.filterMap(
            Array.dedupe(manifestFiles),
            (file) =>
              Boolean.match(Number.isGreaterThan(Array.length(declared(file)), 1), {
                onFalse: () => Result.failVoid,
                onTrue: () =>
                  Result.succeed(
                    new FixtureCheckError({
                      name: "duplicate",
                      file,
                      reason: "fixture file is declared more than once in manifest",
                      cause: Option.none()
                    })
                  )
              })
          )
          const scanned = yield* scanJsonFiles(root)
          const orphanErrors = Array.filterMap(scanned.files, (file) =>
            Boolean.match(
              Boolean.and(
                Boolean.not(String.Equivalence(file, manifestFile)),
                Array.isReadonlyArrayEmpty(declared(file))
              ),
              {
                onFalse: () => Result.failVoid,
                onTrue: () =>
                  Result.succeed(
                    new FixtureCheckError({
                      name: "orphan",
                      file,
                      reason: "fixture file exists on disk but is not declared in manifest",
                      cause: Option.none()
                    })
                  )
              }
            ))
          const [passed, fixtureErrors] = Array.separate(fixtureResults)
          return FixtureTreeReport.make({
            manifest: Option.some(manifest),
            passed,
            errors: Array.flatten(Array.make(fixtureErrors, duplicateErrors, scanned.errors, orphanErrors))
          })
        })
    })
  })

const byteEquivalence = Array.makeEquivalence(Number.Equivalence)

/**
 * Compares one relative file under two roots byte for byte. Drift reports both
 * byte lengths and SHA-256 values so the exact changed file is identifiable.
 */
const compareFixtureFile = (expectedRoot: string, actualRoot: string, file: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const committed = yield* fileSystem.readFile(pathService.join(expectedRoot, file))
    const regenerated = yield* fileSystem.readFile(pathService.join(actualRoot, file))
    const committedSha256 = yield* fixtureSha256(committed)
    const regeneratedSha256 = yield* fixtureSha256(regenerated)
    return Boolean.match(byteEquivalence(Array.fromIterable(committed), Array.fromIterable(regenerated)), {
      onFalse: () =>
        Result.fail(
          new FixtureCheckError({
            name: "regeneration",
            file,
            reason: Array.join(
              Array.make(
                "regenerated bytes differ from committed bytes (committed ",
                Inspectable.toStringUnknown(committed.byteLength, 0),
                " bytes sha256 ",
                committedSha256,
                ", regenerated ",
                Inspectable.toStringUnknown(regenerated.byteLength, 0),
                " bytes sha256 ",
                regeneratedSha256,
                ")"
              ),
              ""
            ),
            cause: Option.none()
          })
        ),
      onTrue: () => Result.succeed(file)
    })
  }).pipe(
    Effect.catch((cause) =>
      Effect.succeed(Result.fail(
        new FixtureCheckError({
          name: "regeneration",
          file,
          reason: "could not read file for byte comparison",
          cause: Option.some(cause)
        })
      ))
    )
  )

/** Compares the named relative files under two roots byte for byte. */
export const compareFixtureFiles = (expectedRoot: string, actualRoot: string, files: ReadonlyArray<string>) =>
  Effect.forEach(files, (file) => compareFixtureFile(expectedRoot, actualRoot, file)).pipe(
    Effect.map((compared) => {
      const [identical, errors] = Array.separate(compared)
      return { identical, errors }
    })
  )

/**
 * Compares two fixture trees byte for byte: both must contain exactly the same
 * JSON files, and every file must have identical bytes.
 */
export const compareFixtureTrees = (expectedRoot: string, actualRoot: string) =>
  Effect.gen(function*() {
    const expected = yield* scanJsonFiles(expectedRoot)
    const actual = yield* scanJsonFiles(actualRoot)
    const missing = Array.map(
      Array.difference(expected.files, actual.files),
      (file) =>
        new FixtureCheckError({
          name: "regeneration",
          file,
          reason: "committed file was not regenerated",
          cause: Option.none()
        })
    )
    const extra = Array.map(
      Array.difference(actual.files, expected.files),
      (file) =>
        new FixtureCheckError({
          name: "regeneration",
          file,
          reason: "regeneration produced a file that is not committed",
          cause: Option.none()
        })
    )
    const compared = yield* compareFixtureFiles(
      expectedRoot,
      actualRoot,
      Array.intersection(expected.files, actual.files)
    )
    return {
      identical: compared.identical,
      errors: Array.flatten(Array.make(expected.errors, actual.errors, missing, extra, compared.errors))
    }
  })

/**
 * Hashes the exact manifest bytes under `root` and reports a failure unless
 * they match the `expected` pinned SHA-256. Payload entries can all be intact
 * while the manifest itself is altered; this check covers the manifest.
 */
export const checkManifestSha256 = (root: string, expected: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const file = pathService.join(root, manifestFile)
    return yield* fileSystem.readFile(file).pipe(
      Effect.flatMap(fixtureSha256),
      Effect.map((actual) =>
        Boolean.match(String.Equivalence(actual, expected), {
          onFalse: () =>
            Array.of(
              new FixtureCheckError({
                name: "manifest",
                file: manifestFile,
                reason: Array.join(Array.make("sha256 mismatch: pinned ", expected, ", bytes ", actual), ""),
                cause: Option.none()
              })
            ),
          onTrue: () => Array.empty<FixtureCheckError>()
        })
      ),
      Effect.catch((cause) =>
        Effect.succeed(
          Array.of(
            new FixtureCheckError({
              name: "manifest",
              file,
              reason: "could not read manifest bytes",
              cause: Option.some(cause)
            })
          )
        )
      )
    )
  })

/** Prints a byte comparison and fails when it contains any error. */
export const reportComparison = (
  label: string,
  comparison: { readonly identical: ReadonlyArray<string>; readonly errors: ReadonlyArray<FixtureCheckError> }
) =>
  Effect.gen(function*() {
    yield* Console.log()
    yield* Console.log("Comparing", label, "regenerated bytes with committed references...")
    yield* Effect.forEach(comparison.identical, (file) => Console.log("✓", file), { discard: true })
    yield* Effect.forEach(comparison.errors, (error) => Console.log("✗", error.message), { discard: true })
    yield* Console.log()
    yield* Console.log(
      "Results:",
      Array.length(comparison.identical),
      "byte-identical,",
      Array.length(comparison.errors),
      "failed"
    )
    yield* failOnErrors(label, comparison.errors)
  })

/** Prints a tree report and fails when it contains any error. */
export const reportFixtureTree = (label: string, report: FixtureTreeReport) =>
  Effect.gen(function*() {
    yield* Console.log(
      "Checking",
      Option.match(report.manifest, { onNone: () => 0, onSome: (manifest) => Array.length(manifest.fixtures) }),
      "fixtures from",
      label,
      "manifest (schema + sha256)..."
    )
    yield* Console.log()
    yield* Effect.forEach(report.passed, (name) => Console.log("✓", name), { discard: true })
    yield* Effect.forEach(report.errors, (error) => Console.log("✗", error.message), { discard: true })
    yield* Console.log()
    yield* Console.log("Results:", Array.length(report.passed), "passed,", Array.length(report.errors), "failed")
    yield* failOnErrors(label, report.errors)
  })

/** Fails with a summary error when `errors` is non-empty. */
export const failOnErrors = (label: string, errors: ReadonlyArray<FixtureCheckError>) =>
  Effect.fail(
    new FixtureCheckError({
      name: "summary",
      file: label,
      reason: String.concat(Inspectable.toStringUnknown(Array.length(errors), 0), " fixture check failure(s)"),
      cause: Option.none()
    })
  ).pipe(Effect.when(Effect.succeed(Array.isReadonlyArrayNonEmpty(errors))), Effect.asVoid)
