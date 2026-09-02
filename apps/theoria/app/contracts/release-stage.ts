import { Schema } from "effect"
import * as Option from "effect/Option"

/**
 * Which surface a deployment presents. `production` shows only the package
 * catalog; `preview` additionally enables demo pages and demo API routes.
 */
export const ReleaseStage = Schema.Literal("preview", "production")

export type ReleaseStage = typeof ReleaseStage.Type

const normalized = (raw: Option.Option<string>): Option.Option<string> =>
  raw.pipe(
    Option.map((value) => value.trim().toLowerCase()),
    Option.filter((value) => value.length > 0)
  )

/**
 * Resolves the release stage from deployment configuration.
 *
 * `RELEASE_STAGE` is authoritative when set. The remaining inputs keep the
 * Railway deployment working until it is decommissioned: a Railway environment
 * literally named `production`, or `NODE_ENV=production`, selects production.
 */
export const releaseStageFromEnvironment = ({
  nodeEnv,
  railwayEnvironmentName,
  releaseStage
}: {
  readonly releaseStage: Option.Option<ReleaseStage>
  readonly railwayEnvironmentName: Option.Option<string>
  readonly nodeEnv: Option.Option<string>
}): ReleaseStage =>
  Option.getOrElse(releaseStage, () =>
    Option.getOrNull(normalized(railwayEnvironmentName)) === "production"
      || Option.getOrNull(normalized(nodeEnv)) === "production"
      ? "production"
      : "preview")
