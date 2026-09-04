// @vitest-environment node
import { Path, Url } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"
import { type Unstable_Config, unstable_readConfig } from "wrangler"

const projectRoot: Effect.Effect<string, never, Path.Path> = Effect.gen(function*() {
  const path = yield* Path.Path
  return yield* path.fromFileUrl(yield* Url.fromString("../../", import.meta.url))
}).pipe(Effect.orDie)

/** Loads `wrangler.jsonc` through Wrangler itself so environment inheritance matches deploy time. */
const readConfig = (env: Option.Option<string>): Effect.Effect<Unstable_Config> =>
  projectRoot.pipe(
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

it.effect("gives every deployment target its own release stage", () =>
  Effect.gen(function*() {
    const prod = yield* production
    const stage = yield* staging
    const pr = yield* preview

    expect(prod.vars.RELEASE_STAGE).toBe("production")
    expect(stage.vars.RELEASE_STAGE).toBe("production")
    expect(pr.vars.RELEASE_STAGE).toBe("preview")
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
