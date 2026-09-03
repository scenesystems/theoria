import { HttpMiddleware } from "@effect/platform"
import { Layer } from "effect"

import { DocsCatalogLive } from "./config/docs-catalog.js"
import { serverReleaseStage } from "./config/release-stage.js"
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
  // Innermost first: `indexingPolicy` reads the host after proxy headers apply.
  indexingPolicy,
  HttpMiddleware.xForwardedHeaders,
  securityHeaders
)

/** Fails layer construction when `RELEASE_STAGE` holds an unsupported value. */
const ReleaseStageCheck = Layer.effectDiscard(serverReleaseStage)

export const AppLayer = Layer.mergeAll(
  ParticipantsLive,
  DocsCatalogLive,
  RuntimeInfoLive,
  ReleaseStageCheck
)
