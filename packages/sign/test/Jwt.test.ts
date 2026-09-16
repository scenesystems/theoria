import { describe, expect, it } from "@effect/vitest"
import { Jwt } from "@scenesystems/sign"
import {
  Array as Arr,
  Deferred,
  Effect,
  Encoding,
  Exit,
  Fiber,
  Match,
  Number as N,
  Redacted,
  Ref,
  Schema,
  String as Str,
  Struct,
  TestClock
} from "effect"
import { JwtFixture } from "../scripts/jwt-fixture-contract.js"
import accessCorpus from "./fixtures/conformance/jwt-access-openssl.json" with { type: "json" }
import corpus from "./fixtures/conformance/jwt-openssl.json" with { type: "json" }

const Identity = Schema.Struct({ sub: Schema.NonEmptyString, email: Schema.Literal("reader@example.test") })
const policy = new Jwt.Policy({ issuer: "https://team.example", audience: "app", maxLifetimeSeconds: 3600 })
const accessPolicy = new Jwt.Policy({ issuer: "https://team.example", audience: "app", maxLifetimeSeconds: 86_400 })

class ApplicationPolicyDefect extends Schema.TaggedError<ApplicationPolicyDefect>()("ApplicationPolicyDefect", {}) {}

describe("Jwt RS256 protocol", () => {
  it.effect("enforces the Access identity, issuer, audience, time, and 24-hour lifetime profile", () =>
    Effect.gen(function*() {
      yield* TestClock.setTime(150_000)
      const fixture = yield* Schema.decodeUnknown(JwtFixture)(accessCorpus)
      yield* Effect.forEach(fixture.cases, (vector) =>
        Effect.gen(function*() {
          const result = yield* Jwt.verifyRs256(
            Redacted.make(vector.token),
            { keys: Arr.of(fixture.jwk) },
            accessPolicy,
            Identity
          ).pipe(Effect.either)
          yield* Match.value(vector.expected).pipe(
            Match.when("valid", () =>
              Effect.gen(function*() {
                expect(yield* result, vector.name).toEqual({ sub: "user-7", email: "reader@example.test" })
              })),
            Match.whenOr("Claims", "MalformedToken", (reason) =>
              Effect.gen(function*() {
                expect(yield* Effect.flip(result), vector.name).toEqual(new Jwt.Rejected({ reason }))
              })),
            Match.exhaustive
          )
        }))
    }))

  it.effect("rejects Access tokens unless one verification-use key matches", () =>
    Effect.gen(function*() {
      yield* TestClock.setTime(150_000)
      const fixture = yield* Schema.decodeUnknown(JwtFixture)(accessCorpus)
      const token = Redacted.make(Arr.headNonEmpty(fixture.cases).token)
      yield* Effect.forEach(
        Arr.make(
          Arr.empty<typeof fixture.jwk>(),
          Arr.of(Struct.evolve(fixture.jwk, { kid: () => "different" })),
          Arr.make(fixture.jwk, fixture.jwk)
        ),
        (keys) =>
          Effect.gen(function*() {
            expect(yield* Effect.flip(Jwt.verifyRs256(token, { keys }, accessPolicy, Identity))).toEqual(
              new Jwt.Rejected({ reason: "KeySelection" })
            )
          })
      )
      expect(
        yield* Effect.flip(
          Jwt.verifyRs256(token, { keys: Arr.of({ ...fixture.jwk, use: "enc" }) }, accessPolicy, Identity)
        )
      ).toEqual(new Jwt.Rejected({ reason: "InvalidKey" }))
    }))

  it.effect("authenticates independent signatures and enforces claims before downstream access", () =>
    Effect.gen(function*() {
      yield* TestClock.setTime(150_000)
      const fixture = yield* Schema.decodeUnknown(JwtFixture)(corpus)
      yield* Effect.forEach(fixture.cases, (vector) =>
        Effect.gen(function*() {
          const accessed = yield* Ref.make(false)
          const result = yield* Jwt.verifyRs256(
            Redacted.make(vector.token),
            { keys: Arr.of(fixture.jwk) },
            policy,
            Identity
          ).pipe(
            Effect.tap(() => Ref.set(accessed, true)),
            Effect.either
          )
          yield* Match.value(vector.expected).pipe(
            Match.when("valid", () =>
              Effect.gen(function*() {
                expect(yield* result, vector.name).toEqual({ sub: "user-7", email: "reader@example.test" })
                expect(yield* Ref.get(accessed), vector.name).toBe(true)
              })),
            Match.whenOr("Claims", "MalformedToken", (reason) =>
              Effect.gen(function*() {
                expect(yield* Effect.flip(result), vector.name).toEqual(new Jwt.Rejected({ reason }))
                expect(yield* Ref.get(accessed), vector.name).toBe(false)
              })),
            Match.exhaustive
          )
        }))
    }))

  it.effect("requires unique trusted key selection, even for identical duplicates", () =>
    Effect.gen(function*() {
      yield* TestClock.setTime(150_000)
      const fixture = yield* Schema.decodeUnknown(JwtFixture)(corpus)
      const token = Redacted.make(Arr.headNonEmpty(fixture.cases).token)
      yield* Effect.forEach(
        Arr.make(
          Arr.empty<typeof fixture.jwk>(),
          Arr.of(Struct.evolve(fixture.jwk, { kid: () => "different" })),
          Arr.make(fixture.jwk, fixture.jwk),
          Arr.make(fixture.jwk, Struct.evolve(fixture.jwk, { n: () => "bad" }))
        ),
        (keys) =>
          Effect.gen(function*() {
            expect(yield* Effect.flip(Jwt.verifyRs256(token, { keys }, policy, Identity))).toEqual(
              new Jwt.Rejected({ reason: "KeySelection" })
            )
          })
      )
      expect(
        yield* Jwt.verifyRs256(
          token,
          { keys: Arr.make(Struct.evolve(fixture.jwk, { kid: () => "other" }), fixture.jwk) },
          policy,
          Identity
        )
      ).toEqual({ sub: "user-7", email: "reader@example.test" })
    }))

  it.effect("classifies unreadable JWKS and candidate key identifiers as key-selection failures", () =>
    Effect.gen(function*() {
      yield* TestClock.setTime(150_000)
      const fixture = yield* Schema.decodeUnknown(JwtFixture)(corpus)
      const token = Redacted.make(Arr.headNonEmpty(fixture.cases).token)
      const unreadableJwks = {
        get keys() {
          return Schema.decodeUnknownSync(Schema.Never)(Arr.of(fixture.jwk))
        }
      }
      const unreadableKid = {
        ...fixture.jwk,
        get kid() {
          return Schema.decodeUnknownSync(Schema.Never)(fixture.jwk.kid)
        }
      }

      yield* Effect.forEach(
        Arr.make(unreadableJwks, { keys: Arr.of(unreadableKid) }),
        (jwks) =>
          Effect.gen(function*() {
            expect(yield* Effect.flip(Jwt.verifyRs256(token, jwks, policy, Identity))).toEqual(
              new Jwt.Rejected({ reason: "KeySelection" })
            )
          })
      )
    }))

  it.effect("uses inclusive issuance/not-before and exclusive expiry boundaries on every execution", () =>
    Effect.gen(function*() {
      const fixture = yield* Schema.decodeUnknown(JwtFixture)(corpus)
      const verify = Jwt.verifyRs256(
        Redacted.make(Arr.headNonEmpty(fixture.cases).token),
        { keys: Arr.of(fixture.jwk) },
        policy,
        Identity
      )
      yield* TestClock.setTime(99_999)
      expect(yield* Effect.flip(verify)).toEqual(new Jwt.Rejected({ reason: "Claims" }))
      yield* TestClock.setTime(100_000)
      expect((yield* verify).sub).toBe("user-7")
      yield* TestClock.setTime(199_999)
      expect((yield* verify).sub).toBe("user-7")
      yield* TestClock.setTime(200_000)
      expect(yield* Effect.flip(verify)).toEqual(new Jwt.Rejected({ reason: "Claims" }))
      yield* TestClock.setTime(150_000)
      expect(
        yield* Effect.flip(Jwt.verifyRs256(
          Redacted.make(Arr.headNonEmpty(fixture.cases).token),
          { keys: Arr.of(fixture.jwk) },
          new Jwt.Policy(Struct.evolve(policy, { maxLifetimeSeconds: () => 99 })),
          Identity
        ))
      ).toEqual(new Jwt.Rejected({ reason: "Claims" }))
    }))

  it.effect("does not execute application policy for a tampered token", () =>
    Effect.gen(function*() {
      yield* TestClock.setTime(150_000)
      const fixture = yield* Schema.decodeUnknown(JwtFixture)(corpus)
      const [header, payload, signature] = yield* Schema.decodeUnknown(
        Schema.Tuple(Schema.String, Schema.String, Schema.String)
      )(
        Str.split(Arr.headNonEmpty(fixture.cases).token, ".")
      )
      const called = yield* Ref.make(0)
      const application = Identity.pipe(
        Schema.filterEffect(() => Ref.update(called, N.increment).pipe(Effect.as(true)))
      )
      const signatureBytes = yield* Encoding.decodeBase64Url(signature)
      const tampered = yield* Schema.decode(Schema.Uint8Array)(
        Arr.modify(Arr.fromIterable(signatureBytes), 32, (byte) => N.remainder(N.increment(byte), 256))
      )
      const token = Redacted.make(Arr.join(Arr.make(header, payload, Encoding.encodeBase64Url(tampered)), "."))
      expect(yield* Effect.flip(Jwt.verifyRs256(token, { keys: Arr.of(fixture.jwk) }, policy, application))).toEqual(
        new Jwt.Rejected({ reason: "Signature" })
      )
      expect(yield* Ref.get(called)).toBe(0)
    }))

  it.effect("interrupts an application's effectful claim policy and runs its finalizer", () =>
    Effect.gen(function*() {
      yield* TestClock.setTime(150_000)
      const fixture = yield* Schema.decodeUnknown(JwtFixture)(corpus)
      const entered = yield* Deferred.make<void>()
      const finalized = yield* Ref.make(false)
      const application = Identity.pipe(Schema.filterEffect(() =>
        Deferred.succeed(entered, undefined).pipe(
          Effect.zipRight(Effect.never),
          Effect.ensuring(Ref.set(finalized, true))
        )
      ))
      const fiber = yield* Jwt.verifyRs256(
        Redacted.make(Arr.headNonEmpty(fixture.cases).token),
        { keys: Arr.of(fixture.jwk) },
        policy,
        application
      ).pipe(Effect.fork)
      yield* Deferred.await(entered)
      yield* Fiber.interrupt(fiber)
      expect(yield* Ref.get(finalized)).toBe(true)
    }))

  it.effect("preserves defects from an application's effectful claim policy", () =>
    Effect.gen(function*() {
      yield* TestClock.setTime(150_000)
      const fixture = yield* Schema.decodeUnknown(JwtFixture)(corpus)
      const defect = new ApplicationPolicyDefect({})
      const application = Identity.pipe(Schema.filterEffect(() => Effect.die(defect)))
      const exit = yield* Jwt.verifyRs256(
        Redacted.make(Arr.headNonEmpty(fixture.cases).token),
        { keys: Arr.of(fixture.jwk) },
        policy,
        application
      ).pipe(Effect.exit)

      expect(exit).toEqual(Exit.die(defect))
    }))
})
