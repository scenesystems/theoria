/**
 * Fixture check script — decodes every retained conformance payload against
 * its schema and verifies each payload's fingerprint against the provenance
 * manifest.
 *
 * Usage: bun run fixtures:check
 */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import * as Digest from "@scenesystems/digest/Digest"
import { Array as Arr, Console, Data, Effect, Match, Option, Schema, String as Str } from "effect"
import { Hex } from "effect/encoding"
import type * as PlatformError from "effect/PlatformError"
import type { ConformancePayload } from "./fixture-contract.js"
import {
  ConformanceManifest,
  decodeConformanceFixture,
  Ed25519Fixture,
  MlDsa65Fixture,
  P256Fixture,
  PublicSignatureKatFixture,
  readConformanceFixtureBytes,
  RsaOpenSslFixture,
  RsaWycheproofFixture
} from "./fixture-contract.js"
import { JwtFixture } from "./jwt-fixture-contract.js"

class FixtureCheckError extends Data.TaggedError("FixtureCheckError")<{
  readonly file: string
  readonly reason: string
  readonly cause: Option.Option<PlatformError.PlatformError | PlatformError.BadArgument | Schema.SchemaError>
}> {
  override get message() {
    return Arr.join(
      Arr.make(
        this.file,
        ": ",
        this.reason,
        Option.match(this.cause, {
          onNone: () => "",
          onSome: (cause) => Str.concat(": ", cause.message)
        })
      ),
      ""
    )
  }
}

const decodePayload = (file: typeof ConformancePayload.fields.file.Type) =>
  Match.value(file).pipe(
    Match.when("ed25519.json", (name) => decodeConformanceFixture(name, Ed25519Fixture)),
    Match.when("p256.json", (name) => decodeConformanceFixture(name, P256Fixture)),
    Match.when("ml-dsa-65.json", (name) => decodeConformanceFixture(name, MlDsa65Fixture)),
    Match.when("sign-public-kat.json", (name) => decodeConformanceFixture(name, PublicSignatureKatFixture)),
    Match.when("rsa-wycheproof.json", (name) => decodeConformanceFixture(name, RsaWycheproofFixture)),
    Match.when("rsa-openssl.json", (name) => decodeConformanceFixture(name, RsaOpenSslFixture)),
    Match.when("jwt-openssl.json", (name) => decodeConformanceFixture(name, Schema.fromJsonString(JwtFixture))),
    Match.when("jwt-access-openssl.json", (name) => decodeConformanceFixture(name, Schema.fromJsonString(JwtFixture))),
    Match.exhaustive
  )

const checkPayload = (payload: typeof ConformancePayload.Type) =>
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

    yield* Effect.succeed(Hex.encode(Digest.hash("sha256", bytes))).pipe(Effect.filterOrFail(
      (actual) => Str.Equivalence(actual, payload.sha256),
      (actual) =>
        new FixtureCheckError({
          file: payload.file,
          reason: Arr.join(Arr.make("sha256 mismatch: expected ", payload.sha256, ", got ", actual), ""),
          cause: Option.none()
        })
    ))

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

  const results = yield* Effect.forEach(manifest.payloads, (payload) => Effect.result(checkPayload(payload)))
  const [passed, errors] = Arr.separate(results)

  yield* Console.log("Checking", Arr.length(manifest.payloads), "conformance payloads...")
  yield* Console.log()
  yield* Effect.forEach(passed, (file) => Console.log("✓", file), { discard: true })
  yield* Effect.forEach(errors, (error) => Console.log("✗", error.message), { discard: true })
  yield* Console.log()
  yield* Console.log("Results:", Arr.length(passed), "passed,", Arr.length(errors), "failed")

  yield* Effect.fail(
    new FixtureCheckError({
      file: "summary",
      reason: "conformance fixture check failed",
      cause: Option.none()
    })
  ).pipe(Effect.when(Effect.succeed(Arr.isArrayNonEmpty(errors))))
})

BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)))
