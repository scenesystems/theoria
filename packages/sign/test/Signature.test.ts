import { expect, it } from "@effect/vitest"
import { Bytes, Jwt, KeyPair, Rsa, Signature, X25519, XWing } from "@scenesystems/sign"
import { Array as Arr, Effect, HashMap, Option, Schema, Tuple } from "effect"
import { RsaWycheproofFixture } from "../scripts/fixture-contract.js"
import corpus from "./fixtures/conformance/rsa-wycheproof.json" with { type: "json" }

it.effect("looks up byte carriers by shared references, not copied byte contents", () =>
  Effect.gen(function*() {
    const key = yield* Bytes.fromString("public bytes")
    const bytes = yield* Bytes.fromString("payload bytes")
    yield* Effect.forEach(
      Arr.make(
        (value: Uint8Array) => new KeyPair.KeyPair({ algorithm: "ed25519", publicKey: key, secretKey: value }),
        (value: Uint8Array) => new Signature.Signature({ algorithm: "ed25519", publicKey: key, signature: value }),
        (value: Uint8Array) => new X25519.SharedSecret({ algorithm: "x25519", sharedSecret: value }),
        (value: Uint8Array) => new XWing.Encapsulation({ algorithm: "xwing", ciphertext: key, sharedSecret: value })
      ),
      (make) => {
        const cache = HashMap.make(Tuple.make(make(bytes), "retained"))
        expect(HashMap.get(cache, make(bytes))).toEqual(Option.some("retained"))
        expect(HashMap.get(cache, make(new Uint8Array(bytes)))).toEqual(Option.none())
        return Effect.void
      }
    )
  }))

it.effect("looks up RSA keys and JWT policies by their validated values", () =>
  Effect.gen(function*() {
    const fixture = yield* Schema.decodeUnknownEffect(Schema.toType(RsaWycheproofFixture))(corpus)
    const jwk = Arr.headNonEmpty(fixture.testGroups).keyJwk
    const first = yield* Rsa.publicKeyFromJwk(jwk)
    const second = yield* Rsa.publicKeyFromJwk(jwk)
    const keys = HashMap.make(Tuple.make(first, "trusted"))
    expect(HashMap.get(keys, second)).toEqual(Option.some("trusted"))
    const fields = { issuer: "issuer", audience: "audience", maxLifetimeSeconds: 60 }
    const policy = new Jwt.Policy(fields)
    const policies = HashMap.make(Tuple.make(policy, "allowed"))
    expect(HashMap.get(policies, new Jwt.Policy(fields))).toEqual(Option.some("allowed"))
    expect(HashMap.get(policies, new Jwt.Policy({ ...fields, maxLifetimeSeconds: 61 }))).toEqual(Option.none())
  }))
