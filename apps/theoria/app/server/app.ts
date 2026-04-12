import { HttpMiddleware, HttpServer } from "@effect/platform"
import { BunFileSystem, BunHttpServer, BunPath } from "@effect/platform-bun"
import { WorkflowEngine } from "@effect/workflow"
import { Layer } from "effect"

import { DspProviderRuntimeLive } from "./capability/effect-dsp.js"
import { PackageDocsLive } from "./config/package-docs.js"
import { PackageVersionsLive } from "./config/package-versions.js"
import { RuntimeInfoLive } from "./config/runtime.js"
import { ExecutionPolicyLive } from "./kernel/kinds/policy.js"
import { RunStreamSessionRegistry } from "./kernel/kinds/stream-session-registry.js"
import { EntryWorkflowLive } from "./kernel/registry.js"
import { app } from "./router.js"

const parsedPort = Number.parseInt(Bun.env.PORT ?? "3876", 10)
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3876

const ServerLive = HttpServer.serve(app, HttpMiddleware.logger)
  .pipe(HttpServer.withLogAddress)

export const HttpLive = Layer.merge(ServerLive, EntryWorkflowLive)
  .pipe(
    Layer.provide(RunStreamSessionRegistry.Default),
    Layer.provide(WorkflowEngine.layerMemory),
    Layer.provide(ExecutionPolicyLive),
    Layer.provide(DspProviderRuntimeLive),
    Layer.provide(PackageDocsLive),
    Layer.provide(PackageVersionsLive),
    Layer.provide(RuntimeInfoLive),
    Layer.provide(BunFileSystem.layer),
    Layer.provide(BunPath.layer),
    Layer.provide(BunHttpServer.layer({ port, idleTimeout: 120 }))
  )
