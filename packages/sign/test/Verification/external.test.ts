import { BunServices } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Ed25519, MlDsa, P256 } from "@scenesystems/sign"
import type { Verification } from "@scenesystems/sign"
import { Array as Arr, Boolean as B, Effect, Number as N, Schema, String as Str } from "effect"
import * as Encoding from "effect/encoding"

const decodeHex = (value: string) => Effect.fromResult(Encoding.Hex.decode(value))
import {
  decodeConformanceFixture,
  Ed25519Fixture,
  MlDsa65Fixture,
  P256Fixture
} from "../../scripts/fixture-contract.js"

const verificationVerdict = (
  verification: Effect.Effect<boolean, Verification.InvalidInput | Verification.Unavailable>
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
            Ed25519.verify(
              yield* decodeHex(vector.signature),
              yield* decodeHex(vector.message),
              yield* decodeHex(vector.publicKey)
            )
          )
          expect(verdict, vector.id).toBe(vector.strictVerdict)
        }), { discard: true })
    }).pipe(Effect.provide(BunServices.layer)), 30_000)

  it.effect("enforces the Wycheproof P-256 P1363 low-S profile", () =>
    Effect.gen(function*() {
      const fixture = yield* decodeConformanceFixture("p256.json", P256Fixture)
      yield* Effect.forEach(fixture.cases, (vector) =>
        Effect.gen(function*() {
          const verdict = yield* verificationVerdict(
            P256.verify(
              yield* decodeHex(vector.signature),
              yield* decodeHex(vector.message),
              yield* decodeHex(vector.publicKey.uncompressed)
            )
          )
          expect(verdict, yield* Schema.encodeEffect(Schema.FiniteFromString)(vector.tcId)).toBe(vector.strictVerdict)
        }), { discard: true })
    }).pipe(Effect.provide(BunServices.layer)))

  it.effect("verifies pure ML-DSA-65 ACVP vectors with their exact contexts", () =>
    Effect.gen(function*() {
      const fixture = yield* decodeConformanceFixture("ml-dsa-65.json", MlDsa65Fixture)
      yield* Effect.forEach(fixture.cases, (vector) =>
        Effect.gen(function*() {
          const publicKey = yield* decodeHex(vector.publicKey)
          const message = yield* decodeHex(vector.message)
          const signature = yield* decodeHex(vector.signature)
          const context = yield* decodeHex(vector.context)
          const expected = yield* Effect.fromOption(
            Arr.findFirst(fixture.strictVerdicts, ({ tcId }) => N.Equivalence(tcId, vector.tcId))
          )
          const verdict = yield* verificationVerdict(MlDsa.verify65(signature, message, publicKey, context))
          const label = Arr.join(
            Arr.make(
              yield* Schema.encodeEffect(Schema.FiniteFromString)(vector.tgId),
              yield* Schema.encodeEffect(Schema.FiniteFromString)(vector.tcId)
            ),
            ":"
          )

          expect(verdict, label).toBe(expected.verdict)
          yield* Effect.gen(function*() {
            const wrongContext = new Uint8Array(B.match(N.Equivalence(context.length, 0), {
              onTrue: () => Arr.of(1),
              onFalse: () => Arr.empty()
            }))
            const wrongContextVerified = yield* MlDsa.verify65(signature, message, publicKey, wrongContext)
            expect(wrongContextVerified, Str.concat(label, " wrong context")).toBe(false)
          }).pipe(Effect.when(Effect.succeed(Str.Equivalence(expected.verdict, "valid"))))
        }), { discard: true })
    }).pipe(Effect.provide(BunServices.layer)), 30_000)
})
