import { Schema } from "effect"
import * as Option from "effect/Option"

export const ReleaseStage = Schema.Literal("preview", "production")

export type ReleaseStage = typeof ReleaseStage.Type

const normalized = (raw: Option.Option<string>): Option.Option<string> =>
  raw.pipe(
    Option.map((value) => value.trim().toLowerCase()),
    Option.filter((value) => value.length > 0)
  )

export const releaseStageFromEnvironment = ({
  railwayEnvironmentName,
  nodeEnv
}: {
  readonly railwayEnvironmentName: Option.Option<string>
  readonly nodeEnv: Option.Option<string>
}): ReleaseStage => {
  const railway = Option.getOrNull(normalized(railwayEnvironmentName))
  const runtime = Option.getOrNull(normalized(nodeEnv))

  return railway === "production"
    ? "production"
    : runtime === "production"
    ? "production"
    : "preview"
}
