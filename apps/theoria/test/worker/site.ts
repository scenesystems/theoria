import { BunServices } from "@effect/platform-bun"
import {
  BigDecimal,
  Config,
  Context,
  Data,
  DateTime,
  Effect,
  Inspectable,
  Layer,
  Match,
  Option,
  Predicate,
  Queue,
  Ref,
  Schema,
  Struct
} from "effect"
import * as Arr from "effect/Array"
import * as FileSystem from "effect/FileSystem"
import { FetchHttpClient, Headers, HttpClient, HttpClientRequest, HttpMethod, Url } from "effect/http"
import * as Num from "effect/Number"
import * as Path from "effect/Path"
import * as Record from "effect/Record"
import * as Str from "effect/String"
import { convertV4MiniflareOptions, Miniflare, NoOpLog, type V4ModuleDefinition } from "miniflare"
import { unstable_getMiniflareWorkerOptions } from "wrangler"

import { type DocsManifest, DocsManifestJson } from "@theoria/docs-model"

/**
 * The site under test. `SiteLive` is the deployable Worker bundle running
 * inside workerd (Cloudflare's runtime) with the real `wrangler.jsonc`, the
 * real `dist/` assets, and the real `_headers` file; `SiteRemote` is a
 * deployment named by `THEORIA_SITE_URL`, read over the network. HTTP tests
 * call `fetch`; browser tests point Chromium at `url`. Against the harness,
 * absolute URLs control the hostname the Worker sees.
 *
 * The harness is Miniflare holding workerd directly, configured from
 * `wrangler.jsonc` by Wrangler's own reader. Wrangler's `createTestHarness`
 * (and `wrangler dev`) put a second workerd in front, whose proxy Worker
 * forwards each request over TCP to the runtime for hot reload; under a page
 * load's burst of asset requests that hop fails with "Network connection
 * lost" and answers 500 — an answer a browser cannot retry, so the app never
 * mounts (`site.test.ts`, "answers every shell asset 200 across concurrent
 * page loads"). `miniflare` is pinned to the version `wrangler` bundles so
 * both read one runtime.
 *
 * The harness requires a fresh build: `bun run build:web && bun run deploy:dry-run`.
 */

export const buildSha = "worker-test-sha"
/** Analytics identifiers the harness configures; the Worker must emit them on the production host only. */
export const testMeasurementId = "G-WORKERTEST"
export const testBeaconToken = "0123456789abcdef0123456789abcdef"
export const productionHost = "https://theoria.scenesystems.io"
export const stagingHost = "https://theoria.staging.scenesystems.io"
export const previewHost = "https://theoria-pr-7.staging.scenesystems.io"

const SiteHttpMethod = Schema.declare(HttpMethod.isHttpMethod)

/** Request shape the tests need. */
export class SiteRequest extends Schema.Class<SiteRequest>("test/worker/SiteRequest")({
  method: Schema.optionalKey(SiteHttpMethod),
  headers: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  body: Schema.optionalKey(Schema.String)
}) {}

/** Response shape the tests read: the status, the headers, and the body read once as text or JSON. */
export class SiteResponse extends Data.Class<{
  readonly status: number
  readonly headers: Headers.Headers
  readonly text: Effect.Effect<string, SiteError>
  readonly json: Effect.Effect<unknown, SiteError>
}> {}

/** The site could not answer: the harness failed to listen, a request failed in transit, or a body could not be read. */
export class SiteError extends Data.TaggedError("test/worker/SiteError")<{
  readonly message: string
  readonly cause: unknown
}> {}

const operationalError = (cause: unknown) =>
  new SiteError({
    message: Match.value(cause).pipe(
      Match.when(Predicate.isError, (error) => error.message),
      Match.orElse(Inspectable.toStringUnknown)
    ),
    cause
  })

const SiteLogLines = Schema.Array(Schema.String)
type SiteLogLines = typeof SiteLogLines.Type
const SiteLog = Schema.Struct({
  timestamp: Schema.Finite,
  level: Schema.String,
  message: Schema.String
})
const decodeSiteLog = Schema.decodeUnknownOption(SiteLog)

