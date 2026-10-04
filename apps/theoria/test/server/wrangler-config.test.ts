// @vitest-environment node
import { BunServices } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Effect, Option, Path, Schema } from "effect"
import * as Arr from "effect/Array"
import { Url } from "effect/http"
import { unstable_readConfig } from "wrangler"

const projectRoot: Effect.Effect<string, never, Path.Path> = Effect.gen(function*() {
  const path = yield* Path.Path
  return yield* path.fromFileUrl(yield* Effect.fromResult(Url.fromString("../../", import.meta.url)))
}).pipe(Effect.orDie)

const RateLimitConfig = Schema.Struct({
  ratelimits: Schema.Array(Schema.Struct({ name: Schema.String, namespace_id: Schema.String }))
})

/** Loads `wrangler.jsonc` through Wrangler itself so environment inheritance matches deploy time. */
const readConfig = (env: Option.Option<string>) =>
  projectRoot.pipe(
    Effect.flatMap((projectRoot) =>
      Schema.decodeUnknownEffect(RateLimitConfig)(unstable_readConfig({
        config: `${projectRoot}/wrangler.jsonc`,
        ...Option.match(env, { onNone: () => ({}), onSome: (env) => ({ env }) })
      }, { hideWarnings: true }))
    ),
    Effect.provide(BunServices.layer)
  )

const production = readConfig(Option.none())
const staging = readConfig(Option.some("staging"))
const preview = readConfig(Option.some("preview"))

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
