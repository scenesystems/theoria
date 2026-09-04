// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { PlaceBuildEnvelope } from "../../app/contracts/imagined-place-result.js"
import { PlaceBuildRequest } from "../../app/contracts/imagined-place.js"
import {
  buildSha,
  json,
  previewHost,
  productionHost,
  Site,
  SiteLive,
  SiteRequest,
  stagingHost,
  testBeaconToken,
  testMeasurementId,
  text
} from "./site.js"

const PartialRequest = PlaceBuildRequest.pick("scenario")

layer(SiteLive, { timeout: "2 minutes" })("Theoria Worker in workerd", (it) => {
  it.effect("answers API routes from the Worker with the deploy-time build SHA", () =>
    Effect.gen(function*() {
      const site = yield* Site

      const live = yield* site.fetch("/api/health/live")
      expect(live.status).toBe(200)
      expect(yield* json(live)).toMatchObject({ ok: true, meta: { buildSha }, data: { status: "live" } })

      expect(live.headers.get("content-security-policy")).toContain("default-src 'self'")
      // Shiki compiles its grammar engine from WebAssembly in the browser.
      expect(live.headers.get("content-security-policy")).toContain("script-src 'self' 'wasm-unsafe-eval'")

      const unknown = yield* site.fetch("/api/nope")
      expect(unknown.status).toBe(404)
      expect(yield* json(unknown)).toMatchObject({ ok: false, error: { code: "route-not-found" } })
    }))

  it.effect("renders the HTML shell through the Worker with per-route metadata", () =>
    Effect.gen(function*() {
      const site = yield* Site
      const firstPackage = Option.getOrThrow(Arr.head(site.manifest.packages))

      const home = yield* site.fetch(`${productionHost}/`)
      expect(home.status).toBe(200)
      expect(home.headers.get("content-type")).toBe("text/html; charset=utf-8")
      expect(home.headers.get("cache-control")).toBe("no-cache")
      const homeHtml = yield* text(home)
      expect(homeHtml).toContain(`<link rel="canonical" href="${productionHost}/" />`)
      expect(homeHtml).toContain(`<meta property="og:image" content="${productionHost}/social/theoria.png" />`)
      expect(homeHtml).toContain(`<meta name="twitter:card" content="summary_large_image" />`)
      expect(homeHtml).toContain(`<meta name="robots" content="index, follow, max-image-preview:large" />`)
      expect(homeHtml).toContain(
        `<script type="application/ld+json" id="structured-data">{"@context":"https://schema.org"`
      )
      expect(homeHtml).toContain(`"@type":"WebSite"`)

      // `/index.html` exists as an asset; `run_worker_first` must still hand it to the Worker.
      const shell = yield* site.fetch(`${productionHost}/index.html`)
      expect(shell.status).toBe(200)
      expect(shell.headers.get("cache-control")).toBe("no-cache")

      const overview = yield* site.fetch(`${productionHost}${firstPackage.overview.path}`)
      expect(overview.status).toBe(200)
      const overviewHtml = yield* text(overview)
      expect(overviewHtml).toContain(`<title>${firstPackage.overview.title}`)
      expect(overviewHtml).toContain(
        `<meta property="og:image" content="${productionHost}/social/${firstPackage.slug}.png" />`
      )
      expect(overviewHtml).toContain(`"@type":"SoftwareSourceCode"`)
      expect((yield* site.fetch(`/social/${firstPackage.slug}.png`)).headers.get("content-type")).toBe("image/png")

      const missingDocs = yield* site.fetch(`${productionHost}/docs/${firstPackage.slug}/no-such-guide`)
      expect(missingDocs.status).toBe(404)
      expect(missingDocs.headers.get("content-type")).toBe("text/html; charset=utf-8")
      expect(yield* text(missingDocs)).toContain(`<meta name="robots" content="noindex, follow" />`)

      expect((yield* site.fetch(`${productionHost}/no-such-file.js`)).status).toBe(404)
    }))

  it.effect("serves hashed assets from the edge with the _headers policy", () =>
    Effect.gen(function*() {
      const site = yield* Site

      const script = yield* site.fetch(site.hashedScript)
      expect(script.status).toBe(200)
      expect(script.headers.get("content-type")).toContain("javascript")
      expect(script.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
      expect(script.headers.get("x-content-type-options")).toBe("nosniff")
      expect(script.headers.get("etag")).not.toBeNull()

      // The Worker marks every non-canonical host `noindex`; the harness host is
      // not canonical, so a response without the header came from the assets layer.
      expect(script.headers.get("x-robots-tag")).toBeNull()
      expect((yield* site.fetch("/index.html")).headers.get("x-robots-tag")).toBe("noindex")

      const searchIndex = yield* site.fetch(site.manifest.searchIndexAsset)
      expect(searchIndex.status).toBe(200)
      expect(searchIndex.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")

      const manifest = yield* site.fetch("/docs-data/manifest.json")
      expect(manifest.status).toBe(200)
      expect(manifest.headers.get("cache-control") ?? "").not.toContain("immutable")

      expect((yield* site.fetch("/robots.txt")).status).toBe(200)
    }))

  it.effect("keeps non-production hostnames out of search indexes", () =>
    Effect.gen(function*() {
      const site = yield* Site

      expect((yield* site.fetch(`${productionHost}/`)).headers.get("x-robots-tag")).toBeNull()
      expect((yield* site.fetch(`${productionHost}${site.hashedScript}`)).headers.get("x-robots-tag")).toBeNull()

      expect((yield* site.fetch(`${stagingHost}/`)).headers.get("x-robots-tag")).toBe("noindex")
      expect((yield* site.fetch(`${stagingHost}${site.hashedScript}`)).headers.get("x-robots-tag")).toBe("noindex")

      expect((yield* site.fetch(`${previewHost}/api/health/live`)).headers.get("x-robots-tag")).toBe("noindex")
      expect((yield* site.fetch(`${previewHost}${site.hashedScript}`)).headers.get("x-robots-tag")).toBe("noindex")
    }))

  it.effect("reports analytics from the production hostname only, with a matching policy", () =>
    Effect.gen(function*() {
      const site = yield* Site

      const production = yield* site.fetch(`${productionHost}/docs`)
      const productionHtml = yield* text(production)
      expect(productionHtml).toContain(`https://www.googletagmanager.com/gtag/js?id=${testMeasurementId}`)
      expect(productionHtml).toContain(`data-measurement-id="${testMeasurementId}"`)
      expect(productionHtml).toContain(`data-cf-beacon='{"token":"${testBeaconToken}"}'`)
      expect(production.headers.get("content-security-policy")).toContain("https://www.googletagmanager.com")
      expect(production.headers.get("content-security-policy")).toContain("https://static.cloudflareinsights.com")
      expect((yield* site.fetch("/analytics/gtag-init.js")).status).toBe(200)

      const staging = yield* site.fetch(`${stagingHost}/docs`)
      const stagingHtml = yield* text(staging)
      expect(stagingHtml).not.toContain("googletagmanager")
      expect(stagingHtml).not.toContain("cloudflareinsights")
      expect(staging.headers.get("content-security-policy")).toBe(
        (yield* site.fetch(`${previewHost}/api/health/live`)).headers.get("content-security-policy")
      )
      expect(staging.headers.get("content-security-policy")).not.toContain("googletagmanager")
    }))

  it.effect("builds the sitemap from the shipped docs manifest", () =>
    Effect.gen(function*() {
      const site = yield* Site

      const sitemap = yield* site.fetch(`${productionHost}/sitemap.xml`)
      expect(sitemap.status).toBe(200)
      expect(sitemap.headers.get("content-type")).toBe("application/xml; charset=utf-8")
      const xml = yield* text(sitemap)
      expect(xml).toContain(`<loc>${productionHost}/docs</loc>`)
      Arr.forEach(site.manifest.packages, (docsPackage) => {
        expect(xml).toContain(`<loc>${productionHost}${docsPackage.overview.path}</loc>`)
      })
    }))

  it.effect("runs the Imagined Place build inside workerd", () =>
    Effect.gen(function*() {
      const site = yield* Site
      const post = (body: string) =>
        site.fetch(
          `${productionHost}/api/imagined-place/build`,
          new SiteRequest({
            method: "POST",
            headers: { "content-type": "application/json" },
            body
          })
        )

      const built = yield* post(
        yield* Schema.encode(Schema.parseJson(PlaceBuildRequest))({
          scenario: "lost-market",
          brief: "a quiet corner for two",
          acceptNeighbor: true,
          acceptProgram: true
        })
      )
      expect(built.status).toBe(200)
      const envelope = yield* Schema.decodeUnknown(PlaceBuildEnvelope)(yield* json(built)).pipe(Effect.orDie)
      expect(envelope.ok).toBe(true)
      expect(envelope.ok && envelope.data.artifact.scenario).toBe("lost-market")
      expect(envelope.ok && envelope.data.artifact.accepted).toHaveLength(2)

      const invalid = yield* post(yield* Schema.encode(Schema.parseJson(PartialRequest))({ scenario: "lost-market" }))
      expect(invalid.status).toBe(400)
      expect(yield* json(invalid)).toMatchObject({ ok: false, error: { code: "invalid-request" } })

      expect((yield* site.fetch(`${productionHost}/api/imagined-place/build`)).status).toBe(405)
    }))
})