export class Site extends Context.Service<Site, {
  /** Origin of the site, without a trailing slash. */
  readonly url: string
  readonly fetch: (input: string, init?: SiteRequest) => Effect.Effect<SiteResponse, SiteError>
  readonly manifest: DocsManifest
  /** A content-hashed script the shell loads, as a site path. */
  readonly hashedScript: string
  /**
   * Headers that make a page's requests those of the visitor numbered
   * `visitor`. Cloudflare sets `cf-connecting-ip` on every request at the
   * edge, and the place build's limiter keys its budget by it; the harness
   * has no edge, so it names each visitor's address itself — every page a
   * test opens a visitor of its own, with its own budget, so a suite's
   * builds are never summed into one address. Behind a real edge the header
   * is Cloudflare's to set and a client that sends it is refused (error
   * 1000), so a deployment's visitors are all one address: this machine's.
   */
  readonly visitorHeaders: (visitor: number) => Record.ReadonlyRecord<string, string>
  /**
   * What the Workers runtime has logged since the server started, oldest
   * first, each line stamped and levelled — the Worker's own logs and the
   * runtime's, which no browser sees: a request the asset layer failed, an
   * exception in the Worker. For a failure report; nothing is cleared. A
   * deployment's logs are not readable from outside it, so they are empty.
   */
  readonly logs: Effect.Effect<SiteLogLines>
}>()("test/worker/Site") {}

export const text = (response: SiteResponse) => response.text
export const json = (response: SiteResponse) => response.json
/** One response header, as the site sent it. */
export const header = (response: SiteResponse, name: string) => Headers.get(response.headers, name)

type SiteService = typeof Site.Service

/** A response whose body has been read: `json` parses that one text. */
const respond = (status: number, headers: Headers.Headers, body: string) =>
  new SiteResponse({
    status,
    headers,
    text: Effect.succeed(body),
    json: Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(body).pipe(
      Effect.mapError(operationalError)
    )
  })

/** Visitor addresses are drawn from TEST-NET-3 (203.0.113.0/24) and the documentation nets above it. */
const visitorAddress = (visitor: number): string =>
  Arr.join(
    Arr.make(
      "203",
      "0",
      Schema.encodeSync(Schema.FiniteFromString)(
        Num.sum(
          113,
          BigDecimal.toNumberUnsafe(
            BigDecimal.floor(
              BigDecimal.divideUnsafe(BigDecimal.fromNumberUnsafe(visitor), BigDecimal.fromNumberUnsafe(256))
            )
          )
        )
      ),
      Schema.encodeSync(Schema.FiniteFromString)(Num.remainder(visitor, 256))
    ),
    "."
  )

/** A `<script type="module" src="/assets/…js">` in the shell: the first content-hashed script the shell loads. */
const shellScript = /<script type="module"[^>]* src="(\/assets\/[^"]+\.js)"/

/**
 * What every site describes about itself: the docs manifest and a hashed
 * script, both read from what it serves, so the harness and a deployment
 * answer the same way.
 */
const describeSite = (serve: SiteService["fetch"]) =>
  Effect.gen(function*() {
    const manifest = yield* serve("/docs-data/manifest.json").pipe(
      Effect.flatMap(text),
      Effect.flatMap(Schema.decodeEffect(DocsManifestJson)),
      Effect.mapError(operationalError)
    )
    const shell = yield* serve("/").pipe(Effect.flatMap(text))
    const hashedScript = yield* Str.match(shellScript)(shell).pipe(
      Option.flatMap((found) => Arr.get(found, 1)),
      Effect.fromOption(() => new SiteError({ message: "The shell names no hashed script.", cause: shell }))
    )
    return { manifest, hashedScript }
  })

const missingBuild = (file: string) =>
  Effect.die(
    Arr.join(
      Arr.make(
        file,
        " is missing. The Worker tests run the deployable bundle; build it first with ",
        "`bun run build:web && bun run deploy:dry-run` in apps/theoria."
      ),
      Str.empty
    )
  )

