// @vitest-environment node
import { BunContext } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { resolveRootFrom } from "@theoria/source-proof"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"
import { type Unstable_Config, unstable_readConfig } from "wrangler"

import { ReleaseStage } from "../../app/contracts/release-stage.js"
import { runtimeDataPrefix } from "../../app/server/config/static-store.js"
import { cacheControlForPath, isHtmlPath } from "../../app/server/routes/static.js"

const projectRootUrl = new URL("../../", import.meta.url)

/** Loads `wrangler.jsonc` through Wrangler itself so environment inheritance matches deploy time. */
const readConfig = (env: Option.Option<string>): Effect.Effect<Unstable_Config> =>
  resolveRootFrom(projectRootUrl).pipe(
    Effect.map((projectRoot) =>
      Option.match(env, {
        onNone: () => unstable_readConfig({ config: `${projectRoot}/wrangler.jsonc` }, { hideWarnings: true }),
        onSome: (name) =>
          unstable_readConfig({ config: `${projectRoot}/wrangler.jsonc`, env: name }, { hideWarnings: true })
      })
    ),
    Effect.provide(BunContext.layer)
  )

const production = readConfig(Option.none())
const staging = readConfig(Option.some("staging"))
const preview = readConfig(Option.some("preview"))

/** Mirrors the glob subset Cloudflare accepts in `run_worker_first`: `*` matches any suffix. */
const matchesPattern = (pattern: string, pathname: string): boolean =>
  Str.endsWith("*")(pattern)
    ? Str.startsWith(pattern.slice(0, -1))(pathname)
    : pattern === pathname

const workerFirst = (patterns: ReadonlyArray<string>, pathname: string): boolean =>
  Arr.some(patterns, (pattern) => matchesPattern(pattern, pathname))

const patternsOf = (config: Unstable_Config): ReadonlyArray<string> =>
  Option.fromNullable(config.assets).pipe(
    Option.flatMapNullable((assets) => assets.run_worker_first),
    Option.match({
      onNone: () => [],
      onSome: (patterns) => typeof patterns === "boolean" ? [] : patterns
    })
  )

const htmlPathnames = ["/", "/index.html", "/docs", "/docs/effect-search", "/demos/digest"]
const edgeServedPathnames = ["/assets/app-abc123.js", "/docs-data/effect-search/pages.json", "/favicon.svg"]

it.effect("routes every Worker-owned path to the Worker before the assets layer", () =>
  Effect.gen(function*() {
    const patterns = patternsOf(yield* production)

    // HTML paths exist as assets only for `/index.html`; the Worker must still
    // see them to inject metadata and enforce docs 404s and stage gating.
    Arr.forEach(ReleaseStage.literals, (stage) =>
      Arr.forEach(
        Arr.filter(htmlPathnames, (pathname) => isHtmlPath(pathname, stage)),
        (pathname) => {
          expect(workerFirst(patterns, pathname), pathname).toBe(true)
        }
      ))

    // Private paths have matching assets on disk and must never be served directly.
    expect(workerFirst(patterns, `${runtimeDataPrefix}package-versions.json`)).toBe(true)
    expect(workerFirst(patterns, "/api/health/live")).toBe(true)
    expect(workerFirst(patterns, "/sitemap.xml")).toBe(true)

    // Long-lived assets are served directly from the edge without a Worker invocation.
    Arr.forEach(edgeServedPathnames, (pathname) => {
      expect(workerFirst(patterns, pathname), pathname).toBe(false)
      expect(cacheControlForPath(pathname)).not.toBe("no-cache")
    })
  }))

it.effect("keeps the assets layer from rewriting or falling back on its own", () =>
  Effect.gen(function*() {
    const config = yield* production

    expect(config.main).toMatch(/worker\.ts$/u)
    expect(config.assets?.binding).toBe("ASSETS")
    expect(config.assets?.html_handling).toBe("none")
    expect(config.assets?.not_found_handling).toBe("none")
    expect(config.workers_dev).toBe(false)
    expect(config.preview_urls).toBe(false)
    expect(config.compatibility_flags).toContain("nodejs_compat")
  }))

it.effect("gives every deployment target an explicit release stage and hostname", () =>
  Effect.gen(function*() {
    const prod = yield* production
    const stage = yield* staging
    const pr = yield* preview

    expect(prod.name).toBe("theoria")
    expect(prod.vars.RELEASE_STAGE).toBe("production")
    expect(prod.routes).toEqual([{ pattern: "theoria.scenesystems.io", custom_domain: true }])

    expect(stage.name).toBe("theoria-staging")
    expect(stage.vars.RELEASE_STAGE).toBe("production")
    expect(stage.routes).toEqual([{ pattern: "theoria.staging.scenesystems.io", custom_domain: true }])

    expect(pr.vars.RELEASE_STAGE).toBe("preview")
    expect(pr.routes).toEqual([])

    Arr.forEach([prod, stage, pr], (config) => {
      expect(config.assets?.directory).toMatch(/dist$/u)
      expect(config.assets?.run_worker_first).toEqual(prod.assets?.run_worker_first)
      expect(config.workers_dev).toBe(false)
      expect(config.preview_urls).toBe(false)
    })
  }))
