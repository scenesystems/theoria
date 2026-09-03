import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { resolveRootFrom } from "@theoria/source-proof"
import { Context, Effect, Layer, Option, Schema } from "effect"
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

/** Request shape the tests need; keeps DOM and workers-types `Request` types apart. */
export type SiteRequest = {
  readonly method?: string
  readonly headers?: Record<string, string>
  readonly body?: string
}

/** Response shape the tests read; satisfied by both DOM and workers-types responses. */
export type SiteResponse = {
  readonly status: number
  readonly headers: { get(name: string): string | null }
  text(): Promise<string>
  json(): Promise<unknown>
}

export class Site extends Context.Tag("test/worker/Site")<Site, {
  /** Origin of the local server, without a trailing slash. */
  readonly url: string
  readonly fetch: (input: string, init?: SiteRequest) => Effect.Effect<SiteResponse>
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

export const SiteLive = Layer.scoped(
  Site,
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const projectRoot = yield* resolveRootFrom(new URL("../../", import.meta.url))
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
      (harness) => Effect.promise(() => harness.close())
    )
    const listening = yield* Effect.promise(() => server.listen())

    return Site.of({
      url: listening.url.origin,
      fetch: (input, init) => Effect.promise(() => server.fetch(input, init)),
      manifest,
      distRoot,
      hashedScript
    })
  })
).pipe(Layer.provide(BunContext.layer))

export const text = (response: SiteResponse) => Effect.promise(() => response.text())
export const json = (response: SiteResponse) => Effect.promise(() => response.json())