const requireFile = (file: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const exists = yield* fileSystem.exists(file).pipe(Effect.mapError(operationalError))
    return yield* (exists ? Effect.void : missingBuild(file))
  })

/** The entry module `wrangler deploy --dry-run --outdir` writes; every other module is named relative to it. */
const workerEntry = "worker.js"

/**
 * How workerd is to load one file of the deploy bundle, by the same
 * extension rules Wrangler applies when bundling: the entry is the script,
 * `.wasm` is compiled WebAssembly, `.bin` is bytes, `.txt` and `.html` are
 * text; the source map and README are not modules.
 */
const bundleModule = (path: Path.Path, workerDir: string) => (file: string): Option.Option<V4ModuleDefinition> =>
  Match.value(file).pipe(
    Match.when(workerEntry, () => "entry"),
    Match.orElse(path.extname),
    Match.value,
    Match.withReturnType<Option.Option<V4ModuleDefinition["type"]>>(),
    Match.when("entry", () => Option.some("ESModule")),
    Match.when(".wasm", () => Option.some("CompiledWasm")),
    Match.when(".bin", () => Option.some("Data")),
    Match.whenOr(".txt", ".html", () => Option.some("Text")),
    Match.orElse(() => Option.none()),
    Option.map((type) => ({ type, path: path.join(workerDir, file) }))
  )

/** The deploy bundle's modules, the entry first, as Miniflare loads them. */
const bundleModules = (workerDir: string) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const fileSystem = yield* FileSystem.FileSystem
    const files = yield* fileSystem.readDirectory(workerDir).pipe(Effect.mapError(operationalError))
    const sorted = Arr.sort(files, Str.Order)
    const entry = Arr.filter(sorted, (file) => Str.Equivalence(file, workerEntry))
    const others = Arr.filter(sorted, (file) => !Str.Equivalence(file, workerEntry))
    return Arr.flatMap(Arr.appendAll(entry, others), (file: string) =>
      Option.toArray(bundleModule(path, workerDir)(file)))
  })

/**
 * The harness for the whole layer. Nothing in a test can respond to workerd
 * failing to shut down, so that failure surfaces as a defect in the scope's exit.
 */
