/**
 * Live Browser Parity — package-owned browser envelope proof.
 *
 * What this shows: the shipped browser support manifest, checked-in browser
 * parity cases, and machine-readable artifacts all describe one browser story.
 *
 * Feature Type Links:
 * - {@link Browser.BrowserSupportManifest}
 * - {@link Browser.browserSupportProfile}
 * - {@link Browser.BrowserMeasurementCacheLive}
 * - {@link Browser.CanvasTextMeasurerLive}
 *
 * Run: bun run packages/effect-text/examples/06-live-browser-parity.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { BunContext } from "@effect/platform-bun"
import { Effect } from "effect"

import { Browser, Text } from "effect-text"

import {
  browserAccuracyArtifactRelativePath,
  browserAccuracyCasesForProfile,
  browserAccuracyLayer
} from "./live/browserAccuracyFixtures.js"

const renderProfileReport = (profile: Browser.BrowserSupportProfileType) =>
  Effect.gen(function*() {
    const cases = yield* Effect.forEach(browserAccuracyCasesForProfile(profile), (entry) =>
      Text.prepareWithSegments(entry.prepare).pipe(
        Effect.provide(browserAccuracyLayer(profile)),
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
      whiteSpaceModes: profile.whiteSpaceModes,
      tabPolicy: profile.tabPolicy,
      parityCases: profile.parityCases,
      caveats: profile.caveats,
      accuracyArtifact: browserAccuracyArtifactRelativePath(profile.id),
      cases
    }
  })

const program = Effect.gen(function*() {
  const reports = yield* Effect.forEach(Browser.BrowserSupportManifest.profiles, renderProfileReport)

  yield* Effect.log("effect-text live browser parity", {
    defaultProfileId: Browser.BrowserSupportManifest.defaultProfileId,
    reports
  })
}).pipe(Effect.provide(BunContext.layer))

BunRuntime.runMain(program)
