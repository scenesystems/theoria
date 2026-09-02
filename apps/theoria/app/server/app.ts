import { HttpMiddleware } from "@effect/platform"
import { Layer } from "effect"

import { DocsCatalogLive } from "./config/docs-catalog.js"
import { PackageVersionsLive } from "./config/package-versions.js"
import { serverReleaseStage } from "./config/release-stage.js"
import { RuntimeInfoLive } from "./config/runtime.js"
import { DspProviderRuntimeLive } from "./demos/effect-dsp/provider.js"
import { ExecutionPolicyLive } from "./demos/policy.js"
import { ProgramSourcesLive } from "./demos/program-sources.js"
import { DemoRateLimiterLive } from "./demos/rate-limiter.js"
import { ParticipantsLive } from "./imagined-place/authority.js"
import { app } from "./router.js"
import { securityHeaders } from "./security-headers.js"

/**
 * The public HTTP application, independent of the hosting runtime.
 *
 * `apps/theoria/server.ts` serves it with Bun; `apps/theoria/worker.ts`
 * serves it as a Cloudflare Worker. Both provide a `StaticStore` for the
 * built web bundle and a `ConfigProvider` for deployment variables.
 */
export const publicApp = app.pipe(
  HttpMiddleware.xForwardedHeaders,
  securityHeaders
)

/** Fails layer construction when `RELEASE_STAGE` holds an unsupported value. */
const ReleaseStageCheck = Layer.effectDiscard(serverReleaseStage)

export const AppLayer = Layer.mergeAll(
  ExecutionPolicyLive,
  ParticipantsLive,
  DemoRateLimiterLive,
  DspProviderRuntimeLive,
  PackageVersionsLive,
  DocsCatalogLive,
  ProgramSourcesLive,
  RuntimeInfoLive,
  ReleaseStageCheck
)
