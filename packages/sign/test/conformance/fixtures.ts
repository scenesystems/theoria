import { FileSystem, Path, Url } from "@effect/platform"
import { Effect, Schema } from "effect"

const Hex = Schema.String.pipe(Schema.pattern(/^(?:[a-fA-F0-9]{2})*$/))
export const StrictVerdict = Schema.Literal("valid", "invalid-input", "nonmatch")

export const Ed25519Fixture = Schema.parseJson(
  Schema.Struct({
    schema: Schema.Literal("@scenesystems/sign ed25519 strict conformance v1"),
    cases: Schema.NonEmptyArray(
      Schema.Struct({
        id: Schema.NonEmptyString,
        publicKey: Hex,
        message: Hex,
        signature: Hex,
        strictVerdict: StrictVerdict
      })
    )
  })
)

export const P256Fixture = Schema.parseJson(
  Schema.Struct({
    schema: Schema.Literal("@scenesystems/sign P-256 SHA-256 P1363 low-S conformance v1"),
    cases: Schema.NonEmptyArray(
      Schema.Struct({
        tcId: Schema.Number.pipe(Schema.int(), Schema.positive()),
        publicKey: Schema.Struct({ uncompressed: Hex }),
        message: Hex,
        signature: Hex,
        strictVerdict: StrictVerdict
      })
    )
  })
)

export const MlDsa65Fixture = Schema.parseJson(
  Schema.Struct({
    schema: Schema.Literal("@scenesystems/sign ML-DSA-65 pure external-interface conformance v1"),
    strictVerdicts: Schema.NonEmptyArray(
      Schema.Struct({
        tcId: Schema.Number.pipe(Schema.int(), Schema.positive()),
        verdict: StrictVerdict
      })
    ),
    cases: Schema.NonEmptyArray(
      Schema.Struct({
        tgId: Schema.Number.pipe(Schema.int(), Schema.positive()),
        tcId: Schema.Number.pipe(Schema.int(), Schema.positive()),
        publicKey: Hex,
        message: Hex,
        signature: Hex,
        context: Hex,
        testPassed: Schema.Boolean
      })
    )
  })
)

const Sha256Hex = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/))
const Source = Schema.Struct({
  locator: Schema.String.pipe(Schema.pattern(/^https:\/\//)),
  revision: Schema.NonEmptyString,
  path: Schema.NonEmptyString,
  selector: Schema.NonEmptyString
})

export const ConformanceManifest = Schema.parseJson(
  Schema.Struct({
    schema: Schema.Literal("@scenesystems/sign conformance provenance manifest v1"),
    retrievalDate: Schema.Literal("2026-07-30"),
    payloads: Schema.NonEmptyArray(
      Schema.Struct({
        file: Schema.Literal("ed25519.json", "p256.json", "ml-dsa-65.json"),
        sha256: Sha256Hex,
        sources: Schema.NonEmptyArray(Source),
        licenseNotice: Schema.NonEmptyString,
        transformations: Schema.NonEmptyArray(Schema.NonEmptyString),
        exclusions: Schema.Array(Schema.NonEmptyString),
        localVerdictRemaps: Schema.Array(Schema.Unknown)
      })
    )
  })
)

const fixturePath = (file: string): Effect.Effect<string, never, Path.Path> =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const root = yield* path.fromFileUrl(yield* Url.fromString("../fixtures/conformance/", import.meta.url))
    return path.join(root, file)
  }).pipe(Effect.orDie)

export const readConformanceFixture = (file: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    return yield* fileSystem.readFileString(yield* fixturePath(file)).pipe(Effect.orDie)
  })

export const readConformanceFixtureBytes = (file: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    return yield* fileSystem.readFile(yield* fixturePath(file)).pipe(Effect.orDie)
  })

export const decodeConformanceFixture = <A, I>(file: string, schema: Schema.Schema<A, I>) =>
  readConformanceFixture(file).pipe(
    Effect.flatMap(Schema.decodeUnknown(schema)),
    Effect.orDie
  )
