/** Finite Linux workerd-process CPU and HTTP wall-latency baseline for the packed package. */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Jwt } from "@scenesystems/sign"
import {
  Array as Arr,
  Console,
  Duration,
  Effect,
  FileSystem,
  Layer,
  Number as N,
  Path,
  Schema,
  String as Str
} from "effect"
import { Base64Url, Hex } from "effect/encoding"
import { FetchHttpClient } from "effect/http"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import { Sample, UnexpectedVerdict } from "./benchmark.js"
import { decodeConformanceFixture, RsaOpenSslFixture } from "./fixture-contract.js"
import { JwtFixture } from "./jwt-fixture-contract.js"
import { Identity, RequestBody, Result } from "./worker/protocol.js"
import { startWorker } from "./worker/runtime.js"

const Measurement = Schema.Struct({
  ...Sample.fields,
  processCpuMillis: Schema.Finite,
  meanProcessCpuMillis: Schema.Finite,
  p50WallMillis: Schema.Finite,
  p95WallMillis: Schema.Finite,
  requestsPerSecond: Schema.Finite
})
const Report = Schema.fromJsonString(
  Schema.Struct({
    runtime: Schema.String,
    driver: Schema.String,
    effect: Schema.String,
    host: Schema.String,
    clockTicksPerSecond: Schema.Finite,
    method: Schema.String,
    results: Schema.Array(Measurement)
  }),
  { space: 2 }
)

const program = Effect.gen(function*() {
  const worker = yield* startWorker
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const runtime = Str.trim(yield* spawner.string(ChildProcess.make(worker.binary, ["--version"])))
  const driver = Str.concat("Bun ", Str.trim(yield* spawner.string(ChildProcess.make("bun", ["--version"]))))
  const host = Str.trim(yield* spawner.string(ChildProcess.make("uname", ["-sm"])))
  const ticksPerSecond = yield* spawner.string(ChildProcess.make("getconf", ["CLK_TCK"])).pipe(
    Effect.map(Str.trim),
    Effect.flatMap(Schema.decodeEffect(Schema.FiniteFromString.check(Schema.isGreaterThan(0))))
  )
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const root = path.resolve(import.meta.dirname, "../")
  const { version } = yield* fs.readFileString(path.join(root, "node_modules/effect/package.json")).pipe(
    Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Schema.Struct({ version: Schema.String }))))
  )
  const measure = (name: string, body: typeof RequestBody.Type, expected: typeof Result.Type) =>
    Effect.gen(function*() {
      const operation = worker.request(body).pipe(Effect.filterOrFail(
        (actual) => Schema.toEquivalence(Result)(actual, expected),
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
      const cpu = N.divideUnsafe(N.multiply(N.subtract(after, before), 1000), ticksPerSecond)
      const ordered = Arr.sort(samples, N.Order)
      return yield* Schema.decodeEffect(Measurement)({
        name,
        warmups: 50,
        samples: Arr.length(samples),
        processCpuMillis: cpu,
        meanProcessCpuMillis: N.divideUnsafe(cpu, Arr.length(samples)),
        // Nearest-rank p50 and p95 of exactly 500 observations.
        p50WallMillis: yield* Effect.fromOption(Arr.get(ordered, 249)),
        p95WallMillis: yield* Effect.fromOption(Arr.get(ordered, 474)),
        requestsPerSecond: N.divideUnsafe(Arr.length(samples), Duration.toSeconds(batch))
      })
    })
  const jwt = yield* decodeConformanceFixture("jwt-access-openssl.json", Schema.fromJsonString(JwtFixture))
  const token = Arr.headNonEmpty(jwt.cases).token
  const [header, payload, signature] = yield* Schema.decodeUnknownEffect(
    Schema.Tuple([Schema.String, Schema.String, Schema.String])
  )(
    Str.split(token, ".")
  )
  const signatureBytes = yield* Effect.fromResult(Base64Url.decode(signature))
  const changed = new Uint8Array(
    yield* Effect.fromOption(Arr.modify(
      signatureBytes,
      N.decrement(signatureBytes.byteLength),
      (byte) => N.remainder(N.increment(byte), 256)
    ))
  )
  const ordinaryMessage = Hex.encode(Arr.join(Arr.make(header, payload), "."))
  const rsa = yield* decodeConformanceFixture("rsa-openssl.json", RsaOpenSslFixture)
  const largest = yield* Effect.fromOption(Arr.findFirst(rsa.groups, (group) => N.Equivalence(group.bits, 4096)))
  const maximum = yield* Effect.fromOption(
    Arr.findFirst(largest.cases, (vector) => Str.Equivalence(vector.name, "8192 bytes"))
  )
  const decodeRequest = Schema.decodeEffect(RequestBody)
  const ping = yield* decodeRequest({ _tag: "Ping" })
  const ordinaryGenuine = yield* decodeRequest({
    _tag: "Rsa",
    jwk: jwt.jwk,
    message: ordinaryMessage,
    signature: Hex.encode(signatureBytes)
  })
  const ordinaryNonmatch = yield* decodeRequest({
    _tag: "Rsa",
    jwk: jwt.jwk,
    message: ordinaryMessage,
    signature: Hex.encode(changed)
  })
  const maximumGenuine = yield* decodeRequest({
    _tag: "Rsa",
    jwk: largest.jwk,
    message: maximum.message,
    signature: maximum.signature
  })
  const maximumNonmatch = yield* decodeRequest({
    _tag: "Rsa",
    jwk: largest.jwk,
    message: maximum.message,
    signature: maximum.alteredSignature
  })
  const jwtGenuine = yield* decodeRequest({
    _tag: "Jwt",
    jwks: { keys: Arr.of(jwt.jwk) },
    nowMillis: 150_000,
    token
  })
  const jwtNonmatch = yield* decodeRequest({
    _tag: "Jwt",
    jwks: { keys: Arr.of(jwt.jwk) },
    nowMillis: 150_000,
    token: Arr.join(Arr.make(header, payload, Base64Url.encode(changed)), ".")
  })
  const results = yield* Effect.all(
    Arr.make(
      measure("HTTP harness baseline", ping, true),
      measure("RSA 2048/e=65537 genuine", ordinaryGenuine, true),
      measure("RSA 2048/e=65537 nonmatch", ordinaryNonmatch, false),
      measure("RSA 4096/e=4294967295/8192 bytes genuine", maximumGenuine, true),
      measure("RSA 4096/e=4294967295/8192 bytes nonmatch", maximumNonmatch, false),
      measure(
        "JWT 2048/e=65537 genuine",
        jwtGenuine,
        Identity.make({
          sub: "user-7",
          email: "reader@example.test"
        })
      ),
      measure("JWT 2048/e=65537 nonmatch", jwtNonmatch, new Jwt.Rejected({ reason: "Signature" }))
    ),
    { concurrency: 1 }
  )
  yield* Console.log(
    yield* Schema.encodeEffect(Report)({
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
}).pipe(Effect.scoped, Effect.provide(Layer.merge(BunServices.layer, FetchHttpClient.layer)))

BunRuntime.runMain(program)
