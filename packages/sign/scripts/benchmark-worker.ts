/** Finite Linux workerd-process CPU and HTTP wall-latency baseline for the packed package. */
import { Command, FetchHttpClient, FileSystem, Path, Url } from "@effect/platform"
import * as BunContext from "@effect/platform-bun/BunContext"
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import { Jwt } from "@scenesystems/sign"
import { Array as Arr, Console, Duration, Effect, Encoding, Layer, Number as N, Schema, String as Str } from "effect"

import { decodeConformanceFixture, RsaOpenSslFixture } from "./fixture-contract.js"
import { JwtFixture } from "./jwt-fixture-contract.js"
import type { Request } from "./worker/protocol.js"
import { Result } from "./worker/protocol.js"
import { startWorker } from "./worker/runtime.js"

class UnexpectedVerdict extends Schema.TaggedError<UnexpectedVerdict>()("UnexpectedVerdict", {
  name: Schema.String
}) {}

const Measurement = Schema.Struct({
  name: Schema.String,
  warmups: Schema.Int,
  samples: Schema.Int,
  processCpuMillis: Schema.Number,
  meanProcessCpuMillis: Schema.Number,
  p50WallMillis: Schema.Number,
  p95WallMillis: Schema.Number,
  requestsPerSecond: Schema.Number
})
const Report = Schema.parseJson(
  Schema.Struct({
    runtime: Schema.String,
    driver: Schema.String,
    effect: Schema.String,
    host: Schema.String,
    clockTicksPerSecond: Schema.Number,
    method: Schema.String,
    results: Schema.Array(Measurement)
  }),
  { space: 2 }
)

const program = Effect.gen(function*() {
  const worker = yield* startWorker
  const runtime = Str.trim(yield* Command.string(Command.make(worker.binary, "--version")))
  const driver = Str.concat("Bun ", Str.trim(yield* Command.string(Command.make("bun", "--version"))))
  const host = Str.trim(yield* Command.string(Command.make("uname", "-sm")))
  const ticksPerSecond = yield* Command.string(Command.make("getconf", "CLK_TCK")).pipe(
    Effect.map(Str.trim),
    Effect.flatMap(Schema.decode(Schema.NumberFromString.pipe(Schema.positive())))
  )
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const root = yield* path.fromFileUrl(yield* Url.fromString("../", import.meta.url))
  const { version } = yield* fs.readFileString(path.join(root, "node_modules/effect/package.json")).pipe(
    Effect.flatMap(Schema.decode(Schema.parseJson(Schema.Struct({ version: Schema.String }))))
  )
  const measure = (name: string, body: typeof Request.Encoded, expected: typeof Result.Type) =>
    Effect.gen(function*() {
      const operation = worker.request(body).pipe(Effect.filterOrFail(
        (actual) => Schema.equivalence(Result)(actual, expected),
        () => new UnexpectedVerdict({ name })
      ))
      yield* Effect.replicateEffect(operation, 50, { concurrency: 1, discard: true })
      const before = yield* worker.cpuTicks
      const [batch, samples] = yield* Effect.replicateEffect(
        Effect.timed(operation).pipe(Effect.map(([duration]) => Duration.toMillis(duration))),
        500,
        { concurrency: 1 }
      ).pipe(Effect.timed)
      const after = yield* worker.cpuTicks
      const cpu = N.unsafeDivide(N.multiply(N.subtract(after, before), 1000), ticksPerSecond)
      const ordered = Arr.sort(samples, N.Order)
      return {
        name,
        warmups: 50,
        samples: Arr.length(samples),
        processCpuMillis: cpu,
        meanProcessCpuMillis: N.unsafeDivide(cpu, Arr.length(samples)),
        // Nearest-rank p50 and p95 of exactly 500 observations.
        p50WallMillis: yield* Arr.get(ordered, 249),
        p95WallMillis: yield* Arr.get(ordered, 474),
        requestsPerSecond: N.unsafeDivide(Arr.length(samples), Duration.toSeconds(batch))
      }
    })
  const jwt = yield* decodeConformanceFixture("jwt-access-openssl.json", Schema.parseJson(JwtFixture))
  const token = Arr.headNonEmpty(jwt.cases).token
  const [header, payload, signature] = yield* Schema.decodeUnknown(
    Schema.Tuple(Schema.String, Schema.String, Schema.String)
  )(
    Str.split(token, ".")
  )
  const signatureBytes = yield* Encoding.decodeBase64Url(signature)
  const changed = yield* Schema.decode(Schema.Uint8Array)(Arr.modify(
    Arr.fromIterable(signatureBytes),
    N.decrement(signatureBytes.length),
    (byte) => N.remainder(N.increment(byte), 256)
  ))
  const ordinary = { jwk: jwt.jwk, message: Encoding.encodeHex(Arr.join(Arr.make(header, payload), ".")) }
  const rsa = yield* decodeConformanceFixture("rsa-openssl.json", RsaOpenSslFixture)
  const largest = yield* Arr.findFirst(rsa.groups, (group) => N.Equivalence(group.bits, 4096))
  const maximum = yield* Arr.findFirst(largest.cases, (vector) => Str.Equivalence(vector.name, "8192 bytes"))
  const worst = { jwk: largest.jwk, message: maximum.message }
  const jwtInput = { jwks: { keys: Arr.of(jwt.jwk) }, nowMillis: 150_000 }
  const results = yield* Effect.all(
    Arr.make(
      measure("HTTP harness baseline", { _tag: "Ping" }, true),
      measure(
        "RSA 2048/e=65537 genuine",
        { ...ordinary, _tag: "Rsa", signature: Encoding.encodeHex(signatureBytes) },
        true
      ),
      measure("RSA 2048/e=65537 nonmatch", { ...ordinary, _tag: "Rsa", signature: Encoding.encodeHex(changed) }, false),
      measure(
        "RSA 4096/e=4294967295/8192 bytes genuine",
        { ...worst, _tag: "Rsa", signature: maximum.signature },
        true
      ),
      measure("RSA 4096/e=4294967295/8192 bytes nonmatch", {
        ...worst,
        _tag: "Rsa",
        signature: maximum.alteredSignature
      }, false),
      measure("JWT 2048/e=65537 genuine", { ...jwtInput, _tag: "Jwt", token }, {
        sub: "user-7",
        email: "reader@example.test"
      }),
      measure("JWT 2048/e=65537 nonmatch", {
        ...jwtInput,
        _tag: "Jwt",
        token: Arr.join(Arr.make(header, payload, Encoding.encodeBase64Url(changed)), ".")
      }, new Jwt.Rejected({ reason: "Signature" }))
    ),
    { concurrency: 1 }
  )
  yield* Console.log(
    yield* Schema.encode(Report)({
      runtime,
      driver,
      effect: version,
      host,
      clockTicksPerSecond: ticksPerSecond,
      method:
        "Dedicated workerd process; no nodejs_compat. 50 warmups then 500 sequential HTTP calls per case. CPU is the delta of Linux /proc/PID/stat utime+stime, including HTTP/GC and all runtime threads, excluding the Bun driver. Wall percentiles use the driver monotonic clock. Both RSA and JWT include JWK import; JWT includes a per-request native TestClock layer. These are local measurements, not production isolate or billed Workers CPU.",
      results
    })
  )
}).pipe(Effect.scoped, Effect.provide(Layer.merge(BunContext.layer, FetchHttpClient.layer)))

BunRuntime.runMain(program)
