import { Effect } from "effect"
import { Browser, Experimental } from "effect-text"
import * as TextReact from "effect-text/react"

import type { EvidenceSection } from "../../../contracts/evidence.js"

const defaultBrowserProfile = Browser.DefaultBrowserSupportProfile
const browserProfileIds = Browser.BrowserSupportManifest.profiles.map((profile) => profile.id).join(", ")
const whiteSpaceEnvelope = defaultBrowserProfile.whiteSpaceModes.join(", ")

export const consumerProofSection = (): EvidenceSection => ({
  title: "Consumer Proof",
  items: [
    {
      _tag: "Text",
      label: "Generic text path",
      value:
        "web/atoms/text.ts caches prepared handles from effect-text/react prepare identities, then reprojects on width-only changes without calling Text.prepare again."
    },
    {
      _tag: "Text",
      label: "Deep-dive reflow path",
      value:
        "web/atoms/reflow.ts prepares once per corpus entry or custom text, then reuses that handle for width sweeps and obstacle-aware projection."
    },
    {
      _tag: "Text",
      label: "Shared authority",
      value:
        "web/view/text/authority.ts keeps one effectful prepare boundary and one pure prepared-layout projection boundary so the generic and reflow consumers teach the same model."
    },
    {
      _tag: "Text",
      label: "React companion",
      value:
        `effect-text/react remains ${TextReact.ReactStability}: prepare identities plus pure prepared-layout helpers, with no runtime, DOM, or durable app-state ownership.`
    }
  ]
})

export const browserEnvelopeSection = (): EvidenceSection => ({
  title: "Browser Envelope",
  items: [
    {
      _tag: "Scalar",
      label: "Browser profiles",
      value: Browser.BrowserSupportManifest.profiles.length,
      unit: "profiles",
      format: "integer"
    },
    {
      _tag: "Scalar",
      label: "Parity cases",
      value: defaultBrowserProfile.parityCases.length,
      unit: "cases/profile",
      format: "integer"
    },
    {
      _tag: "Scalar",
      label: "Tab columns",
      value: defaultBrowserProfile.tabPolicy.columns,
      unit: "columns",
      format: "integer"
    },
    {
      _tag: "Text",
      label: "Profiles",
      value: `Default ${Browser.BrowserSupportManifest.defaultProfileId}; shipped envelope ${browserProfileIds}.`
    },
    {
      _tag: "Text",
      label: "White-space support",
      value: `${whiteSpaceEnvelope} via package-owned browser support data and engine-profile settings.`
    },
    {
      _tag: "Text",
      label: "Freshness boundary",
      value:
        `effect-text/browser remains ${Browser.BrowserStability}: measurement layers, support data, parity harness helpers, and font-readiness-revision cache freshness stay package-owned.`
    }
  ]
})

export const experimentalLaneSection = (): EvidenceSection => ({
  title: "Experimental Lane",
  items: [
    {
      _tag: "Scalar",
      label: "Experimental seams",
      value: Experimental.ExperimentalSeams.length,
      unit: "seams",
      format: "integer"
    },
    {
      _tag: "Text",
      label: "Calibration evaluation",
      value:
        "Experimental.Calibration.evaluateProfile stays downstream of Text.prepare plus pure layout, so runtime layout remains unchanged while calibration corpora score candidate engine profiles."
    },
    {
      _tag: "Text",
      label: "Optimization lane",
      value:
        "Experimental.Calibration.optimizeProfile composes that evaluation surface with effect-search rather than making the released layout API effectful."
    },
    {
      _tag: "Text",
      label: "Stability",
      value:
        `Experimental remains ${Experimental.ExperimentalStability}, and Calibration remains ${Experimental.Calibration.CalibrationStability}, so tuning work stays visibly downstream of the shipped browser and React companion lanes.`
    }
  ]
})

export const consumerProofSectionEffect = Effect.succeed(consumerProofSection())
export const browserEnvelopeSectionEffect = Effect.succeed(browserEnvelopeSection())
export const experimentalLaneSectionEffect = Effect.succeed(experimentalLaneSection())
