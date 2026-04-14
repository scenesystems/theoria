import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import * as Browser from "../../src/Browser/index.js"
import { Contracts } from "../../src/index.js"

describe("contracts/render-fitness", () => {
  it.effect("derives stable render-fitness identity, normalization, and evidence from support data", () =>
    Effect.gen(function*() {
      const manifest = yield* Schema.decodeUnknown(Browser.BrowserSupportManifestSchema)(Browser.BrowserSupportManifest)
      const supportProfile = Browser.browserSupportProfile(manifest.defaultProfileId)
      const input = Contracts.renderFitnessInputFor({
        supportProfileRef: supportProfile.id,
        font: { family: supportProfile.defaultFontFamily, size: 14 },
        fontReadinessRevision: Browser.initialFontReadinessRevision(),
        tolerancePx: supportProfile.parityTolerancePx,
        targetWidthPx: 420,
        lineHeightPx: 20,
        aboveFoldHeightPx: 120
      })
      const normalization = Contracts.renderFitnessNormalizationFor(input)
      const evidence = Contracts.renderFitnessEvidenceFromSummary(input, {
        lineCount: 3,
        height: 60,
        maxLineWidth: 400
      })

      expect(normalization.kind).toBe("support-profile-tolerance")
      expect(normalization.supportProfileRef).toBe(supportProfile.id)
      expect(normalization.toleranceRef).toBe(`${supportProfile.id}:${supportProfile.parityTolerancePx}`)
      expect(evidence).toStrictEqual({
        input: {
          supportProfileRef: supportProfile.id,
          fontIdentityRef: `${supportProfile.defaultFontFamily}:14:default`,
          fontReadinessRevision: "0",
          tolerancePx: supportProfile.parityTolerancePx,
          toleranceRef: `${supportProfile.id}:${supportProfile.parityTolerancePx}`,
          targetWidthPx: 420,
          lineHeightPx: 20,
          aboveFoldHeightPx: 120
        },
        totalLineCount: 3,
        visibleLineCount: 3,
        aboveFoldCoverage: 1,
        spillBelowFoldPx: 0,
        widthOverflowPx: 0
      })
    }))
})
