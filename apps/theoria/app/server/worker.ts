import { HttpApp, HttpMiddleware } from "@effect/platform"
import { ConfigProvider, Data, Effect, Layer, Predicate, Schema } from "effect"
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
 * both declared in `wrangler.jsonc`. The limiter is represented as an Option
 * because a preview built from a branch that changes the binding is deployed
 * with the configuration from `main`.
 *
 * `env` is decoded inside the handler's Layer, so bindings the schema rejects
 * fail the runtime's construction in the error channel, and the handler's
 * first request reports it, rather than raising out of the `fetch` export.
 */
const WorkerEnv = Schema.Struct(
  {
    ASSETS: AssetsStaticStore.AssetsFetcher,
    PLACE_BUILD_LIMITER: Schema.optionalWith(WorkersRateLimit.RateLimitBinding, { as: "Option" })
  },
  { key: Schema.String, value: Schema.Unknown }
)
type WorkerEnv = typeof WorkerEnv.Type

export class WorkerHandler extends Data.Class<{
  readonly handler: (request: Request) => Promise<Response>
  readonly dispose: () => Promise<void>
}> {}

const stringVariables = (env: WorkerEnv): Record<string, string> => EffectRecord.filter(env, Predicate.isString)

/** The server's Layer over the decoded bindings and variables. */
const layerFor = (env: WorkerEnv) =>
  AppLayer.pipe(
    Layer.provideMerge(AssetsStaticStore.layer(env.ASSETS)),
    Layer.provideMerge(WorkersRateLimit.layerFromEnv(env.PLACE_BUILD_LIMITER)),
    Layer.provide(Layer.setConfigProvider(ConfigProvider.fromJson(stringVariables(env))))
  )

export const makeWorkerHandler = (env: unknown): WorkerHandler =>
  new WorkerHandler(HttpApp.toWebHandlerLayer(
    publicApp,
    Layer.unwrapEffect(Effect.map(Schema.decodeUnknown(WorkerEnv)(env), layerFor)),
    { middleware: HttpMiddleware.logger }
  ))
