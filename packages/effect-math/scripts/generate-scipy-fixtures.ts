/**
 * Evaluates Python reference families in scoped processes and writes validated fixtures.
 *
 * @since 0.1.0
 * @module
 */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import {
  Array,
  Boolean,
  Config,
  Console,
  Effect,
  FileSystem,
  Number,
  Order,
  Path,
  pipe,
  Schema,
  Stream,
  String
} from "effect"
import { ChildProcess } from "effect/process"

import { directoryBeside } from "../test/helpers/fixtures/io.js"
import type { FixtureManifestEntrySchema, KnownFixture } from "../test/helpers/fixtures/schemas.js"
import { FixtureManifestSchema, KnownFixtureSchema } from "../test/helpers/fixtures/schemas.js"

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
  schemaVersion: FixtureManifestSchema.fields.schemaVersion,
  generator: FixtureManifestSchema.fields.generator,
  fixtures: Schema.NonEmptyArray(GeneratedFixture)
})

const GeneratedFixtures = Schema.NonEmptyArray(GeneratedFixture)

class ReferenceEvaluationError extends Schema.TaggedError<ReferenceEvaluationError>(
  "@scenesystems/effect-math/scripts/generate-scipy-fixtures/ReferenceEvaluationError"
)(
  "ReferenceEvaluationError",
  {
    family: Schema.String,
    exitCode: Schema.Finite,
    message: Schema.String
  }
) {}

const evaluateFamily = (script: string, request: typeof ReferenceRequest.Type) =>
  Effect.gen(function*() {
    const input = yield* Schema.encodeEffect(Schema.fromJsonString(ReferenceRequest))(request)
    const child = yield* ChildProcess.make("uv", ["run", "--script", script], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe"
    })
    yield* Stream.make(input).pipe(Stream.encodeText, Stream.run(child.stdin))
    const result = yield* Effect.all({
      exitCode: child.exitCode,
      stdout: child.stdout.pipe(Stream.decodeText(), Stream.mkString),
      stderr: child.stderr.pipe(Stream.decodeText(), Stream.mkString)
    }, { concurrency: "unbounded" }).pipe(
      Effect.filterOrFail(
        (result) => Number.Equivalence(result.exitCode, 0),
        (result) =>
          new ReferenceEvaluationError({
            family: request.family,
            exitCode: result.exitCode,
            message: result.stderr
          })
      )
    )
    yield* Console.error(result.stderr).pipe(Effect.when(Effect.succeed(String.isNonEmpty(result.stderr))))
    return yield* Schema.decodeEffect(Schema.fromJsonString(ReferenceBatch))(result.stdout, {
      onExcessProperty: "error"
    })
  }).pipe(Effect.scoped)

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const packageRoot = yield* directoryBeside(import.meta.url, "../")
  const outputDirectory = yield* Config.String("SCIPY_FIXTURE_OUTPUT_DIRECTORY").pipe(
    Config.withDefault(path.join(packageRoot, "test/fixtures/scipy"))
  )
  const generatedAt = yield* Config.String("SCIPY_FIXTURE_GENERATED_AT").pipe(
    Config.withDefault("2026-03-23T00:00:00Z")
  )
  const modules = yield* fileSystem.readDirectory(path.join(packageRoot, "scripts/fixtures"))
  const families = yield* Schema.decodeUnknownEffect(Schema.NonEmptyArray(Schema.String))(
    pipe(
      modules,
      Array.filter((name) => Boolean.and(String.endsWith(".py")(name), Boolean.not(String.startsWith("_")(name)))),
      Array.map(String.replace(/\.py$/, "")),
      Array.sort(String.Order)
    ),
    { onExcessProperty: "error" }
  )
  const script = path.join(packageRoot, "scripts/generate-scipy-fixtures.py")
  const provenance = yield* evaluateFamily(script, { family: Array.headNonEmpty(families), generatedAt })
  const batches = yield* Effect.forEach(
    Array.tailNonEmpty(families),
    (family) => evaluateFamily(script, { family, generatedAt }),
    {
      concurrency: 2
    }
  )
  const generatedFixtures = yield* Schema.decodeEffect(GeneratedFixtures)(
    Array.flatMap(Array.prepend(batches, provenance), (batch) => batch.fixtures),
    {
      onExcessProperty: "error"
    }
  )
  const fixtures = yield* Effect.forEach(
    generatedFixtures,
    (fixture) =>
      Schema.decodeUnknownEffect(KnownFixtureSchema)(fixture, { onExcessProperty: "ignore" }).pipe(
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
  const manifest = FixtureManifestSchema.make({
    schemaVersion: provenance.schemaVersion,
    generator: provenance.generator,
    fixtures: pipe(
      Array.map(fixtures, (fixture) => ({ name: fixture.fixture, file: fixture.file })),
      Array.sort(Order.mapInput(String.Order, (entry: typeof FixtureManifestEntrySchema.Type) => entry.name))
    )
  })
  const documents = yield* Effect.forEach(
    fixtures,
    (fixture) =>
      Schema.encodeEffect(Schema.fromJsonString(KnownFixtureSchema, { space: 2 }))(fixture).pipe(
        Effect.map((content) => ({ file: fixture.file, content }))
      )
  )
  const manifestContent = yield* Schema.encodeEffect(Schema.fromJsonString(FixtureManifestSchema, { space: 2 }))(
    manifest
  )

  yield* Effect.forEach(documents, (document) =>
    Effect.gen(function*() {
      const destination = path.join(outputDirectory, document.file)
      yield* fileSystem.makeDirectory(path.dirname(destination), { recursive: true })
      yield* fileSystem.writeFileString(destination, String.concat(document.content, "\n"))
      yield* Console.log("✓", document.file)
    }), { discard: true })
  yield* fileSystem.writeFileString(path.join(outputDirectory, "manifest.json"), String.concat(manifestContent, "\n"))
  yield* Console.log(
    "Generated",
    Array.length(fixtures),
    "fixtures with",
    Number.sumAll(
      Array.map(fixtures, (fixture) => Array.length<KnownFixture["payload"]["cases"][number]>(fixture.payload.cases))
    ),
    "reference cases in",
    outputDirectory
  )
})

BunRuntime.runMain(program.pipe(Effect.scoped, Effect.provide(BunServices.layer)))
