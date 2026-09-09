import {
  FetchHttpClient,
  FileSystem,
  Headers,
  HttpClient,
  HttpClientRequest,
  type HttpMethod,
  Path,
  Url
} from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { Config, type ConfigError, Context, Data, DateTime, Effect, Layer, Option, Predicate, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"
import { createTestHarness } from "wrangler"

import { type DocsManifest, DocsManifestJson } from "@theoria/docs-model"

/**
 * The site under test. `SiteLive` is the deployable Worker bundle running
 * inside workerd (Cloudflare's runtime) with the real `wrangler.jsonc`, the
 * real `dist/` assets, and the real `_headers` file; `SiteRemote` is a
 * deployment named by `THEORIA_SITE_URL`, read over the network. HTTP tests
 * call `fetch`; browser tests point Chromium at `url`. Against the harness,
 * absolute URLs control the hostname the Worker sees.
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

/** Request shape the tests need. */
export class SiteRequest extends Data.Class<{
  readonly method?: HttpMethod.HttpMethod
  readonly headers?: Record<string, string>
  readonly body?: string
}> {}

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

/** Runs one harness call. */
const harness = <A>(run: () => Promise<A>): Effect.Effect<A, SiteError> =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new SiteError({ message: Predicate.isError(cause) ? cause.message : String(cause), cause })
  })

const operationalError = (cause: unknown) =>
  new SiteError({ message: Predicate.isError(cause) ? cause.message : String(cause), cause })

export class Site extends Context.Tag("test/worker/Site")<Site, {
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
  readonly visitorHeaders: (visitor: number) => Readonly<Record<string, string>>
  /**
   * What the Workers runtime has logged since the server started, oldest
   * first, each line stamped and levelled — the Worker's own logs and the
   * runtime's, which no browser sees: a request the asset layer failed, an
   * exception in the Worker. For a failure report; nothing is cleared. A
   * deployment's logs are not readable from outside it, so they are empty.
   */
  readonly logs: Effect.Effect<ReadonlyArray<string>>
}>() {}

export const text = (response: SiteResponse) => response.text
export const json = (response: SiteResponse) => response.json
/** One response header, as the site sent it. */
export const header = (response: SiteResponse, name: string) => Headers.get(response.headers, name)

type SiteService = Context.Tag.Service<Site>

/** A response whose body has been read: `json` parses that one text. */
const respond = (status: number, headers: Headers.Headers, body: string) =>
  new SiteResponse({
    status,
    headers,
    text: Effect.succeed(body),
    json: Schema.decodeUnknown(Schema.parseJson())(body).pipe(Effect.mapError(operationalError))
  })

/** Visitor addresses are drawn from TEST-NET-3 (203.0.113.0/24) and the documentation nets above it. */
const visitorAddress = (visitor: number): string =>
  `203.0.${String(113 + Math.floor(visitor / 256))}.${String(visitor % 256)}`

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
      Effect.flatMap(Schema.decode(DocsManifestJson)),
      Effect.mapError(operationalError)
    )
    const shell = yield* serve("/").pipe(Effect.flatMap(text))
    const hashedScript = yield* Str.match(shellScript)(shell).pipe(
      Option.flatMap((found) => Arr.get(found, 1)),
      Option.match({
        onNone: () => Effect.fail(new SiteError({ message: "The shell names no hashed script.", cause: shell })),
        onSome: Effect.succeed
      })
    )
    return { manifest, hashedScript }
  })

const missingBuild = (file: string) =>
  Effect.dieMessage(
    `${file} is missing. The Worker tests run the deployable bundle; build it first with ` +
      "`bun run build:web && bun run deploy:dry-run` in apps/theoria."
  )

const requireFile = (file: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const exists = yield* fileSystem.exists(file).pipe(Effect.mapError(operationalError))
    return yield* exists ? Effect.void : missingBuild(file)
  })

/**
 * The harness for the whole layer. Nothing in a test can respond to workerd
 * failing to shut down, so that failure surfaces as a defect in the scope's exit.
 */
export const SiteLive: Layer.Layer<Site, SiteError> = Layer.scoped(
  Site,
  Effect.gen(function*() {
    const path = yield* Path.Path
    const projectRoot = yield* Url.fromString("../../", import.meta.url).pipe(
      Effect.flatMap((url) => path.fromFileUrl(url)),
      Effect.orDie
    )
    const distRoot = path.join(projectRoot, "dist")
    const workerDir = path.join(projectRoot, ".wrangler-out")

    yield* requireFile(path.join(distRoot, "index.html"))
    yield* requireFile(path.join(distRoot, "docs-data", "manifest.json"))
    yield* requireFile(path.join(workerDir, "worker.js"))

    const server = yield* Effect.acquireRelease(
      Effect.sync(() =>
        createTestHarness({
          root: projectRoot,
          workers: [{
            configPath: "./wrangler.jsonc",
            prebuiltWorkerDir: "./.wrangler-out",
            vars: {
              BUILD_SHA: buildSha,
              GA_MEASUREMENT_ID: testMeasurementId,
              CF_WEB_ANALYTICS_TOKEN: testBeaconToken
            }
          }]
        })
      ),
      (running) => Effect.orDie(harness(() => running.close()))
    )
    const listening = yield* harness(() => server.listen())

    const fetch: SiteService["fetch"] = (input, init) =>
      harness(() => server.fetch(input, init)).pipe(
        Effect.flatMap((response) =>
          Effect.map(
            harness(() => response.text()),
            (body) => respond(response.status, Headers.fromInput(response.headers), body)
          )
        )
      )
    const { hashedScript, manifest } = yield* describeSite(fetch)

    return Site.of({
      url: listening.url.origin,
      fetch,
      manifest,
      hashedScript,
      visitorHeaders: (visitor) => ({ "cf-connecting-ip": visitorAddress(visitor) }),
      logs: Effect.sync(() =>
        Arr.map(
          server.getLogs(),
          (log) => `${DateTime.formatIso(DateTime.unsafeMake(log.timestamp))} ${log.level}: ${log.message}`
        )
      )
    })
  })
).pipe(Layer.provide(BunContext.layer))

/** The deployment `THEORIA_SITE_URL` names, reached through the platform `HttpClient`. */
export const SiteRemote: Layer.Layer<Site, SiteError | ConfigError.ConfigError> = Layer.effect(
  Site,
  Effect.gen(function*() {
    const origin = yield* Config.url("THEORIA_SITE_URL")
    const client = yield* HttpClient.HttpClient

    const fetch: SiteService["fetch"] = (input, init = new SiteRequest({})) =>
      Effect.gen(function*() {
        const target = yield* Url.fromString(input, origin)
        const request = HttpClientRequest.make(init.method ?? "GET")(target, { headers: init.headers })
        const response = yield* client.execute(
          Option.match(Option.fromNullable(init.body), {
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
      visitorHeaders: () => ({}),
      logs: Effect.succeed([])
    })
  })
).pipe(Layer.provide(FetchHttpClient.layer))

/**
 * The site a profile runs against: the deployment `THEORIA_SITE_URL` names
 * when it is set (`bun run test:worker:staging`), else the harness.
 */
export const SiteUnderTest: Layer.Layer<Site, SiteError | ConfigError.ConfigError> = Layer.unwrapEffect(
  Effect.map(
    Config.option(Config.url("THEORIA_SITE_URL")),
    Option.match({
      onNone: (): Layer.Layer<Site, SiteError | ConfigError.ConfigError> => SiteLive,
      onSome: () => SiteRemote
    })
  )
)
