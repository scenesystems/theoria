import { expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Arr from "effect/Array"
import * as EffectRecord from "effect/Record"

import { DocsManifestJson } from "@theoria/docs-model"
import { PackageVersionsJson, ProgramSourcesJson, runtimeDataPathnames } from "../../app/server/config/runtime-data.js"
import { allProgramSourcePaths } from "../../app/server/demos/program-sources.js"
import { makeWorkerHandler, type WorkerEnv } from "../../app/server/worker.js"
import { docsManifestFixture } from "../helpers/docs-fixtures.js"
import { fakeAssets } from "../helpers/fake-assets.js"

const indexHtml = [
  "<!doctype html><html><head>",
  "<meta name=\"description\" content=\"placeholder\" />",
  "<meta property=\"og:title\" content=\"placeholder\" />",
  "<meta property=\"og:description\" content=\"placeholder\" />",
  "<meta property=\"og:url\" content=\"https://placeholder\" />",
  "<meta property=\"og:type\" content=\"website\" />",
  "<meta name=\"twitter:title\" content=\"placeholder\" />",
  "<meta name=\"twitter:description\" content=\"placeholder\" />",
  "<link rel=\"canonical\" href=\"https://placeholder\" />",
  "<title>placeholder</title>",
  "</head><body><div id=\"root\"></div></body></html>"
].join("")

const distFiles = Effect.gen(function*() {
  const manifest = yield* Schema.encode(DocsManifestJson)(docsManifestFixture)
  const versions = yield* Schema.encode(PackageVersionsJson)({ "@scenesystems/effect-search": "1.2.3" })
  const sources = yield* Schema.encode(ProgramSourcesJson)(
    EffectRecord.fromEntries(Arr.map(allProgramSourcePaths, (appPath) => [appPath, `// ${appPath}`]))
  )

  return {
    "/index.html": indexHtml,
    "/assets/app-abc123.js": "console.log(1)",
    "/robots.txt": "User-agent: *",
    "/docs-data/manifest.json": manifest,
    [runtimeDataPathnames.packageVersions]: versions,
    [runtimeDataPathnames.programSources]: sources
  }
})

const workerFor = (variables: Record<string, string>) =>
  Effect.map(distFiles, (files) => {
    const env: WorkerEnv = { ASSETS: fakeAssets(files), ...variables }

    return makeWorkerHandler(env)
  })

const get = (handler: (request: Request) => Promise<Response>, path: string, headers: Record<string, string> = {}) =>
  Effect.promise(() => handler(new Request(`https://theoria.test${path}`, { headers })))

const json = (response: Response) => Effect.promise(() => response.json())

it.effect("serves API routes with configuration taken from the Worker env", () =>
  Effect.gen(function*() {
    const worker = yield* workerFor({ BUILD_SHA: "abc1234", RELEASE_STAGE: "production" })

    const live = yield* get(worker.handler, "/api/health/live")
    expect(live.status).toBe(200)
    expect(yield* json(live)).toMatchObject({ ok: true, meta: { buildSha: "abc1234" }, data: { status: "live" } })

    const versions = yield* get(worker.handler, "/api/versions/packages")
    expect(yield* json(versions)).toMatchObject({ ok: true, data: { "@scenesystems/effect-search": "1.2.3" } })

    const capabilities = yield* get(worker.handler, "/api/capabilities")
    expect(capabilities.status).toBe(200)
    expect(capabilities.headers.get("content-security-policy")).toContain("default-src 'self'")

    const unknown = yield* get(worker.handler, "/api/nope")
    expect(unknown.status).toBe(404)
    expect(yield* json(unknown)).toMatchObject({ ok: false, error: { code: "route-not-found" } })

    yield* Effect.promise(worker.dispose)
  }))

it.effect("renders the SPA shell from the assets binding with injected metadata", () =>
  Effect.gen(function*() {
    const worker = yield* workerFor({ RELEASE_STAGE: "production" })

    const home = yield* get(worker.handler, "/")
    expect(home.status).toBe(200)
    expect(home.headers.get("content-type")).toBe("text/html; charset=utf-8")
    expect(home.headers.get("cache-control")).toBe("no-cache")
    const homeHtml = yield* Effect.promise(() => home.text())
    expect(homeHtml).toContain("<link rel=\"canonical\" href=\"https://theoria.scenesystems.io/\" />")
    expect(homeHtml).not.toContain("placeholder")

    const docs = yield* get(worker.handler, "/docs/effect-search/getting-started")
    expect(docs.status).toBe(200)
    expect(yield* Effect.promise(() => docs.text())).toContain("<title>Getting started")

    const missingDocs = yield* get(worker.handler, "/docs/effect-search/nope")
    expect(missingDocs.status).toBe(404)
    expect(missingDocs.headers.get("content-type")).toBe("text/html; charset=utf-8")

    yield* Effect.promise(worker.dispose)
  }))

it.effect("gates demo pages by release stage", () =>
  Effect.gen(function*() {
    const production = yield* workerFor({ RELEASE_STAGE: "production" })
    const preview = yield* workerFor({ RELEASE_STAGE: "preview" })

    expect((yield* get(production.handler, "/demos/digest")).status).toBe(404)
    expect((yield* get(preview.handler, "/demos/digest")).status).toBe(200)

    yield* Effect.promise(production.dispose)
    yield* Effect.promise(preview.dispose)
  }))

it.effect("passes other assets through and hides runtime data", () =>
  Effect.gen(function*() {
    const worker = yield* workerFor({})

    const script = yield* get(worker.handler, "/assets/app-abc123.js", { "accept-encoding": "gzip" })
    expect(script.status).toBe(200)
    expect(script.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
    expect(script.headers.get("content-type")).toBe("application/javascript; charset=utf-8")
    expect(yield* Effect.promise(() => script.text())).toBe("console.log(1)")

    expect((yield* get(worker.handler, "/robots.txt")).headers.get("cache-control")).toBe("public, max-age=3600")
    expect((yield* get(worker.handler, "/missing.js")).status).toBe(404)
    expect((yield* get(worker.handler, runtimeDataPathnames.programSources)).status).toBe(404)
    expect((yield* get(worker.handler, "/docs-data/manifest.json")).status).toBe(200)

    yield* Effect.promise(worker.dispose)
  }))

it.effect("returns the sitemap built from the docs manifest", () =>
  Effect.gen(function*() {
    const worker = yield* workerFor({ RELEASE_STAGE: "production" })

    const sitemap = yield* get(worker.handler, "/sitemap.xml")
    expect(sitemap.status).toBe(200)
    const xml = yield* Effect.promise(() => sitemap.text())
    expect(xml).toContain("<loc>https://theoria.scenesystems.io/docs/effect-search/getting-started</loc>")

    yield* Effect.promise(worker.dispose)
  }))
