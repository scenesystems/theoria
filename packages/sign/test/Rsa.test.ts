import { BunServices } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Verification } from "@scenesystems/sign"
import * as Rsa from "@scenesystems/sign/Rsa"
import { Array as Arr, Effect, Match, Number as N, Record, Schema, String as Str, Struct } from "effect"
import * as Encoding from "effect/encoding"

const decodeHex = (value: string) => Effect.fromResult(Encoding.Hex.decode(value))
const decodeBase64Url = (value: string) => Effect.fromResult(Encoding.Base64Url.decode(value))
import { decodeConformanceFixture, RsaOpenSslFixture, RsaWycheproofFixture } from "../scripts/fixture-contract.js"
import corpus from "./fixtures/conformance/rsa-wycheproof.json" with { type: "json" }

describe("RSA PKCS1 SHA-256", () => {
  it.effect("enforces strict DER and padding across all 259 independent Wycheproof vectors", () =>
    Effect.gen(function*() {
      const fixture = yield* Schema.decodeUnknownEffect(Schema.toType(RsaWycheproofFixture))(corpus)
      yield* Effect.forEach(fixture.testGroups, (group) =>
        Effect.gen(function*() {
          const key = yield* Rsa.publicKeyFromJwk(group.keyJwk)
          yield* Effect.forEach(group.tests, (vector) =>
            Effect.gen(function*() {
              const signature = yield* decodeHex(vector.sig)
              const message = yield* decodeHex(vector.msg)
              const verified = yield* Rsa.verify(signature, message, key).pipe(
                Effect.catchTag("InvalidVerificationInput", () => Effect.succeed(false))
              )
              const label = Str.concat("Wycheproof ", yield* Schema.encodeEffect(Schema.FiniteFromString)(vector.tcId))
              const expected = Match.value(vector.result).pipe(
                Match.when("valid", () => true),
                Match.whenOr("invalid", "acceptable", () => false),
                Match.exhaustive
              )
              expect(verified, label).toBe(expected)
            }))
        }))
    }))

  it.effect("rejects noncanonical integers, unsupported parameters, and conflicting JWK metadata", () =>
    Effect.gen(function*() {
      const fixture = yield* Schema.decodeUnknownEffect(Schema.toType(RsaWycheproofFixture))(corpus)
      const group = Arr.headNonEmpty(fixture.testGroups)
      const modulus = yield* decodeBase64Url(group.keyJwk.n)
      const leadingZero = new Uint8Array(Arr.prepend(Arr.fromIterable(modulus), 0))
      yield* Effect.forEach(
        Arr.make(
          Struct.evolve(group.keyJwk, { n: () => Encoding.Base64Url.encode(leadingZero) }),
          Struct.evolve(group.keyJwk, { n: (n) => Str.concat(n, "=") }),
          Struct.evolve(group.keyJwk, { n: () => "AQ" }),
          Struct.evolve(group.keyJwk, { e: () => "AA" }),
          Struct.evolve(group.keyJwk, { e: () => "AQ" }),
          Struct.evolve(group.keyJwk, { e: () => "Ag" }),
          Struct.evolve(group.keyJwk, { e: () => "_____g" }),
          Struct.evolve(group.keyJwk, { e: () => "AQAAAAE" }),
          Record.set(group.keyJwk, "alg", "PS256"),
          Record.set(group.keyJwk, "use", "enc"),
          Record.set(group.keyJwk, "key_ops", Arr.make("sign"))
        ),
        (jwk) =>
          Rsa.publicKeyFromJwk(jwk).pipe(
            Effect.flip,
            Effect.map((error) => expect(error).toEqual(new Rsa.InvalidPublicKey({})))
          )
      )
    }))

  it.effect("classifies unreadable JWK fields and RSA key fields as material-free admission failures", () =>
    Effect.gen(function*() {
      const fixture = yield* Schema.decodeUnknownEffect(Schema.toType(RsaWycheproofFixture))(corpus)
      const jwk = Arr.headNonEmpty(fixture.testGroups).keyJwk
      const key = yield* Rsa.publicKeyFromJwk(jwk)
      const unreadableN = {
        ...jwk,
        get n() {
          return Schema.decodeUnknownSync(Schema.Never)(jwk.n)
        }
      }
      const unreadableE = {
        ...jwk,
        get e() {
          return Schema.decodeUnknownSync(Schema.Never)(jwk.e)
        }
      }
      const unreadableModulus = {
        get modulus() {
          return Schema.decodeUnknownSync(Schema.Never)(key.modulus)
        },
        exponent: key.exponent
      }
      const unreadableExponent = {
        modulus: key.modulus,
        get exponent() {
          return Schema.decodeUnknownSync(Schema.Never)(key.exponent)
        }
      }
      const signature = new Uint8Array(Arr.replicate(0, 256))
      const message = new Uint8Array(Arr.empty<number>())

      yield* Effect.forEach(Arr.make(unreadableN, unreadableE), (unreadableJwk) =>
        Effect.gen(function*() {
          expect(yield* Effect.flip(Rsa.publicKeyFromJwk(unreadableJwk))).toEqual(new Rsa.InvalidPublicKey({}))
        }))
      yield* Effect.forEach(Arr.make(unreadableModulus, unreadableExponent), (unreadableKey) =>
        Effect.gen(function*() {
          expect(yield* Effect.flip(Rsa.verify(signature, message, unreadableKey))).toEqual(
            new Verification.InvalidInput({})
          )
        }))
    }))

  it.effect("verifies OpenSSL signatures across key/exponent boundaries and rejects altered signed bytes", () =>
    Effect.gen(function*() {
      const fixture = yield* decodeConformanceFixture("rsa-openssl.json", RsaOpenSslFixture)
      yield* Effect.forEach(fixture.groups, (group) =>
        Effect.gen(function*() {
          const key = yield* Rsa.publicKeyFromJwk(group.jwk)
          yield* Effect.forEach(group.cases, (vector) =>
            Effect.gen(function*() {
              const message = yield* decodeHex(vector.message)
              const signature = yield* decodeHex(vector.signature)
              const label = Str.concat(group.name, Str.concat(" / ", vector.name))
              expect(yield* Rsa.verify(signature, message, key), label).toBe(true)
              const alteredMessage = yield* decodeHex(vector.alteredMessage)
              const alteredSignature = yield* decodeHex(vector.alteredSignature)
              expect(yield* Rsa.verify(signature, alteredMessage, key), label).toBe(false)
              expect(yield* Rsa.verify(alteredSignature, message, key), label).toBe(false)
            }))
        }))
    }).pipe(Effect.provide(BunServices.layer)))

  it.effect("enforces modulus-width signatures, representative range, and the inclusive message limit", () =>
    Effect.gen(function*() {
      const fixture = yield* decodeConformanceFixture("rsa-openssl.json", RsaOpenSslFixture)
      yield* Effect.forEach(fixture.groups, (group) =>
        Effect.gen(function*() {
          const key = yield* Rsa.publicKeyFromJwk(group.jwk)
          const vector = Arr.headNonEmpty(group.cases)
          const message = yield* decodeHex(vector.message)
          const signature = Arr.fromIterable(yield* decodeHex(vector.signature))
          const modulus = Arr.fromIterable(yield* decodeBase64Url(group.jwk.n))
          const width = Arr.length(modulus)
          yield* Effect.forEach(
            Arr.make(
              Arr.drop(signature, 1),
              Arr.prepend(signature, 0),
              Arr.append(signature, 0),
              modulus,
              Arr.replicate(255, width)
            ),
            (bytes) =>
              Effect.gen(function*() {
                const invalid = new Uint8Array(bytes)
                expect(yield* Effect.flip(Rsa.verify(invalid, message, key)), group.name).toEqual(
                  new Verification.InvalidInput({})
                )
              })
          )
          const belowModulus = yield* Effect.fromOption(Arr.modify(modulus, N.decrement(width), N.decrement))
          yield* Effect.forEach(
            Arr.make(Arr.replicate(0, width), Arr.append(Arr.replicate(0, N.decrement(width)), 1), belowModulus),
            (bytes) =>
              Effect.gen(function*() {
                const admitted = new Uint8Array(bytes)
                expect(yield* Rsa.verify(admitted, message, key), group.name).toBe(false)
              })
          )
          const limit = yield* Effect.fromOption(
            Arr.findFirst(group.cases, (test) => Str.Equivalence(test.name, "8192 bytes"))
          )
          const limitMessage = yield* decodeHex(limit.message)
          const limitSignature = yield* decodeHex(limit.signature)
          expect(yield* Rsa.verify(limitSignature, limitMessage, key), group.name).toBe(true)
          const tooLong = new Uint8Array(Arr.append(Arr.fromIterable(limitMessage), 1))
          expect(yield* Effect.flip(Rsa.verify(limitSignature, tooLong, key)), group.name).toEqual(
            new Verification.InvalidInput({})
          )
        }))
    }).pipe(Effect.provide(BunServices.layer)))

  it.effect("rejects 2047-bit, 4097-bit, and even moduli without conflating width with bit length", () =>
    Effect.gen(function*() {
      const fixture = yield* Schema.decodeUnknownEffect(Schema.toType(RsaWycheproofFixture))(corpus)
      const jwk = Arr.headNonEmpty(fixture.testGroups).keyJwk
      const original = Arr.fromIterable(yield* decodeBase64Url(jwk.n))
      const even = yield* Effect.fromOption(Arr.modify(original, N.decrement(Arr.length(original)), N.decrement))
      yield* Effect.forEach(
        Arr.make(Arr.prepend(Arr.replicate(255, 255), 127), Arr.append(Arr.prepend(Arr.replicate(0, 511), 1), 1), even),
        (bytes) =>
          Effect.gen(function*() {
            const n = Encoding.Base64Url.encode(new Uint8Array(bytes))
            expect(yield* Effect.flip(Rsa.publicKeyFromJwk(Struct.evolve(jwk, { n: () => n })))).toEqual(
              new Rsa.InvalidPublicKey({})
            )
          })
      )
    }))
})
