/**
 * Fixture check script — decodes every retained conformance payload against
 * its schema and verifies each payload's fingerprint against the provenance
 * manifest.
 *
 * Usage: bun run fixtures:check
 */
import { BunContext, BunRuntime } from "@effect/platform-bun"
import type * as PlatformError from "@effect/platform/Error"
import { sha256 } from "@noble/hashes/sha2.js"
import type { ParseResult, Schema } from "effect"
import { Array as Arr, Console, Data, Effect, Encoding, Match, Option } from "effect"
import {
  ConformanceManifest,
  decodeConformanceFixture,
  Ed25519Fixture,
  MlDsa65Fixture,
  P256Fixture,
  readConformanceFixtureBytes
} from "./fixture-contract.js"

class FixtureCheckError extends Data.TaggedError("FixtureCheckError")<{
  readonly file: string
  readonly reason: string
  readonly cause: Option.Option<PlatformError.PlatformError | ParseResult.ParseError>
}> {
  override get message() {
    return `${this.file}: ${this.reason}${
      Option.match(this.cause, {
        onNone: () => "",
        onSome: (cause) => `: ${cause.message}`
      })
    }`
  }
}

type ManifestPayload = Schema.Schema.Type<typeof ConformanceManifest>["payloads"][number]

const decodePayload = (file: ManifestPayload["file"]) =>
  Match.value(file).pipe(
    Match.when("ed25519.json", (name) => decodeConformanceFixture(name, Ed25519Fixture)),
    Match.when("p256.json", (name) => decodeConformanceFixture(name, P256Fixture)),
    Match.when("ml-dsa-65.json", (name) => decodeConformanceFixture(name, MlDsa65Fixture)),
    Match.exhaustive
  )

const checkPayload = (payload: ManifestPayload) =>
  Effect.gen(function*() {
    const bytes = yield* readConformanceFixtureBytes(payload.file).pipe(
      Effect.mapError((error) =>
        new FixtureCheckError({ file: payload.file, reason: "read failed", cause: Option.some(error) })
      )
    )

    yield* decodePayload(payload.file).pipe(
      Effect.mapError((error) =>
        new FixtureCheckError({ file: payload.file, reason: "schema decode failed", cause: Option.some(error) })
      )
    )

    const actualSha256 = Encoding.encodeHex(sha256(bytes))
    if (actualSha256 !== payload.sha256) {
      return yield* new FixtureCheckError({
        file: payload.file,
        reason: `sha256 mismatch: expected ${payload.sha256}, got ${actualSha256}`,
        cause: Option.none()
      })
    }

    return payload.file
  })

const program = Effect.gen(function*() {
  const manifest = yield* decodeConformanceFixture("sources.manifest.json", ConformanceManifest).pipe(
    Effect.mapError((error) =>
      new FixtureCheckError({
        file: "sources.manifest.json",
        reason: "manifest decode failed",
        cause: Option.some(error)
      })
    )
  )

  const results = yield* Effect.forEach(manifest.payloads, (payload) => Effect.either(checkPayload(payload)))
  const [errors, passed] = Arr.separate(results)

  yield* Console.log(`Checking ${manifest.payloads.length} conformance payloads...`)
  yield* Console.log()
  yield* Effect.forEach(passed, (file) => Console.log(`✓ ${file}`), { discard: true })
  yield* Effect.forEach(errors, (error) => Console.log(`✗ ${error.message}`), { discard: true })
  yield* Console.log()
  yield* Console.log(`Results: ${passed.length} passed, ${errors.length} failed`)

  if (Arr.isNonEmptyArray(errors)) {
    return yield* new FixtureCheckError({
      file: "summary",
      reason: `${errors.length} fixture check failure(s)`,
      cause: Option.none()
    })
  }
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
