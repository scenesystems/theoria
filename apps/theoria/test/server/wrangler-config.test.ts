// @vitest-environment node
import { BunContext } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { resolveRootFrom } from "@theoria/source-proof"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"
import { type Unstable_Config, unstable_readConfig } from "wrangler"

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

it.effect("gives every deployment target its own place-build limiter (the binding is not inherited)", () =>
  Effect.gen(function*() {
    const configs = [yield* production, yield* staging, yield* preview]

    const limiters = Arr.map(
      configs,
      (config) => Arr.filter(config.ratelimits, (limit) => limit.name === "PLACE_BUILD_LIMITER")
    )
    Arr.forEach(limiters, (found) => {
      expect(found).toHaveLength(1)
    })
    const namespaces = Arr.flatMap(limiters, Arr.map((limit) => limit.namespace_id))
    expect(Arr.dedupe(namespaces)).toHaveLength(configs.length)
  }))
