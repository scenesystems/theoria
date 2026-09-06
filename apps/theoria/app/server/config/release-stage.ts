import { Config, Schema } from "effect"

import { ReleaseStage } from "../../contracts/release-stage.js"

/**
 * Release stage configuration. Each Wrangler target sets `RELEASE_STAGE`
 * explicitly (see `wrangler.jsonc`); an unset value means a local run and is
 * treated as `preview`. An invalid value fails with a `ConfigError` and the
 * server refuses to start (see `AppLayer`).
 */
export const releaseStageConfig: Config.Config<ReleaseStage> = Schema.Config("RELEASE_STAGE", ReleaseStage).pipe(
  Config.withDefault<ReleaseStage>("preview")
)
