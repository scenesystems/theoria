import { HttpMiddleware, HttpServer } from "@effect/platform"
import { BunFileSystem, BunHttpServer, BunPath } from "@effect/platform-bun"
import { WorkflowEngine } from "@effect/workflow"
import { Layer } from "effect"

import { PackageDocsLive } from "./config/package-docs.js"
import { PackageVersionsLive } from "./config/package-versions.js"
import { RuntimeInfoLive } from "./config/runtime.js"
import { DspProviderRuntimeLive } from "./demos/effect-dsp/provider.js"
import { ExecutionPolicyLive } from "./demos/policy.js"
import { DemoWorkflowLive } from "./demos/registry.js"
import { DemoStreamSessionRegistry } from "./demos/stream-session-registry.js"
import { app } from "./router.js"
import { WorkflowComparisonWorkflowLive } from "./workflow-comparison/workflow.js"

const parsedPort = Number.parseInt(Bun.env.PORT ?? "3876", 10)
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3876

const ServerLive = HttpServer.serve(app, HttpMiddleware.logger)
  .pipe(HttpServer.withLogAddress)

const AppWorkflowLive = Layer.merge(DemoWorkflowLive, WorkflowComparisonWorkflowLive)

export const HttpLive = Layer.merge(ServerLive, AppWorkflowLive)
  .pipe(
    Layer.provide(DemoStreamSessionRegistry.Default),
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
