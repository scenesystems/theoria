import * as BunContext from "@effect/platform-bun/BunContext"
import { describe, expect, it } from "@effect/vitest"
import { InvalidRsaPublicKey, InvalidVerificationInput, rsaPublicKeyFromJwk, rsaSha256Verify } from "@scenesystems/sign"
import { Array as Arr, Effect, Encoding, Match, Number as N, Record, Schema, String as Str, Struct } from "effect"
import { decodeConformanceFixture, RsaOpenSslFixture, RsaWycheproofFixture } from "../scripts/fixture-contract.js"
import corpus from "./fixtures/conformance/rsa-wycheproof.json" with { type: "json" }

describe("RSA PKCS1 SHA-256", () => {
  it.effect("enforces strict DER and padding across all 259 independent Wycheproof vectors", () =>
    Effect.gen(function*() {
      const fixture = yield* Schema.decodeUnknown(Schema.typeSchema(RsaWycheproofFixture))(corpus)
      yield* Effect.forEach(fixture.testGroups, (group) =>
        Effect.gen(function*() {
          const key = yield* rsaPublicKeyFromJwk(group.keyJwk)
          yield* Effect.forEach(group.tests, (vector) =>
            Effect.gen(function*() {
              const signature = yield* Encoding.decodeHex(vector.sig)
              const message = yield* Encoding.decodeHex(vector.msg)
              const verified = yield* rsaSha256Verify(signature, message, key).pipe(
                Effect.catchTag("InvalidVerificationInput", () => Effect.succeed(false))
              )
              const label = Str.concat("Wycheproof ", yield* Schema.encode(Schema.NumberFromString)(vector.tcId))
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
      const fixture = yield* Schema.decodeUnknown(Schema.typeSchema(RsaWycheproofFixture))(corpus)
      const group = Arr.headNonEmpty(fixture.testGroups)
      const modulus = yield* Encoding.decodeBase64Url(group.keyJwk.n)
      const leadingZero = yield* Schema.decode(Schema.Uint8Array)(Arr.prepend(Arr.fromIterable(modulus), 0))
      yield* Effect.forEach(
        Arr.make(
          Struct.evolve(group.keyJwk, { n: () => Encoding.encodeBase64Url(leadingZero) }),
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
          rsaPublicKeyFromJwk(jwk).pipe(
            Effect.flip,
            Effect.map((error) => expect(error).toEqual(new InvalidRsaPublicKey({})))
          )
      )
    }))

  it.effect("classifies unreadable JWK fields and RSA key fields as material-free admission failures", () =>
    Effect.gen(function*() {
      const fixture = yield* Schema.decodeUnknown(Schema.typeSchema(RsaWycheproofFixture))(corpus)
      const jwk = Arr.headNonEmpty(fixture.testGroups).keyJwk
      const key = yield* rsaPublicKeyFromJwk(jwk)
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
      const signature = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0, 256))
      const message = yield* Schema.decode(Schema.Uint8Array)(Arr.empty<number>())

      yield* Effect.forEach(Arr.make(unreadableN, unreadableE), (unreadableJwk) =>
        Effect.gen(function*() {
          expect(yield* Effect.flip(rsaPublicKeyFromJwk(unreadableJwk))).toEqual(new InvalidRsaPublicKey({}))
        }))
      yield* Effect.forEach(Arr.make(unreadableModulus, unreadableExponent), (unreadableKey) =>
        Effect.gen(function*() {
          expect(yield* Effect.flip(rsaSha256Verify(signature, message, unreadableKey))).toEqual(
            new InvalidVerificationInput({})
          )
        }))
    }))

  it.effect("verifies OpenSSL signatures across key/exponent boundaries and rejects altered signed bytes", () =>
    Effect.gen(function*() {
      const fixture = yield* decodeConformanceFixture("rsa-openssl.json", RsaOpenSslFixture)
      yield* Effect.forEach(fixture.groups, (group) =>
        Effect.gen(function*() {
          const key = yield* rsaPublicKeyFromJwk(group.jwk)
          yield* Effect.forEach(group.cases, (vector) =>
            Effect.gen(function*() {
              const message = yield* Encoding.decodeHex(vector.message)
              const signature = yield* Encoding.decodeHex(vector.signature)
              const label = Str.concat(group.name, Str.concat(" / ", vector.name))
              expect(yield* rsaSha256Verify(signature, message, key), label).toBe(true)
              const alteredMessage = yield* Encoding.decodeHex(vector.alteredMessage)
              const alteredSignature = yield* Encoding.decodeHex(vector.alteredSignature)
              expect(yield* rsaSha256Verify(signature, alteredMessage, key), label).toBe(false)
              expect(yield* rsaSha256Verify(alteredSignature, message, key), label).toBe(false)
            }))
        }))
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("enforces modulus-width signatures, representative range, and the inclusive message limit", () =>
    Effect.gen(function*() {
      const fixture = yield* decodeConformanceFixture("rsa-openssl.json", RsaOpenSslFixture)
      yield* Effect.forEach(fixture.groups, (group) =>
        Effect.gen(function*() {
          const key = yield* rsaPublicKeyFromJwk(group.jwk)
          const vector = Arr.headNonEmpty(group.cases)
          const message = yield* Encoding.decodeHex(vector.message)
          const signature = Arr.fromIterable(yield* Encoding.decodeHex(vector.signature))
          const modulus = Arr.fromIterable(yield* Encoding.decodeBase64Url(group.jwk.n))
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
                const invalid = yield* Schema.decode(Schema.Uint8Array)(bytes)
                expect(yield* Effect.flip(rsaSha256Verify(invalid, message, key)), group.name).toEqual(
                  new InvalidVerificationInput({})
                )
              })
          )
          const belowModulus = yield* Arr.modifyOption(modulus, N.decrement(width), N.decrement)
          yield* Effect.forEach(
            Arr.make(Arr.replicate(0, width), Arr.append(Arr.replicate(0, N.decrement(width)), 1), belowModulus),
            (bytes) =>
              Effect.gen(function*() {
                const admitted = yield* Schema.decode(Schema.Uint8Array)(bytes)
                expect(yield* rsaSha256Verify(admitted, message, key), group.name).toBe(false)
              })
          )
          const limit = yield* Arr.findFirst(group.cases, (test) => Str.Equivalence(test.name, "8192 bytes"))
          const limitMessage = yield* Encoding.decodeHex(limit.message)
          const limitSignature = yield* Encoding.decodeHex(limit.signature)
          expect(yield* rsaSha256Verify(limitSignature, limitMessage, key), group.name).toBe(true)
          const tooLong = yield* Schema.decode(Schema.Uint8Array)(Arr.append(Arr.fromIterable(limitMessage), 1))
          expect(yield* Effect.flip(rsaSha256Verify(limitSignature, tooLong, key)), group.name).toEqual(
            new InvalidVerificationInput({})
          )
        }))
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("rejects 2047-bit, 4097-bit, and even moduli without conflating width with bit length", () =>
    Effect.gen(function*() {
      const fixture = yield* Schema.decodeUnknown(Schema.typeSchema(RsaWycheproofFixture))(corpus)
      const jwk = Arr.headNonEmpty(fixture.testGroups).keyJwk
      const original = Arr.fromIterable(yield* Encoding.decodeBase64Url(jwk.n))
      const even = yield* Arr.modifyOption(original, N.decrement(Arr.length(original)), N.decrement)
      yield* Effect.forEach(
        Arr.make(Arr.prepend(Arr.replicate(255, 255), 127), Arr.append(Arr.prepend(Arr.replicate(0, 511), 1), 1), even),
        (bytes) =>
          Effect.gen(function*() {
            const n = Encoding.encodeBase64Url(yield* Schema.decode(Schema.Uint8Array)(bytes))
            expect(yield* Effect.flip(rsaPublicKeyFromJwk(Struct.evolve(jwk, { n: () => n })))).toEqual(
              new InvalidRsaPublicKey({})
            )
          })
      )
    }))
})
