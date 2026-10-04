/** A finite, sequential Bun baseline. Run separately from builds and tests. */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Bytes, Jwt, Rsa } from "@scenesystems/sign"
import {
  Array as Arr,
  Boolean as B,
  Clock,
  Console,
  Duration,
  Effect,
  Number as N,
  Redacted,
  Schema,
  String as Str
} from "effect"
import { Base64Url, Hex } from "effect/encoding"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { TestClock } from "effect/testing"
import { Sample, UnexpectedVerdict } from "./benchmark.js"
import { decodeConformanceFixture, RsaOpenSslFixture } from "./fixture-contract.js"
import { JwtFixture } from "./jwt-fixture-contract.js"
import { Identity } from "./worker/protocol.js"

const Positive = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThan(0))
const Result = Schema.Struct({
  ...Sample.fields,
  p50Millis: Positive,
  p95Millis: Positive,
  operationsPerSecond: Positive
})
const Report = Schema.fromJsonString(
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
    const [batch, samples] = yield* Effect.replicateEffect(
      Effect.timed(operation).pipe(
        Effect.flatMap(([duration, actual]) =>
          Effect.succeed(Duration.toMillis(duration)).pipe(Effect.filterOrFail(
            () => B.Equivalence(actual, expected),
            () => new UnexpectedVerdict({ name })
          ))
        )
      ),
      1000,
      { concurrency: 1 }
    ).pipe(Effect.timed)
    const ordered = Arr.sort(samples, N.Order)
    // Exactly 1000 observations: nearest-rank p50/p95 are entries 500 and 950.
    return yield* Schema.decodeEffect(Result)({
      name,
      warmups: 100,
      samples: Arr.length(samples),
      p50Millis: yield* Effect.fromOption(Arr.get(ordered, 499)),
      p95Millis: yield* Effect.fromOption(Arr.get(ordered, 949)),
      operationsPerSecond: N.divideUnsafe(Arr.length(samples), Duration.toSeconds(batch))
    })
  })

const program = Effect.gen(function*() {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const runtime = Str.concat(
    "Bun ",
    Str.trim(yield* spawner.string(ChildProcess.make("bun", ["--version"])))
  )
  const testClock = yield* TestClock.make()
  yield* testClock.setTime(150_000)
  const jwt = yield* decodeConformanceFixture("jwt-openssl.json", Schema.fromJsonString(JwtFixture))
  const token = Arr.headNonEmpty(jwt.cases).token
  const [header, payload, signatureText] = yield* Schema.decodeUnknownEffect(Schema.Tuple([
    Schema.String,
    Schema.String,
    Schema.String
  ]))(Str.split(token, "."))
  const message = yield* Bytes.fromString(Arr.join(Arr.make(header, payload), "."))
  const signature = yield* Effect.fromResult(Base64Url.decode(signatureText))
  const changed = new Uint8Array(
    yield* Effect.fromOption(Arr.modify(
      signature,
      N.decrement(signature.byteLength),
      (byte) => N.remainder(N.increment(byte), 256)
    ))
  )
  const ordinary = yield* Rsa.publicKeyFromJwk(jwt.jwk)
  const rsa = yield* decodeConformanceFixture("rsa-openssl.json", RsaOpenSslFixture)
  const largest = yield* Effect.fromOption(Arr.findFirst(rsa.groups, (group) => N.Equivalence(group.bits, 4096)))
  const maximum = yield* Effect.fromOption(
    Arr.findFirst(largest.cases, (vector) => Str.Equivalence(vector.name, "8192 bytes"))
  )
  const maximumKey = yield* Rsa.publicKeyFromJwk(largest.jwk)
  const maximumMessage = yield* Effect.fromResult(Hex.decode(maximum.message))
  const maximumSignature = yield* Effect.fromResult(Hex.decode(maximum.signature))
  const maximumNonmatch = yield* Effect.fromResult(Hex.decode(maximum.alteredSignature))
  const policy = new Jwt.Policy({ issuer: "https://team.example", audience: "app", maxLifetimeSeconds: 3600 })
  const identity = Schema.Struct({ ...Identity.fields, sub: Schema.Literal("user-7") })
  const verifyJwt = (input: string) =>
    Jwt.verifyRs256(Redacted.make(input), { keys: Arr.of(jwt.jwk) }, policy, identity).pipe(
      Effect.as(true),
      Effect.catchTag(
        "JwtRejected",
        (error) => Schema.decodeUnknownEffect(Schema.Literal("Signature"))(error.reason).pipe(Effect.as(false))
      ),
      Effect.provideService(Clock.Clock, testClock)
    )
  const results = yield* Effect.all(
    Arr.make(
      measure("RSA 2048/e=65537 genuine", Rsa.verify(signature, message, ordinary), true),
      measure("RSA 2048/e=65537 nonmatch", Rsa.verify(changed, message, ordinary), false),
      measure(
        "RSA 4096/e=4294967295/8192 bytes genuine",
        Rsa.verify(maximumSignature, maximumMessage, maximumKey),
        true
      ),
      measure(
        "RSA 4096/e=4294967295/8192 bytes nonmatch",
        Rsa.verify(maximumNonmatch, maximumMessage, maximumKey),
        false
      ),
      measure("JWT 2048/e=65537 genuine", verifyJwt(token), true),
      measure(
        "JWT 2048/e=65537 nonmatch",
        verifyJwt(Arr.join(Arr.make(header, payload, Base64Url.encode(changed)), ".")),
        false
      )
    ),
    { concurrency: 1 }
  )
  yield* Console.log(
    yield* Schema.encodeEffect(Report)({
      runtime,
      timing:
        "Live monotonic clock; fixed JWT wall time; 100 warmups then 1000 sequential samples per case. Throughput includes timing and verdict checks. RSA excludes JWK import; JWT includes it. Bun only, not Workers.",
      results
    })
  )
}).pipe(Effect.scoped, Effect.provide(BunServices.layer))

BunRuntime.runMain(program)
