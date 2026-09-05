import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { Context, Data, Effect, Layer, Option, Predicate, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"
import { createTestHarness } from "wrangler"

import { type DocsManifest, DocsManifestJson } from "@theoria/docs-model"

/**
 * The deployable Worker bundle running inside workerd (Cloudflare's runtime)
 * with the real `wrangler.jsonc`, the real `dist/` assets, and the real
 * `_headers` file. HTTP tests call `fetch`; browser tests point Chromium at
 * `url`. Absolute URLs control the hostname the Worker sees.
 *
 * Requires a fresh build: `bun run build:web && bun run deploy:dry-run`.
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
  readonly method?: string
  readonly headers?: Record<string, string>
  readonly body?: string
}> {}

/** Response shape the tests read; satisfied by both DOM and workers-types responses. */
export class SiteResponse extends Data.Class<{
  readonly status: number
  readonly headers: { readonly get: Headers["get"] }
  readonly text: () => Promise<string>
  readonly json: () => Promise<unknown>
}> {}

/** The workerd harness rejected: it failed to listen, a request failed in transit, or a body could not be read. */
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

export class Site extends Context.Tag("test/worker/Site")<Site, {
  /** Origin of the local server, without a trailing slash. */
  readonly url: string
  readonly fetch: (input: string, init?: SiteRequest) => Effect.Effect<SiteResponse, SiteError>
  readonly manifest: DocsManifest
  readonly distRoot: string
  /** A content-hashed script from `dist/assets`, as a site path. */
  readonly hashedScript: string
}>() {}

const missingBuild = (file: string) =>
  Effect.dieMessage(
    `${file} is missing. The Worker tests run the deployable bundle; build it first with ` +
      "`bun run build:web && bun run deploy:dry-run` in apps/theoria."
  )

const requireFile = (file: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const exists = yield* fileSystem.exists(file).pipe(Effect.orDie)
    return yield* exists ? Effect.void : missingBuild(file)
  })

/**
 * The harness for the whole layer. Nothing in a test can respond to workerd
 * failing to shut down, so that failure surfaces as a defect in the scope's exit.
 */
export const SiteLive: Layer.Layer<Site, SiteError> = Layer.scoped(
  Site,
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
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

    const manifest = yield* fileSystem.readFileString(path.join(distRoot, "docs-data", "manifest.json")).pipe(
      Effect.flatMap(Schema.decode(DocsManifestJson)),
      Effect.orDie
    )
    const scripts = yield* fileSystem.readDirectory(path.join(distRoot, "assets")).pipe(
      Effect.map(Arr.filter(Str.endsWith(".js"))),
      Effect.orDie
    )
    const hashedScript = yield* Arr.head(scripts).pipe(
      Option.match({
        onNone: () => missingBuild(path.join(distRoot, "assets", "*.js")),
        onSome: (script) => Effect.succeed(`/assets/${script}`)
      })
    )

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

    return Site.of({
      url: listening.url.origin,
      fetch: (input, init) =>
        harness(() => server.fetch(input, init)).pipe(
          Effect.map((response) =>
            new SiteResponse({
              status: response.status,
              headers: { get: (name) => response.headers.get(name) },
              text: () => response.text(),
              json: () => response.json()
            })
          )
        ),
      manifest,
      distRoot,
      hashedScript
    })
  })
).pipe(Layer.provide(BunContext.layer))

export const text = (response: SiteResponse) => harness(() => response.text())
export const json = (response: SiteResponse) => harness(() => response.json())