export const SiteLive: Layer.Layer<Site, SiteError> = Layer.effect(
  Site,
  Effect.gen(function*() {
    const path = yield* Path.Path
    const projectRoot = yield* Effect.fromResult(Url.fromString("../../", import.meta.url)).pipe(
      Effect.flatMap((url) => path.fromFileUrl(url)),
      Effect.orDie
    )
    const distRoot = path.join(projectRoot, "dist")
    const workerDir = path.join(projectRoot, ".wrangler-out")

    yield* requireFile(path.join(distRoot, "index.html"))
    yield* requireFile(path.join(distRoot, "docs-data", "manifest.json"))
    yield* requireFile(path.join(workerDir, workerEntry))
    const modules = yield* bundleModules(workerDir)

    // Wrangler reads the configuration as `wrangler deploy` does — assets,
    // bindings, compatibility — and names the module rules it would bundle
    // by; the bundle is already built, so those rules are left aside.
    const { externalWorkers, workerOptions } = yield* Effect.try({
      try: () => unstable_getMiniflareWorkerOptions(path.join(projectRoot, "wrangler.jsonc")),
      catch: operationalError
    })

    // The runtime's structured logs — the Worker's own and workerd's —
    // arrive on a callback; the queue receives them, and `logs` folds
    // what has arrived into the record so far, so nothing is cleared.
    const arriving = yield* Queue.unbounded<typeof SiteLog.Type>()
    const recorded = yield* Ref.make(Arr.empty<string>())
    const runtime = yield* Effect.acquireRelease(
      Effect.try({
        try: () =>
          new Miniflare(convertV4MiniflareOptions({
            log: new NoOpLog(),
            logRequests: false,
            handleStructuredLogs: (log) => {
              Option.map(decodeSiteLog(log), (decoded) => Queue.offerUnsafe(arriving, decoded))
            },
            workers: Arr.prepend(externalWorkers, {
              ...Struct.omit(workerOptions, ["modulesRules"]),
              modulesRoot: workerDir,
              modules,
              bindings: {
                ...Option.getOrElse(Option.fromNullishOr(workerOptions.bindings), Record.empty),
                BUILD_SHA: buildSha,
                GA_MEASUREMENT_ID: testMeasurementId,
                CF_WEB_ANALYTICS_TOKEN: testBeaconToken
              }
            })
          })),
        catch: operationalError
      }),
      (running) =>
        Effect.tryPromise({
          try: () => running.dispose(),
          catch: operationalError
        }).pipe(Effect.orDie)
    )
    const listening = yield* Effect.tryPromise({
      try: () => runtime.ready,
      catch: operationalError
    })

    // Miniflare dispatches to the runtime whatever host the URL names, and
    // the Worker sees that host — so absolute URLs still choose the hostname.
    const fetch: SiteService["fetch"] = (input, init) =>
      Effect.fromResult(Url.fromString(input, listening)).pipe(
        Effect.mapError(operationalError),
        Effect.flatMap((target) =>
          Effect.tryPromise({
            try: () => runtime.dispatchFetch(target, init),
            catch: operationalError
          })
        ),
        Effect.flatMap((response) =>
          Effect.map(
            Effect.tryPromise({
              try: () => response.text(),
              catch: operationalError
            }),
            (body) => respond(response.status, Headers.fromInput(response.headers), body)
          )
        )
      )
    const { hashedScript, manifest } = yield* describeSite(fetch)

    return Site.of({
      url: listening.origin,
      fetch,
      manifest,
      hashedScript,
      visitorHeaders: (visitor) => Record.singleton("cf-connecting-ip", visitorAddress(visitor)),
      logs: Effect.gen(function*() {
        const fresh = yield* Queue.clear(arriving)
        const lines = Arr.map(
          fresh,
          (log) =>
            Arr.join(
              Arr.make(DateTime.formatIso(DateTime.makeUnsafe(log.timestamp)), " ", log.level, ": ", log.message),
              Str.empty
            )
        )
        return yield* Ref.updateAndGet(recorded, Arr.appendAll(lines))
      })
    })
  })
).pipe(Layer.provide(BunServices.layer))

/** The deployment `THEORIA_SITE_URL` names, reached through the platform `HttpClient`. */
export const SiteRemote: Layer.Layer<Site, SiteError | Config.ConfigError> = Layer.effect(
  Site,
  Effect.gen(function*() {
    const origin = yield* Config.URL("THEORIA_SITE_URL")
    const client = yield* HttpClient.HttpClient

    const fetch: SiteService["fetch"] = (input, init = new SiteRequest({})) =>
      Effect.gen(function*() {
        const target = yield* Effect.fromResult(Url.fromString(input, origin))
        const request = HttpClientRequest.make(
          Option.getOrElse(Option.fromNullishOr(init.method), () => "GET")
        )(target, { headers: init.headers })
        const response = yield* client.execute(
          Option.match(Option.fromNullishOr(init.body), {
            onNone: () => request,
            onSome: (body) => HttpClientRequest.bodyText(request, body)
          })
        )
        const body = yield* response.text
        return respond(response.status, response.headers, body)
      }).pipe(Effect.mapError(operationalError))
    const { hashedScript, manifest } = yield* describeSite(fetch)

    return Site.of({
      url: origin.origin,
      fetch,
      manifest,
      hashedScript,
      visitorHeaders: Record.empty,
      logs: Effect.succeed(Arr.empty<string>())
    })
  })
).pipe(Layer.provide(FetchHttpClient.layer))

/**
 * The site a profile runs against: the deployment `THEORIA_SITE_URL` names
 * when it is set (`bun run test:worker:staging`), else the harness.
 */
export const SiteUnderTest: Layer.Layer<Site, SiteError | Config.ConfigError> = Layer.unwrap(
  Effect.map(
    Config.option(Config.URL("THEORIA_SITE_URL")),
    Option.match({
      onNone: (): Layer.Layer<Site, SiteError | Config.ConfigError> => SiteLive,
      onSome: () => SiteRemote
    })
  )
)
