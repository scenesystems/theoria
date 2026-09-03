import { HttpApp, HttpMiddleware } from "@effect/platform"
import { ConfigProvider, Layer, Option } from "effect"
import * as EffectRecord from "effect/Record"

import { AppLayer, publicApp } from "./app.js"
import * as AssetsStaticStore from "./platform/assets-static-store.js"
import * as WorkersRateLimit from "./platform/workers-rate-limit.js"

/**
 * Cloudflare Worker adapter for the Theoria server.
 *
 * Bindings and variables arrive per request as `env`. String-valued entries
 * (plain `vars` and secrets) become the Effect `ConfigProvider`, so the same
 * `Config` reads work on Bun (`process.env`) and on Workers. `ASSETS` is the
 * static-assets binding and `PLACE_BUILD_LIMITER` the rate-limiting binding,
 * both declared in `wrangler.jsonc`. The limiter is optional at the type level
 * because a preview built from a branch that changes the binding is deployed
 * with the configuration from `main`.
 */
export type WorkerEnv = {
  readonly ASSETS: AssetsStaticStore.AssetsFetcher
  readonly PLACE_BUILD_LIMITER?: WorkersRateLimit.RateLimitBinding
  readonly [variable: string]: unknown
}

export type WorkerHandler = {
  readonly handler: (request: Request) => Promise<Response>
  readonly dispose: () => Promise<void>
}

const stringVariables = (env: WorkerEnv): Record<string, string> =>
  EffectRecord.filter(env, (value): value is string => typeof value === "string")

export const makeWorkerHandler = (env: WorkerEnv): WorkerHandler =>
  HttpApp.toWebHandlerLayer(
    publicApp,
    AppLayer.pipe(
      Layer.provideMerge(AssetsStaticStore.layer(env.ASSETS)),
      Layer.provideMerge(WorkersRateLimit.layerFromEnv(Option.fromNullable(env.PLACE_BUILD_LIMITER))),
      Layer.provide(Layer.setConfigProvider(ConfigProvider.fromJson(stringVariables(env))))
    ),
    { middleware: HttpMiddleware.logger }
  )
