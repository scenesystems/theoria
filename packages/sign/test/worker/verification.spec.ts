import { FetchHttpClient } from "@effect/platform"
import * as BunContext from "@effect/platform-bun/BunContext"
import { describe, expect, it } from "@effect/vitest"
import { Jwt, Verification } from "@scenesystems/sign"
import { Array as Arr, Effect, Layer, Match, Schema, String as Str, Struct } from "effect"

import { decodeConformanceFixture, RsaOpenSslFixture } from "../../scripts/fixture-contract.js"
import { JwtFixture } from "../../scripts/jwt-fixture-contract.js"
import { startWorker } from "../../scripts/worker/runtime.js"

const platform = Layer.merge(BunContext.layer, FetchHttpClient.layer)

describe("packed sign in workerd without Node compatibility", () => {
  it.scopedLive("verifies OpenSSL RSA signatures and distinguishes nonmatches from invalid widths", () =>
    Effect.gen(function*() {
      const worker = yield* startWorker
      const fixture = yield* decodeConformanceFixture("rsa-openssl.json", RsaOpenSslFixture)
      yield* Effect.forEach(fixture.groups, (group) =>
        Effect.forEach(group.cases, (vector) =>
          Effect.gen(function*() {
            const input = { jwk: group.jwk, message: vector.message, signature: vector.signature }
            expect(yield* worker.request({ ...input, _tag: "Rsa" }), vector.name).toBe(true)
            expect(yield* worker.request({ ...input, _tag: "Rsa", message: vector.alteredMessage })).toBe(false)
            expect(yield* worker.request({ ...input, _tag: "Rsa", signature: vector.alteredSignature })).toBe(false)
            expect(yield* worker.request({ ...input, _tag: "Rsa", signature: Str.takeLeft(vector.signature, 2) }))
              .toEqual(new Verification.InvalidInput({}))
          })))
    }).pipe(Effect.provide(platform)))

  it.scopedLive("enforces independently signed Access claims, header restrictions, and identity policy", () =>
    Effect.gen(function*() {
      const worker = yield* startWorker
      const fixture = yield* decodeConformanceFixture("jwt-access-openssl.json", Schema.parseJson(JwtFixture))
      yield* Effect.forEach(fixture.cases, (vector) =>
        Effect.gen(function*() {
          const actual = yield* worker.request({
            _tag: "Jwt",
            token: vector.token,
            jwks: { keys: Arr.of(fixture.jwk) },
            nowMillis: 150_000
          })
          Match.value(vector.expected).pipe(
            Match.when("valid", () =>
              expect(actual, vector.name).toEqual({ sub: "user-7", email: "reader@example.test" })),
            Match.whenOr("Claims", "MalformedToken", (reason) =>
              expect(actual, vector.name).toEqual(new Jwt.Rejected({ reason }))),
            Match.exhaustive
          )
        }))
    }).pipe(Effect.provide(platform)))

  it.scopedLive("preserves key-selection errors and inclusive issuance/exclusive expiry in the Worker runtime", () =>
    Effect.gen(function*() {
      const worker = yield* startWorker
      const fixture = yield* decodeConformanceFixture("jwt-access-openssl.json", Schema.parseJson(JwtFixture))
      const token = Arr.headNonEmpty(fixture.cases).token
      yield* Effect.forEach(
        Arr.make(
          Arr.empty<typeof fixture.jwk>(),
          Arr.of(Struct.evolve(fixture.jwk, { kid: () => "different" })),
          Arr.make(fixture.jwk, fixture.jwk)
        ),
        (keys) =>
          Effect.gen(function*() {
            expect(yield* worker.request({ _tag: "Jwt", token, jwks: { keys }, nowMillis: 150_000 }))
              .toEqual(new Jwt.Rejected({ reason: "KeySelection" }))
          })
      )
      expect(
        yield* worker.request({
          _tag: "Jwt",
          token,
          jwks: { keys: Arr.of({ ...fixture.jwk, use: "enc" }) },
          nowMillis: 150_000
        })
      ).toEqual(new Jwt.Rejected({ reason: "InvalidKey" }))
      yield* Effect.forEach(Arr.make(99_999, 200_000), (nowMillis) =>
        Effect.gen(function*() {
          expect(yield* worker.request({ _tag: "Jwt", token, jwks: { keys: Arr.of(fixture.jwk) }, nowMillis }))
            .toEqual(new Jwt.Rejected({ reason: "Claims" }))
        }))
      yield* Effect.forEach(Arr.make(100_000, 199_999), (nowMillis) =>
        Effect.gen(function*() {
          expect(yield* worker.request({ _tag: "Jwt", token, jwks: { keys: Arr.of(fixture.jwk) }, nowMillis }))
            .toEqual({ sub: "user-7", email: "reader@example.test" })
        }))
    }).pipe(Effect.provide(platform)))
})
