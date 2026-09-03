import { HttpApp, HttpMiddleware } from "@effect/platform"
import { ConfigProvider, Layer } from "effect"
import * as EffectRecord from "effect/Record"

import { AppLayer, publicApp } from "./app.js"
import * as AssetsStaticStore from "./platform/assets-static-store.js"

/**
 * Cloudflare Worker adapter for the Theoria server.
 *
 * Bindings and variables arrive per request as `env`. String-valued entries
 * (plain `vars` and secrets) become the Effect `ConfigProvider`, so the same
 * `Config` reads work on Bun (`process.env`) and on Workers. `ASSETS` is the
 * static-assets binding declared in `wrangler.jsonc`.
 */
export type WorkerEnv = {
  readonly ASSETS: AssetsStaticStore.AssetsFetcher
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
      Layer.provide(Layer.setConfigProvider(ConfigProvider.fromJson(stringVariables(env))))
    ),
    { middleware: HttpMiddleware.logger }
  )
