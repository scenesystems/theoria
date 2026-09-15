import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as B, Effect, Encoding, Number as N, Schema, String as Str } from "effect"
import {
  decodeConformanceFixture,
  Ed25519Fixture,
  MlDsa65Fixture,
  P256Fixture
} from "../../scripts/fixture-contract.js"
import { ed25519Verify } from "../../src/algorithms/ed25519.js"
import { mlDsa65Verify } from "../../src/algorithms/mlDsa.js"
import { p256Sha256P1363LowSVerify } from "../../src/algorithms/p256.js"
import type { InvalidVerificationInput, VerificationUnavailable } from "../../src/schemas/errors.js"

const verificationVerdict = (
  verification: Effect.Effect<boolean, InvalidVerificationInput | VerificationUnavailable>
) =>
  verification.pipe(
    Effect.map(B.match({ onTrue: () => "valid", onFalse: () => "nonmatch" })),
    Effect.catchTag("InvalidVerificationInput", () => Effect.succeed("invalid-input"))
  )

describe("strict direct verification — retained external corpus", () => {
  it.effect("verifies RFC 8032 and rejects every retained ZIP-215 hostile case", () =>
    Effect.gen(function*() {
      const fixture = yield* decodeConformanceFixture("ed25519.json", Ed25519Fixture)
      yield* Effect.forEach(fixture.cases, (vector) =>
        Effect.gen(function*() {
          const verdict = yield* verificationVerdict(
            ed25519Verify(
              yield* Encoding.decodeHex(vector.signature),
              yield* Encoding.decodeHex(vector.message),
              yield* Encoding.decodeHex(vector.publicKey)
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
              yield* Encoding.decodeHex(vector.signature),
              yield* Encoding.decodeHex(vector.message),
              yield* Encoding.decodeHex(vector.publicKey.uncompressed)
            )
          )
          expect(verdict, yield* Schema.encode(Schema.NumberFromString)(vector.tcId)).toBe(vector.strictVerdict)
        }), { discard: true })
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("verifies pure ML-DSA-65 ACVP vectors with their exact contexts", () =>
    Effect.gen(function*() {
      const fixture = yield* decodeConformanceFixture("ml-dsa-65.json", MlDsa65Fixture)
      yield* Effect.forEach(fixture.cases, (vector) =>
        Effect.gen(function*() {
          const publicKey = yield* Encoding.decodeHex(vector.publicKey)
          const message = yield* Encoding.decodeHex(vector.message)
          const signature = yield* Encoding.decodeHex(vector.signature)
          const context = yield* Encoding.decodeHex(vector.context)
          const expected = yield* Arr.findFirst(fixture.strictVerdicts, ({ tcId }) => N.Equivalence(tcId, vector.tcId))
          const verdict = yield* verificationVerdict(mlDsa65Verify(signature, message, publicKey, context))
          const label = Arr.join(
            Arr.make(
              yield* Schema.encode(Schema.NumberFromString)(vector.tgId),
              yield* Schema.encode(Schema.NumberFromString)(vector.tcId)
            ),
            ":"
          )

          expect(verdict, label).toBe(expected.verdict)
          yield* Effect.gen(function*() {
            const wrongContext = yield* Schema.decode(Schema.Uint8Array)(B.match(N.Equivalence(context.length, 0), {
              onTrue: () => Arr.of(1),
              onFalse: () => Arr.empty()
            }))
            const wrongContextVerified = yield* mlDsa65Verify(signature, message, publicKey, wrongContext)
            expect(wrongContextVerified, Str.concat(label, " wrong context")).toBe(false)
          }).pipe(Effect.when(() => Str.Equivalence(expected.verdict, "valid")))
        }), { discard: true })
    }).pipe(Effect.provide(BunContext.layer)), 30_000)
})
