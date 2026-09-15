/**
 * Renders the synthetic canvas scenarios used to detect changes in line-walker
 * behavior. These artifacts contain fixed widths and make no browser-accuracy
 * claim.
 *
 * Run with `bun run packages/effect-text/examples/06-synthetic-regression-artifacts.ts`.
 */
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect, Schema } from "effect"

import * as Browser from "@scenesystems/effect-text/browser"

class SyntheticRegressionReport extends Schema.Class<SyntheticRegressionReport>(
  "effect-text/SyntheticRegressionReport"
)({
  artifact: Browser.BrowserParityArtifactSchema,
  artifactPath: Schema.String,
  profile: Browser.BrowserSupportProfileSchema
}) {}

const renderProfileReport = (profile: Browser.BrowserSupportProfileType) =>
  Browser.renderBrowserParityArtifact(profile).pipe(
    Effect.map((artifact) =>
      new SyntheticRegressionReport({
        artifact,
        artifactPath: Browser.browserParityArtifactRelativePath(profile.id),
        profile
      })
    )
  )

const program = Effect.gen(function*() {
  const reports = yield* Effect.forEach(Browser.BrowserSupportManifest.profiles, renderProfileReport)

  yield* Effect.log("effect-text synthetic regression artifacts", {
    defaultProfileId: Browser.BrowserSupportManifest.defaultProfileId,
    reports
  })
}).pipe(Effect.provide(BunContext.layer))

BunRuntime.runMain(program)
