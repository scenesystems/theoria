import { Schema } from "effect"

/**
 * Which audience a deployment serves. `production` is the indexed public site
 * at `theoria.scenesystems.io`; `preview` marks staging and pull request
 * previews, which the server tells crawlers not to index.
 */
export const ReleaseStage = Schema.Literal("preview", "production")

export type ReleaseStage = typeof ReleaseStage.Type
