import { FileSystem, Path } from "@effect/platform"
import { gcm, gcmsiv } from "@noble/ciphers/aes.js"
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js"
import { concatBytes } from "@noble/ciphers/utils.js"
import { Effect, Encoding, Match, Schema } from "effect"

import { packEnvelope } from "../../src/encoding.js"
import { SealAlgorithm } from "../../src/schemas/SealAlgorithm.js"
import { SealedEnvelope } from "../../src/schemas/SealedEnvelope.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const Base64UrlText = Schema.String.pipe(Schema.minLength(1), Schema.pattern(/^[A-Za-z0-9_-]+$/))

const SealRuntimeFixtureRuntimeSchema = Schema.Struct({
  name: NonEmptyString,
  version: NonEmptyString,
  surface: NonEmptyString,
  mode: Schema.Literal("raw-aead")
})

const SealRuntimeFixtureProvenanceSchema = Schema.Struct({
  reference: NonEmptyString,
  normalizationNotes: NonEmptyString
})

const SealRuntimeFixtureDeterministicInputSchema = Schema.Struct({
  key: Base64UrlText,
  nonce: Base64UrlText,
  plaintext: Base64UrlText,
  associatedData: Base64UrlText
})

export const SealRuntimeFixtureSchema = Schema.Struct({
  fixture: NonEmptyString,
  algorithm: SealAlgorithm,
  runtime: SealRuntimeFixtureRuntimeSchema,
  provenance: SealRuntimeFixtureProvenanceSchema,
  deterministicInput: SealRuntimeFixtureDeterministicInputSchema,
  envelope: SealedEnvelope
})

export type SealRuntimeFixture = typeof SealRuntimeFixtureSchema.Type

const SealRuntimeFixtureManifestEntrySchema = Schema.Struct({
  fixture: NonEmptyString,
  file: NonEmptyString,
  algorithm: SealAlgorithm
})

export type SealRuntimeFixtureManifestEntry = typeof SealRuntimeFixtureManifestEntrySchema.Type

export const SealRuntimeFixtureManifestSchema = Schema.Struct({
  version: Schema.Literal("1"),
  fixtures: Schema.Array(SealRuntimeFixtureManifestEntrySchema).pipe(Schema.minItems(1))
})

export type SealRuntimeFixtureManifest = typeof SealRuntimeFixtureManifestSchema.Type

const fixturesRootUrl = new URL("../fixtures/interop/", import.meta.url)

const readJson = <A>(url: URL, schema: Schema.Schema<A>) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* path.fromFileUrl(fixturesRootUrl).pipe(Effect.orDie)
    const filePath = path.join(root, url.pathname.split("/").at(-1) ?? "")
    const text = yield* fileSystem.readFileString(filePath).pipe(Effect.orDie)

    return yield* Schema.decode(Schema.parseJson(schema))(text).pipe(Effect.orDie)
  })

export const loadInteropManifest = readJson(new URL("manifest.json", fixturesRootUrl), SealRuntimeFixtureManifestSchema)

export const loadInteropFixture = (entry: SealRuntimeFixtureManifestEntry) =>
  readJson(new URL(entry.file, fixturesRootUrl), SealRuntimeFixtureSchema)

export const decodeDeterministicInput = (fixture: SealRuntimeFixture) =>
  Effect.all({
    key: Encoding.decodeBase64Url(fixture.deterministicInput.key),
    nonce: Encoding.decodeBase64Url(fixture.deterministicInput.nonce),
    plaintext: Encoding.decodeBase64Url(fixture.deterministicInput.plaintext),
    associatedData: Encoding.decodeBase64Url(fixture.deterministicInput.associatedData)
  }).pipe(Effect.orDie)

export const rawRuntimeCiphertext = (fixture: SealRuntimeFixture) =>
  decodeDeterministicInput(fixture).pipe(
    Effect.flatMap(({ associatedData, key, nonce, plaintext }) =>
      Effect.sync(() =>
        Match.value(fixture.algorithm).pipe(
          Match.when("xchacha20-poly1305", () => xchacha20poly1305(key, nonce, associatedData).encrypt(plaintext)),
          Match.when("aes-256-gcm-siv", () => gcmsiv(key, nonce, associatedData).encrypt(plaintext)),
          Match.when("aes-256-gcm", () => gcm(key, nonce, associatedData).encrypt(plaintext)),
          Match.exhaustive
        )
      )
    )
  )

export const runtimeFixtureEnvelope = (fixture: SealRuntimeFixture) =>
  Effect.all({
    deterministicInput: decodeDeterministicInput(fixture),
    ciphertext: rawRuntimeCiphertext(fixture)
  }).pipe(
    Effect.flatMap(({ ciphertext, deterministicInput }) =>
      packEnvelope(fixture.algorithm, concatBytes(deterministicInput.nonce, ciphertext), {
        keyId: fixture.envelope.keyId,
        keyVersion: fixture.envelope.keyVersion
      })
    )
  )
