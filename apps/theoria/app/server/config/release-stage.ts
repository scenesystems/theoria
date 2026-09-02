import { Config, Effect, Schema } from "effect"

import { ReleaseStage, releaseStageFromEnvironment } from "../../contracts/release-stage.js"

/**
 * Release stage configuration. An unset `RELEASE_STAGE` falls back to the
 * Railway-era signals; an invalid value is a configuration error and the
 * server refuses to start (see `AppLayer`).
 */
export const releaseStageConfig: Config.Config<ReleaseStage> = Config.all({
  releaseStage: Config.option(Schema.Config("RELEASE_STAGE", ReleaseStage)),
  railwayEnvironmentName: Config.option(Config.string("RAILWAY_ENVIRONMENT_NAME")),
  nodeEnv: Config.option(Config.string("NODE_ENV"))
}).pipe(Config.map(releaseStageFromEnvironment))

export const serverReleaseStage: Effect.Effect<ReleaseStage> = Effect.orDie(releaseStageConfig)
