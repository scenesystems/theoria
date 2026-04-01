import { HttpMiddleware, HttpServer } from "@effect/platform"
import { BunFileSystem, BunHttpServer } from "@effect/platform-bun"
import { Layer } from "effect"
import type * as ConfigError from "effect/ConfigError"

import { RuntimeInfoLive } from "./config/runtime.js"
import { DspProviderRuntimeLive } from "./demos/effect-dsp/provider.js"
import { ExecutionPolicyLive } from "./demos/policy.js"
import { app } from "./router.js"

const parsedPort = Number.parseInt(Bun.env.PORT ?? "3876", 10)
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3876

export const HttpLive: Layer.Layer<never, ConfigError.ConfigError, never> = HttpServer.serve(app, HttpMiddleware.logger)
  .pipe(
    HttpServer.withLogAddress,
    Layer.provide(ExecutionPolicyLive),
    Layer.provide(DspProviderRuntimeLive),
    Layer.provide(RuntimeInfoLive),
    Layer.provide(BunFileSystem.layer),
    Layer.provide(BunHttpServer.layer({ port }))
  )
