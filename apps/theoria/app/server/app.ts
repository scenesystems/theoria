import { HttpMiddleware } from "@effect/platform"
import { Layer } from "effect"

import { AnalyticsLive } from "./config/analytics.js"
import { DocsManifestStoreLive } from "./config/docs-manifest-store.js"
import { releaseStageConfig } from "./config/release-stage.js"
import { RuntimeInfoLive } from "./config/runtime.js"
import { ParticipantsLive } from "./imagined-place/authority.js"
import { indexingPolicy } from "./indexing-policy.js"
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
  // Innermost first: both policies read the host after proxy headers apply.
  indexingPolicy,
  securityHeaders,
  HttpMiddleware.xForwardedHeaders
)

/** Fails layer construction when `RELEASE_STAGE` holds an unsupported value. */
const ReleaseStageCheck = Layer.effectDiscard(releaseStageConfig)

export const AppLayer = Layer.mergeAll(
  ParticipantsLive,
  DocsManifestStoreLive,
  RuntimeInfoLive,
  AnalyticsLive,
  ReleaseStageCheck
)
