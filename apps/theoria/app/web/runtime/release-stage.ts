import { Schema } from "effect"
import * as Option from "effect/Option"

import { ReleaseStage, type ReleaseStage as ReleaseStageType } from "../../contracts/release-stage.js"

const isReleaseStage = Schema.is(ReleaseStage)

const releaseStageDatasetKey = "theoriaReleaseStage"

export const runtimeReleaseStage = (): ReleaseStageType => {
  const raw = typeof document === "undefined"
    ? Option.none<string>()
    : Option.fromNullable(document.documentElement.dataset[releaseStageDatasetKey])

  return Option.match(raw, {
    onNone: () => "preview",
    onSome: (stage) => isReleaseStage(stage) ? stage : "preview"
  })
}
