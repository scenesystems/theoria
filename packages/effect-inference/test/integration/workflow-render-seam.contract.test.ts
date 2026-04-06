import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import * as Browser from "effect-text/Browser"
import * as ReactText from "effect-text/React"

import * as Contracts from "../../src/contracts/index.js"

import { renderSensitiveProfile } from "./workflowFixtures.js"

const fontIdentityRef = (identity: ReactText.PrepareIdentityType): string =>
  `${identity.font.family}:${identity.font.size}:${identity.font.weight ?? "default"}`

const toleranceRef = (profile: Browser.BrowserSupportProfileType): string =>
  `${profile.id}:${profile.parityTolerancePx}`

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
          renderFitness: {
            kind: "support-profile-tolerance",
            direction: "higher-is-better",
            supportProfileRef: supportProfile.id,
            fontIdentityRef: fontIdentityRef(prepareIdentity),
            fontReadinessRevision: String(prepareIdentity.fontReadinessRevision),
            toleranceRef: toleranceRef(supportProfile)
          }
        }
      })

      expect(projection.summary.lineCount).toBe(1)
      expect(profile.normalization.renderFitness.supportProfileRef).toBe(supportProfile.id)
      expect(profile.normalization.renderFitness.fontIdentityRef).toBe(fontIdentityRef(prepareIdentity))
      expect(profile.normalization.renderFitness.fontReadinessRevision).toBe(
        String(prepareIdentity.fontReadinessRevision)
      )
      expect(profile.normalization.renderFitness.toleranceRef).toBe(toleranceRef(supportProfile))
    }))
})
