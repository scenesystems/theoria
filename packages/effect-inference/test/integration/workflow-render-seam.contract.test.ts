import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"

import { Contracts as TextContracts } from "effect-text"
import * as Browser from "effect-text/Browser"
import * as ReactText from "effect-text/React"

import * as Contracts from "../../src/contracts/index.js"

import { renderSensitiveProfile } from "./workflowFixtures.js"

describe("integration/workflow-render-seam", () => {
  it.effect("pins render-fitness normalization to stable effect-text support and projection identities", () =>
    Effect.gen(function*() {
      const manifest = yield* Schema.decodeUnknown(Browser.BrowserSupportManifestSchema)(Browser.BrowserSupportManifest)
      const supportProfile = Browser.browserSupportProfile(manifest.defaultProfileId)
      const baseProfile = yield* Schema.decodeUnknown(Contracts.ScoreProfileSchema)(renderSensitiveProfile)
      const prepareIdentity = ReactText.prepareIdentityFor({
        prepare: {
          text: "Rendered workflow answer",
          font: { family: supportProfile.defaultFontFamily, size: 14 },
          whiteSpace: supportProfile.defaultWhiteSpaceMode
        },
        engineProfile: supportProfile.engineProfile,
        supportProfileId: supportProfile.id,
        fontReadinessRevision: Browser.initialFontReadinessRevision()
      })
      const renderFitnessInput = TextContracts.renderFitnessInputFor({
        supportProfileRef: supportProfile.id,
        font: Option.fromNullable(prepareIdentity.font.weight).pipe(
          Option.match({
            onNone: () => ({
              family: prepareIdentity.font.family,
              size: prepareIdentity.font.size
            }),
            onSome: (weight) => ({
              family: prepareIdentity.font.family,
              size: prepareIdentity.font.size,
              weight
            })
          })
        ),
        fontReadinessRevision: prepareIdentity.fontReadinessRevision,
        tolerancePx: supportProfile.parityTolerancePx,
        targetWidthPx: 420,
        lineHeightPx: 20,
        aboveFoldHeightPx: 120
      })
      const projection = yield* Schema.decodeUnknown(ReactText.PreparedLayoutProjection)({
        summary: {
          lineCount: 1,
          height: 20,
          maxLineWidth: 144
        },
        lines: [
          {
            index: 0,
            order: "visual",
            baseDirection: "ltr",
            text: "Rendered workflow answer",
            width: 144
          }
        ]
      })
      const profile = yield* Schema.decodeUnknown(Contracts.ScoreProfileSchema)({
        ...baseProfile,
        normalization: {
          ...baseProfile.normalization,
          renderFitness: TextContracts.renderFitnessNormalizationFor(renderFitnessInput)
        }
      })
      const evidence = TextContracts.renderFitnessEvidenceFromSummary(renderFitnessInput, projection.summary)

      expect(projection.summary.lineCount).toBe(1)
      expect(profile.normalization.renderFitness.supportProfileRef).toBe(renderFitnessInput.supportProfileRef)
      expect(profile.normalization.renderFitness.fontIdentityRef).toBe(renderFitnessInput.fontIdentityRef)
      expect(profile.normalization.renderFitness.fontReadinessRevision).toBe(
        renderFitnessInput.fontReadinessRevision
      )
      expect(profile.normalization.renderFitness.toleranceRef).toBe(renderFitnessInput.toleranceRef)
      expect(evidence.input.toleranceRef).toBe(renderFitnessInput.toleranceRef)
      expect(evidence.widthOverflowPx).toBe(0)
    }))
})
