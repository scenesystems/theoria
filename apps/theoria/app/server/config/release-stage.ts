import { Config, Effect } from "effect"
import * as Option from "effect/Option"

import { type ReleaseStage, releaseStageFromEnvironment } from "../../contracts/release-stage.js"

export const serverReleaseStage: Effect.Effect<ReleaseStage> = Effect.gen(function*() {
  const railwayEnvironmentName = yield* Config.withDefault(Config.string("RAILWAY_ENVIRONMENT_NAME"), "")
  const nodeEnv = yield* Config.withDefault(Config.string("NODE_ENV"), "")

  return releaseStageFromEnvironment({
    railwayEnvironmentName: Option.some(railwayEnvironmentName),
    nodeEnv: Option.some(nodeEnv)
  })
}).pipe(Effect.orDie)
