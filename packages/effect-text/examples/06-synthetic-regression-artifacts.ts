/**
 * Renders the synthetic canvas scenarios used to detect changes in line-walker
 * behavior. These artifacts contain fixed widths and make no browser-accuracy
 * claim.
 *
 * Run with `bun run packages/effect-text/examples/06-synthetic-regression-artifacts.ts`.
 */
import { BunRuntime } from "@effect/platform-bun"
import { BunContext } from "@effect/platform-bun"
import { Effect } from "effect"

import { Text } from "@scenesystems/effect-text"
import {
  browserParityArtifactRelativePath,
  browserParityCasesForProfile,
  browserParityLayer,
  BrowserSupportManifest,
  type BrowserSupportProfileType
} from "@scenesystems/effect-text/browser"

const renderProfileReport = (profile: BrowserSupportProfileType) =>
  Effect.gen(function*() {
    const cases = yield* Effect.forEach(browserParityCasesForProfile(profile), (entry) =>
      Text.prepareWithSegments(entry.prepare).pipe(
        Effect.provide(browserParityLayer(profile)),
        Effect.map((prepared) => ({
          caseId: entry.caseId,
          request: entry.request,
          summary: Text.layout(prepared, entry.request),
          lines: Text.layoutLines(prepared, entry.request)
        }))
      ))

    return {
      profileId: profile.id,
      defaultFontFamily: profile.defaultFontFamily,
      fontSelection: profile.fontSelection,
      fontStack: profile.fontStack,
      parityTolerancePx: profile.parityTolerancePx,
      whiteSpaceModes: profile.whiteSpaceModes,
      tabPolicy: profile.tabPolicy,
      parityCases: profile.parityCases,
      caveats: profile.caveats,
      regressionArtifact: browserParityArtifactRelativePath(profile.id),
      cases
    }
  })

const program = Effect.gen(function*() {
  const reports = yield* Effect.forEach(BrowserSupportManifest.profiles, renderProfileReport)

  yield* Effect.log("effect-text synthetic regression artifacts", {
    defaultProfileId: BrowserSupportManifest.defaultProfileId,
    reports
  })
}).pipe(Effect.provide(BunContext.layer))

BunRuntime.runMain(program)
