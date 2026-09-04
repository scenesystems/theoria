import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex } from "@noble/hashes/utils.js"
import { Array as Arr, Effect, Either, Encoding, Option } from "effect"
import { ed25519Verify } from "../../src/algorithms/ed25519.js"
import { mlDsa65Verify } from "../../src/algorithms/mlDsa.js"
import { p256Sha256P1363LowSVerify } from "../../src/algorithms/p256.js"
import {
  ConformanceManifest,
  decodeConformanceFixture,
  Ed25519Fixture,
  MlDsa65Fixture,
  P256Fixture,
  readConformanceFixtureBytes
} from "./fixtures.js"

const decodeHex = (value: string): Effect.Effect<Uint8Array> =>
  Either.match(Encoding.decodeHex(value), {
    onLeft: () => Effect.dieMessage("schema-admitted fixture hex did not decode"),
    onRight: Effect.succeed
  })

const verificationVerdict = <E extends { readonly _tag: string }>(
  verification: Effect.Effect<boolean, E>
) =>
  verification.pipe(
    Effect.match({
      onFailure: (error) => error._tag === "InvalidVerificationInput" ? "invalid-input" : error._tag,
      onSuccess: (verified) => verified ? "valid" : "nonmatch"
    })
  )

describe("strict direct verification — retained external corpus", () => {
  it.effect("verifies RFC 8032 and rejects every retained ZIP-215 hostile case", () =>
    Effect.gen(function*() {
      const fixture = yield* decodeConformanceFixture("ed25519.json", Ed25519Fixture)
      yield* Effect.forEach(fixture.cases, (vector) =>
        Effect.gen(function*() {
          const verdict = yield* verificationVerdict(
            ed25519Verify(
              yield* decodeHex(vector.signature),
              yield* decodeHex(vector.message),
              yield* decodeHex(vector.publicKey)
            )
          )
          expect(verdict, vector.id).toBe(vector.strictVerdict)
        }), { discard: true })
    }).pipe(Effect.provide(BunContext.layer)), 30_000)

  it.effect("enforces the Wycheproof P-256 P1363 low-S profile", () =>
    Effect.gen(function*() {
      const fixture = yield* decodeConformanceFixture("p256.json", P256Fixture)
      yield* Effect.forEach(fixture.cases, (vector) =>
        Effect.gen(function*() {
          const verdict = yield* verificationVerdict(
            p256Sha256P1363LowSVerify(
              yield* decodeHex(vector.signature),
              yield* decodeHex(vector.message),
              yield* decodeHex(vector.publicKey.uncompressed)
            )
          )
          expect(verdict, String(vector.tcId)).toBe(vector.strictVerdict)
        }), { discard: true })
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("verifies pure ML-DSA-65 ACVP vectors with their exact contexts", () =>
    Effect.gen(function*() {
      const fixture = yield* decodeConformanceFixture("ml-dsa-65.json", MlDsa65Fixture)
      yield* Effect.forEach(fixture.cases, (vector) =>
        Effect.gen(function*() {
          const publicKey = yield* decodeHex(vector.publicKey)
          const message = yield* decodeHex(vector.message)
          const signature = yield* decodeHex(vector.signature)
          const context = yield* decodeHex(vector.context)
          const expected = Option.getOrThrow(
            Arr.findFirst(fixture.strictVerdicts, ({ tcId }) => tcId === vector.tcId)
          )
          const verdict = yield* verificationVerdict(mlDsa65Verify(signature, message, publicKey, context))

          expect(verdict, `${String(vector.tgId)}:${String(vector.tcId)}`).toBe(expected.verdict)
          expect(expected.verdict === "valid").toBe(vector.testPassed)
          if (expected.verdict === "valid") {
            const wrongContext = context.length === 0 ? Uint8Array.of(1) : new Uint8Array(0)
            const wrongContextVerified = yield* mlDsa65Verify(signature, message, publicKey, wrongContext)
            expect(wrongContextVerified, `${String(vector.tgId)}:${String(vector.tcId)} wrong context`).toBe(false)
          }
        }), { discard: true })
    }).pipe(Effect.provide(BunContext.layer)), 30_000)

  it.effect("every retained payload matches its manifest fingerprint", () =>
    Effect.gen(function*() {
      const manifest = yield* decodeConformanceFixture("sources.manifest.json", ConformanceManifest)
      yield* Effect.forEach(manifest.payloads, (payload) =>
        Effect.gen(function*() {
          const bytes = yield* readConformanceFixtureBytes(payload.file)
          expect(bytesToHex(sha256(bytes)), payload.file).toBe(payload.sha256)
        }), { discard: true })
    }).pipe(Effect.provide(BunContext.layer)))
})
