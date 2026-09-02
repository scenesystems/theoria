import { HttpMiddleware, HttpServer } from "@effect/platform"
import { BunFileSystem, BunHttpServer } from "@effect/platform-bun"
import { Layer } from "effect"

import { DocsCatalogLive } from "./config/docs-catalog.js"
import { PackageVersionsLive } from "./config/package-versions.js"
import { RuntimeInfoLive } from "./config/runtime.js"
import { DspProviderRuntimeLive } from "./demos/effect-dsp/provider.js"
import { ExecutionPolicyLive } from "./demos/policy.js"
import { DemoRateLimiterLive } from "./demos/rate-limiter.js"
import { ParticipantsLive } from "./imagined-place/authority.js"
import { app } from "./router.js"
import { securityHeaders } from "./security-headers.js"

const parsedPort = Number.parseInt(Bun.env.PORT ?? "3876", 10)
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3876

const publicApp = app.pipe(
  HttpMiddleware.xForwardedHeaders,
  securityHeaders
)

export const HttpLive = HttpServer.serve(publicApp, HttpMiddleware.logger)
  .pipe(
    HttpServer.withLogAddress,
    Layer.provide(ExecutionPolicyLive),
    Layer.provide(ParticipantsLive),
    Layer.provide(DemoRateLimiterLive),
    Layer.provide(DspProviderRuntimeLive),
    Layer.provide(PackageVersionsLive),
    Layer.provide(DocsCatalogLive),
    Layer.provide(RuntimeInfoLive),
    Layer.provide(BunFileSystem.layer),
    Layer.provide(BunHttpServer.layer({ port, idleTimeout: 120 }))
  )
