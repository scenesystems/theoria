/** A finite, sequential Bun baseline. Run separately from builds and tests. */
import { Command } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Jwt, rsaPublicKeyFromJwk, rsaSha256Verify, utf8ToBytes } from "@scenesystems/sign"
import {
  Array as Arr,
  Boolean as B,
  Clock,
  Console,
  Duration,
  Effect,
  Encoding,
  Layer,
  Number as N,
  Redacted,
  Schema,
  String as Str,
  TestClock,
  TestContext,
  TestServices
} from "effect"
import { decodeConformanceFixture, RsaOpenSslFixture } from "./fixture-contract.js"
import { JwtFixture } from "./jwt-fixture-contract.js"

class UnexpectedVerdict extends Schema.TaggedError<UnexpectedVerdict>()("UnexpectedVerdict", {
  name: Schema.String
}) {}

const Positive = Schema.Number.pipe(Schema.finite(), Schema.positive())
const Result = Schema.Struct({
  name: Schema.String,
  warmups: Schema.Int,
  samples: Schema.Int,
  p50Millis: Positive,
  p95Millis: Positive,
  operationsPerSecond: Positive
})
const Report = Schema.parseJson(
  Schema.Struct({
    runtime: Schema.String,
    timing: Schema.String,
    results: Schema.Array(Result)
  }),
  { space: 2 }
)

const measure = <E, R>(name: string, operation: Effect.Effect<boolean, E, R>, expected: boolean) =>
  Effect.gen(function*() {
    const checked = operation.pipe(Effect.filterOrFail(
      (actual) => B.Equivalence(actual, expected),
      () => new UnexpectedVerdict({ name })
    ))
    yield* Effect.replicateEffect(checked, 100, { concurrency: 1, discard: true })
    const clock = TestServices.provideLive(Clock.currentTimeNanos)
    const [batch, samples] = yield* Effect.replicateEffect(
      Effect.timedWith(operation, clock).pipe(
        Effect.flatMap(([duration, actual]) =>
          Effect.succeed(Duration.toMillis(duration)).pipe(Effect.filterOrFail(
            () => B.Equivalence(actual, expected),
            () => new UnexpectedVerdict({ name })
          ))
        )
      ),
      1000,
      { concurrency: 1 }
    ).pipe(Effect.timedWith(clock))
    const ordered = Arr.sort(samples, N.Order)
    // Exactly 1000 observations: nearest-rank p50/p95 are entries 500 and 950.
    return yield* Schema.decode(Result)({
      name,
      warmups: 100,
      samples: Arr.length(samples),
      p50Millis: yield* Arr.get(ordered, 499),
      p95Millis: yield* Arr.get(ordered, 949),
      operationsPerSecond: N.unsafeDivide(Arr.length(samples), Duration.toSeconds(batch))
    })
  })

const program = Effect.gen(function*() {
  const runtime = Str.concat("Bun ", Str.trim(yield* Command.string(Command.make("bun", "--version"))))
  yield* TestClock.setTime(150_000)
  const jwt = yield* decodeConformanceFixture("jwt-openssl.json", Schema.parseJson(JwtFixture))
  const token = Arr.headNonEmpty(jwt.cases).token
  const [header, payload, signatureText] = yield* Schema.decodeUnknown(Schema.Tuple(
    Schema.String,
    Schema.String,
    Schema.String
  ))(Str.split(token, "."))
  const message = utf8ToBytes(Arr.join(Arr.make(header, payload), "."))
  const signature = yield* Encoding.decodeBase64Url(signatureText)
  const changed = yield* Schema.decode(Schema.Uint8Array)(
    Arr.modify(
      Arr.fromIterable(signature),
      N.decrement(signature.length),
      (byte) => N.remainder(N.increment(byte), 256)
    )
  )
  const ordinary = yield* rsaPublicKeyFromJwk(jwt.jwk)
  const rsa = yield* decodeConformanceFixture("rsa-openssl.json", RsaOpenSslFixture)
  const largest = yield* Arr.findFirst(rsa.groups, (group) => N.Equivalence(group.bits, 4096))
  const maximum = yield* Arr.findFirst(largest.cases, (vector) => Str.Equivalence(vector.name, "8192 bytes"))
  const maximumKey = yield* rsaPublicKeyFromJwk(largest.jwk)
  const maximumMessage = yield* Encoding.decodeHex(maximum.message)
  const maximumSignature = yield* Encoding.decodeHex(maximum.signature)
  const maximumNonmatch = yield* Encoding.decodeHex(maximum.alteredSignature)
  const policy = new Jwt.Policy({ issuer: "https://team.example", audience: "app", maxLifetimeSeconds: 3600 })
  const identity = Schema.Struct({ sub: Schema.Literal("user-7"), email: Schema.Literal("reader@example.test") })
  const verifyJwt = (input: string) =>
    Jwt.verifyRs256(Redacted.make(input), { keys: Arr.of(jwt.jwk) }, policy, identity).pipe(
      Effect.as(true),
      Effect.catchTag(
        "JwtRejected",
        (error) => Schema.validate(Schema.Literal("Signature"))(error.reason).pipe(Effect.as(false))
      )
    )
  const results = yield* Effect.all(
    Arr.make(
      measure("RSA 2048/e=65537 genuine", rsaSha256Verify(signature, message, ordinary), true),
      measure("RSA 2048/e=65537 nonmatch", rsaSha256Verify(changed, message, ordinary), false),
      measure(
        "RSA 4096/e=4294967295/8192 bytes genuine",
        rsaSha256Verify(maximumSignature, maximumMessage, maximumKey),
        true
      ),
      measure(
        "RSA 4096/e=4294967295/8192 bytes nonmatch",
        rsaSha256Verify(maximumNonmatch, maximumMessage, maximumKey),
        false
      ),
      measure("JWT 2048/e=65537 genuine", verifyJwt(token), true),
      measure(
        "JWT 2048/e=65537 nonmatch",
        verifyJwt(Arr.join(Arr.make(header, payload, Encoding.encodeBase64Url(changed)), ".")),
        false
      )
    ),
    { concurrency: 1 }
  )
  yield* Console.log(
    yield* Schema.encode(Report)({
      runtime,
      timing:
        "Live monotonic clock; fixed JWT wall time; 100 warmups then 1000 sequential samples per case. Throughput includes timing and verdict checks. RSA excludes JWK import; JWT includes it. Bun only, not Workers.",
      results
    })
  )
}).pipe(Effect.provide(Layer.merge(TestContext.TestContext, BunContext.layer)))

BunRuntime.runMain(program)
