// @vitest-environment node
import { expect, layer } from "@effect/vitest"
import { ConfigProvider, Effect, Layer, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { PlaceBuildEnvelope } from "../../app/contracts/imagined-place-result.js"
import { PlaceBuildRequest } from "../../app/contracts/imagined-place.js"
import {
  buildSha,
  header,
  json,
  previewHost,
  productionHost,
  Site,
  SiteLive,
  SiteRemote,
  SiteRequest,
  type SiteResponse,
  SiteUnderTest,
  stagingHost,
  testBeaconToken,
  testMeasurementId,
  text
} from "./site.js"

/** The header's text; a test that reads it expects the header to be present. */
const headerText = (response: SiteResponse, name: string) => Option.getOrThrow(header(response, name))

const PartialRequest = PlaceBuildRequest.pick("scenario")

/** Every `/assets/…` path the shell names — scripts, styles, preloaded fonts — once each. */
const shellAssets = (shell: string): ReadonlyArray<string> =>
  Arr.dedupe(Arr.filterMap(Arr.fromIterable(shell.matchAll(/(\/assets\/[^"' )]+)/g)), (found) => Arr.get(found, 1)))

layer(SiteLive, { timeout: "2 minutes" })("Theoria Worker in workerd", (it) => {
  it.effect("answers API routes from the Worker with the deploy-time build SHA", () =>
    Effect.gen(function*() {
      const site = yield* Site

      const live = yield* site.fetch("/api/health/live")
      expect(live.status).toBe(200)
      expect(yield* json(live)).toMatchObject({ ok: true, meta: { buildSha }, data: { status: "live" } })

      expect(headerText(live, "content-security-policy")).toContain("default-src 'self'")
      // Shiki compiles its grammar engine from WebAssembly in the browser.
      expect(headerText(live, "content-security-policy")).toContain("script-src 'self' 'wasm-unsafe-eval'")

      const unknown = yield* site.fetch("/api/nope")
      expect(unknown.status).toBe(404)
      expect(yield* json(unknown)).toMatchObject({ ok: false, error: { code: "route-not-found" } })
    }))

  it.effect("renders the HTML shell through the Worker with per-route metadata", () =>
    Effect.gen(function*() {
      const site = yield* Site
      const firstPackage = yield* Arr.head(site.manifest.packages)

      const home = yield* site.fetch(`${productionHost}/`)
      expect(home.status).toBe(200)
      expect(header(home, "content-type")).toEqual(Option.some("text/html; charset=utf-8"))
      expect(header(home, "cache-control")).toEqual(Option.some("no-cache"))
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
      expect(header(shell, "cache-control")).toEqual(Option.some("no-cache"))

      const overview = yield* site.fetch(`${productionHost}${firstPackage.overview.path}`)
      expect(overview.status).toBe(200)
      const overviewHtml = yield* text(overview)
      expect(overviewHtml).toContain(`<title>${firstPackage.overview.title}`)
      expect(overviewHtml).toContain(
        `<meta property="og:image" content="${productionHost}/social/${firstPackage.slug}.png" />`
      )
      expect(overviewHtml).toContain(`"@type":"SoftwareSourceCode"`)
      expect(header(yield* site.fetch(`/social/${firstPackage.slug}.png`), "content-type")).toEqual(
        Option.some("image/png")
      )

      const missingDocs = yield* site.fetch(`${productionHost}/docs/${firstPackage.slug}/no-such-guide`)
      expect(missingDocs.status).toBe(404)
      expect(header(missingDocs, "content-type")).toEqual(Option.some("text/html; charset=utf-8"))
      expect(yield* text(missingDocs)).toContain(`<meta name="robots" content="noindex, follow" />`)

      expect((yield* site.fetch(`${productionHost}/no-such-file.js`)).status).toBe(404)
    }))

  it.effect("serves hashed assets from the edge with the _headers policy", () =>
    Effect.gen(function*() {
      const site = yield* Site

      const script = yield* site.fetch(site.hashedScript)
      expect(script.status).toBe(200)
      expect(headerText(script, "content-type")).toContain("javascript")
      expect(header(script, "cache-control")).toEqual(Option.some("public, max-age=31536000, immutable"))
      expect(header(script, "x-content-type-options")).toEqual(Option.some("nosniff"))
      expect(Option.isSome(header(script, "etag"))).toBe(true)

      // The Worker marks every non-canonical host `noindex`; the harness host is
      // not canonical, so a response without the header came from the assets layer.
      expect(header(script, "x-robots-tag")).toEqual(Option.none())
      expect(header(yield* site.fetch("/index.html"), "x-robots-tag")).toEqual(Option.some("noindex"))

      const searchIndex = yield* site.fetch(site.manifest.searchIndexAsset)
      expect(searchIndex.status).toBe(200)
      expect(header(searchIndex, "cache-control")).toEqual(Option.some("public, max-age=31536000, immutable"))

      const manifest = yield* site.fetch("/docs-data/manifest.json")
      expect(manifest.status).toBe(200)
      expect(Option.getOrElse(header(manifest, "cache-control"), () => "")).not.toContain("immutable")

      expect((yield* site.fetch("/robots.txt")).status).toBe(200)
    }))

  it.effect("answers every shell asset 200 across concurrent page loads", () =>
    Effect.gen(function*() {
      const site = yield* Site
      const shell = yield* site.fetch("/").pipe(Effect.flatMap(text))
      const assets = shellAssets(shell)
      expect(assets.length).toBeGreaterThan(2)

      // A page load asks for every asset at once, and the browser suite's
      // shards load pages back to back; an asset answered 500 — as the
      // wrangler dev proxy did under this load — cannot be retried by a
      // browser, so the app never mounts.
      const answers = yield* Effect.forEach(
        Arr.makeBy(200, (load) => load),
        (load) =>
          Effect.forEach(
            assets,
            (asset) => Effect.map(site.fetch(asset), (response) => ({ load, asset, status: response.status })),
            { concurrency: "unbounded" }
          ),
        { concurrency: 32 }
      ).pipe(Effect.map(Arr.flatten))
      expect(Arr.filter(answers, (answer) => answer.status !== 200)).toEqual([])
      expect(answers.length).toBe(200 * assets.length)
    }), { timeout: 120_000 })

  it.effect("serves its own typefaces, preloaded by the shell, so no text is set twice", () =>
    Effect.gen(function*() {
      const site = yield* Site

      const home = yield* site.fetch(`${productionHost}/`)
      const homeHtml = yield* text(home)
      expect(homeHtml).not.toContain("fonts.googleapis.com")
      expect(homeHtml).not.toContain("fonts.gstatic.com")
      const policy = headerText(home, "content-security-policy")
      expect(policy).toContain("font-src 'self'")
      expect(policy).not.toContain("gstatic")
      expect(policy).not.toContain("googleapis")

      // The shell preloads every Latin face the stylesheet declares, so text set
      // by the first render is set in it; other subsets load only when used.
      // The faces are build assets: the stylesheet's URLs and the preloads are
      // the same content-hashed files, and a new file is a new URL.
      const stylesheet = yield* Option.match(
        Option.fromNullable(/<link rel="stylesheet" crossorigin href="([^"]+\.css)">/u.exec(homeHtml)?.[1]),
        { onNone: () => Effect.dieMessage("the shell links no stylesheet"), onSome: Effect.succeed }
      )
      const css = yield* text(yield* site.fetch(stylesheet))
      const declared = Arr.fromIterable(
        css.matchAll(/url\((\/assets\/[^)]+-latin-wght-normal-[^)]+\.woff2)\)/gu)
      ).map((found) => found[1] ?? "")
      const preloads = Arr.fromIterable(
        homeHtml.matchAll(
          /<link rel="preload" href="(\/assets\/[^"]+\.woff2)" as="font" type="font\/woff2" crossorigin/gu
        )
      ).map((found) => found[1] ?? "")
      expect(declared).toHaveLength(2)
      expect(Arr.sort(preloads, Str.Order)).toEqual(Arr.sort(declared, Str.Order))
      yield* Effect.forEach(preloads, (pathname) =>
        Effect.gen(function*() {
          const font = yield* site.fetch(pathname)
          expect(font.status).toBe(200)
          expect(header(font, "content-type")).toEqual(Option.some("font/woff2"))
          expect(header(font, "cache-control")).toEqual(Option.some("public, max-age=31536000, immutable"))
        }))

      // Every stand-in the stacks name is declared with the served face's metrics, so the swap moves nothing.
      // The minifier may drop the quotes and escape the colon (`Fallback\: Arial`); both spellings name one face.
      expect(css).toMatch(
        /font-family:\s*["']?Figtree Variable Fallback\\?: Arial["']?;\s*src:\s*local\(["']?Arial["']?\)[^}]*ascent-override:/u
      )
      expect(css).toMatch(
        /font-family:\s*["']?JetBrains Mono Variable Fallback\\?: Courier New["']?;\s*src:\s*local\(["']?Courier New["']?\)[^}]*ascent-override:/u
      )
    }))

  it.effect("serves a spec-shaped llms.txt from the shipped docs manifest", () =>
    Effect.gen(function*() {
      const site = yield* Site

      const response = yield* site.fetch("/llms.txt")
      expect(response.status).toBe(200)
      expect(header(response, "content-type")).toEqual(Option.some("text/plain; charset=utf-8"))

      const lines = Str.split(yield* text(response), "\n")
      expect(lines[0]).toBe("# Theoria")
      expect(lines[2]?.startsWith("> ")).toBe(true)
      // llmstxt.org: every list entry under an H2 is a hyperlink, optionally followed by notes.
      const listEntries = Arr.filter(lines, Str.startsWith("- "))
      expect(listEntries.length).toBeGreaterThan(0)
      Arr.forEach(listEntries, (line) => expect(line).toMatch(/^- \[[^\]]+\]\(https:\/\/[^)\s]+\)(: \S.*)?$/u))
      Arr.forEach(site.manifest.packages, (docsPackage) => {
        expect(listEntries).toContainEqual(expect.stringContaining(
          `[${docsPackage.name} ${docsPackage.version}](https://raw.githubusercontent.com/scenesystems/theoria/${site.manifest.revision}/packages/${docsPackage.slug}/README.md)`
        ))
      })

      expect(header(yield* site.fetch("/"), "link")).toEqual(Option.some(`</llms.txt>; rel="describedby"`))
    }))

  it.effect("keeps non-production hostnames out of search indexes", () =>
    Effect.gen(function*() {
      const site = yield* Site
      const robots = (url: string) => Effect.map(site.fetch(url), (response) => header(response, "x-robots-tag"))

      expect(yield* robots(`${productionHost}/`)).toEqual(Option.none())
      expect(yield* robots(`${productionHost}${site.hashedScript}`)).toEqual(Option.none())

      expect(yield* robots(`${stagingHost}/`)).toEqual(Option.some("noindex"))
      expect(yield* robots(`${stagingHost}${site.hashedScript}`)).toEqual(Option.some("noindex"))

      expect(yield* robots(`${previewHost}/api/health/live`)).toEqual(Option.some("noindex"))
      expect(yield* robots(`${previewHost}${site.hashedScript}`)).toEqual(Option.some("noindex"))
    }))

  it.effect("reports analytics from the production hostname only, with a matching policy", () =>
    Effect.gen(function*() {
      const site = yield* Site

      const production = yield* site.fetch(`${productionHost}/docs`)
      const productionHtml = yield* text(production)
      expect(productionHtml).toContain(`https://www.googletagmanager.com/gtag/js?id=${testMeasurementId}`)
      expect(productionHtml).toContain(`data-measurement-id="${testMeasurementId}"`)
      expect(productionHtml).toContain(`data-cf-beacon='{"token":"${testBeaconToken}"}'`)
      expect(headerText(production, "content-security-policy")).toContain("https://www.googletagmanager.com")
      expect(headerText(production, "content-security-policy")).toContain("https://static.cloudflareinsights.com")
      expect((yield* site.fetch("/analytics/gtag-init.js")).status).toBe(200)

      const staging = yield* site.fetch(`${stagingHost}/docs`)
      const stagingHtml = yield* text(staging)
      expect(stagingHtml).not.toContain("googletagmanager")
      expect(stagingHtml).not.toContain("cloudflareinsights")
      expect(header(staging, "content-security-policy")).toEqual(
        header(yield* site.fetch(`${previewHost}/api/health/live`), "content-security-policy")
      )
      expect(headerText(staging, "content-security-policy")).not.toContain("googletagmanager")
    }))

  it.effect("builds the sitemap from the shipped docs manifest", () =>
    Effect.gen(function*() {
      const site = yield* Site

      const sitemap = yield* site.fetch(`${productionHost}/sitemap.xml`)
      expect(sitemap.status).toBe(200)
      expect(header(sitemap, "content-type")).toEqual(Option.some("application/xml; charset=utf-8"))
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
      const envelope = yield* Schema.decodeUnknown(PlaceBuildEnvelope)(yield* json(built))
      expect(envelope.ok).toBe(true)
      expect(envelope.ok && envelope.data.artifact.scenario).toBe("lost-market")
      expect(envelope.ok && envelope.data.artifact.accepted).toHaveLength(2)

      const invalid = yield* post(yield* Schema.encode(Schema.parseJson(PartialRequest))({ scenario: "lost-market" }))
      expect(invalid.status).toBe(400)
      expect(yield* json(invalid)).toMatchObject({ ok: false, error: { code: "invalid-request" } })

      expect((yield* site.fetch(`${productionHost}/api/imagined-place/build`)).status).toBe(405)
    }))

  it.effect("a named deployment is the same site as the harness, read over the network", () =>
    Effect.gen(function*() {
      const site = yield* Site
      const named = Layer.setConfigProvider(ConfigProvider.fromJson({ THEORIA_SITE_URL: site.url }))
      const remote = yield* Site.pipe(Effect.provide(SiteRemote.pipe(Layer.provide(named))))

      expect(remote.url).toBe(site.url)
      expect(remote.manifest).toEqual(site.manifest)
      expect(remote.hashedScript).toBe(site.hashedScript)
      // A deployment's runtime logs are not readable from outside it.
      expect(yield* remote.logs).toEqual([])
      // The harness stands in for the edge and names each visitor's address itself; behind a real edge that
      // header is Cloudflare's to set, and a client that sends it is refused (error 1000).
      expect(site.visitorHeaders(3)).toEqual({ "cf-connecting-ip": "203.0.113.3" })
      expect(site.visitorHeaders(256)).toEqual({ "cf-connecting-ip": "203.0.114.0" })
      expect(remote.visitorHeaders(3)).toEqual({})

      const [local, served] = yield* Effect.all([site.fetch("/api/health/live"), remote.fetch("/api/health/live")])
      expect(served.status).toBe(local.status)
      expect(header(served, "content-type")).toEqual(header(local, "content-type"))
      expect(header(served, "content-security-policy")).toEqual(header(local, "content-security-policy"))
      // Each request is answered with its own id; the rest of the envelope is the site's.
      expect(yield* json(served)).toMatchObject({ ok: true, meta: { buildSha }, data: { status: "live" } })

      const script = yield* remote.fetch(remote.hashedScript)
      expect(script.status).toBe(200)
      expect(header(script, "cache-control")).toEqual(Option.some("public, max-age=31536000, immutable"))

      const posted = yield* remote.fetch(
        "/api/imagined-place/build",
        new SiteRequest({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: yield* Schema.encode(Schema.parseJson(PartialRequest))({ scenario: "lost-market" })
        })
      )
      expect(posted.status).toBe(400)
      expect(yield* json(posted)).toMatchObject({ ok: false, error: { code: "invalid-request" } })

      // The site under test is the named deployment when one is named…
      const chosen = yield* Site.pipe(Effect.provide(SiteUnderTest.pipe(Layer.provide(named))))
      expect(chosen.url).toBe(site.url)
      expect(yield* chosen.logs).toEqual([])
    }))
})
