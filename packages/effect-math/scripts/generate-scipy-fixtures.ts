/**
 * Evaluates Python reference families in scoped processes and writes validated fixtures.
 *
 * @since 0.1.0
 * @module
 */
import { Command, FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Array, Boolean, Config, Console, Effect, Number, Order, pipe, Schema, Stream, String } from "effect"

import { directoryBeside } from "../test/helpers/fixtures/io.js"
import type { FixtureManifestEntrySchema, KnownFixture } from "../test/helpers/fixtures/schemas.js"
import { FixtureManifestSchema, KnownFixtureSchema } from "../test/helpers/fixtures/schemas.js"

const ReferenceRequest = Schema.Struct({
  family: Schema.String,
  generatedAt: Schema.String
})

const GeneratedFixture = Schema.extend(KnownFixtureSchema, Schema.Struct({ file: Schema.String })).pipe(
  Schema.filter(
    (fixture) => String.Equivalence(fixture.file, String.concat(String.replace(".", "/")(fixture.fixture), ".json")),
    { message: () => "Fixture output path must match its canonical fixture name" }
  )
).annotations({ identifier: "@scenesystems/effect-math/fixtures/GeneratedFixture" })

const ReferenceBatch = FixtureManifestSchema.omit("fixtures").pipe(
  Schema.extend(Schema.Struct({ fixtures: Schema.NonEmptyArray(GeneratedFixture) }))
).annotations({ identifier: "@scenesystems/effect-math/fixtures/ReferenceBatch" })

const GeneratedFixtures = Schema.NonEmptyArray(GeneratedFixture).pipe(
  Schema.filter(
    (fixtures) =>
      Number.Equivalence(
        Array.length(fixtures),
        Array.length(Array.dedupe(Array.map(fixtures, (fixture) => fixture.fixture)))
      ),
    { message: () => "Reference families must not produce duplicate fixtures" }
  )
)

class ReferenceEvaluationError
  extends Schema.TaggedError<ReferenceEvaluationError>("@scenesystems/effect-math/fixtures/ReferenceEvaluationError")(
    "ReferenceEvaluationError",
    {
      family: Schema.String,
      exitCode: Schema.Number,
      message: Schema.String
    }
  )
{}

const evaluateFamily = (script: string, request: typeof ReferenceRequest.Type) =>
  Effect.gen(function*() {
    const input = yield* Schema.encode(Schema.parseJson(ReferenceRequest))(request)
    const child = yield* Command.make("uv", "run", "--script", script).pipe(
      Command.feed(input),
      Command.stdout("pipe"),
      Command.stderr("pipe"),
      Command.start
    )
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
    yield* Console.error(result.stderr).pipe(Effect.when(() => String.isNonEmpty(result.stderr)))
    return yield* Schema.decodeUnknown(Schema.parseJson(ReferenceBatch))(result.stdout, { onExcessProperty: "error" })
  }).pipe(Effect.scoped)

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const packageRoot = yield* directoryBeside(import.meta.url, "../")
  const outputDirectory = yield* Config.string("SCIPY_FIXTURE_OUTPUT_DIRECTORY").pipe(
    Config.withDefault(path.join(packageRoot, "test/fixtures/scipy"))
  )
  const generatedAt = yield* Config.string("SCIPY_FIXTURE_GENERATED_AT").pipe(
    Config.withDefault("2026-03-23T00:00:00Z")
  )
  const modules = yield* fileSystem.readDirectory(path.join(packageRoot, "scripts/fixtures"))
  const families = yield* Schema.decodeUnknown(Schema.NonEmptyArray(Schema.String))(
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
  const fixtures = yield* Schema.decodeUnknown(GeneratedFixtures)(
    Array.flatMap(Array.prepend(batches, provenance), (batch) => batch.fixtures),
    {
      onExcessProperty: "error"
    }
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
      Schema.encode(Schema.parseJson(KnownFixtureSchema, { space: 2 }))(fixture).pipe(
        Effect.map((content) => ({ file: fixture.file, content }))
      )
  )
  const manifestContent = yield* Schema.encode(Schema.parseJson(FixtureManifestSchema, { space: 2 }))(manifest)

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

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
