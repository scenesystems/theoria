import { Effect } from "effect"
import * as Browser from "effect-text/browser"
import * as Experimental from "effect-text/experimental"
import * as TextReact from "effect-text/react"

import type { EvidenceSection } from "../../../contracts/evidence/item.js"

const defaultBrowserProfile = Browser.DefaultBrowserSupportProfile
const browserProfileIds = Browser.BrowserSupportManifest.profiles.map((profile) => profile.id).join(", ")
const whiteSpaceEnvelope = defaultBrowserProfile.whiteSpaceModes.join(", ")

export const consumerProofSection = (): EvidenceSection => ({
  title: "React Surface",
  items: [
    {
      _tag: "Text",
      label: "Prepared handles",
      value:
        "effect-text/react gives the app a stable prepare identity and pure projection helpers, so width-only changes can reuse prepared text instead of preparing again."
    },
    {
      _tag: "Text",
      label: "Reflow surface",
      value:
        "The reflow surface prepares a corpus entry or custom text once, then reprojects that handle across viewport widths and obstacle layouts."
    },
    {
      _tag: "Text",
      label: "Shared boundary",
      value:
        "The app keeps one effectful browser prepare boundary and one pure projection boundary so text surfaces can share the same runtime contract."
    },
    {
      _tag: "Text",
      label: "Shipped surface",
      value:
        `effect-text/react is ${TextReact.ReactStability}: identity and projection helpers only, with runtime, DOM observation, and app state still owned by the app.`
    }
  ]
})

export const browserEnvelopeSection = (): EvidenceSection => ({
  title: "Browser Surface",
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
      value: `Default ${Browser.BrowserSupportManifest.defaultProfileId}; available profiles ${browserProfileIds}.`
    },
    {
      _tag: "Text",
      label: "White-space modes",
      value: `${whiteSpaceEnvelope} through the shipped browser support manifest and engine profile data.`
    },
    {
      _tag: "Text",
      label: "Measurement runtime",
      value:
        `effect-text/browser is ${Browser.BrowserStability}: it owns browser measurement layers, support data, parity helpers, and font-readiness cache freshness.`
    }
  ]
})

export const experimentalLaneSection = (): EvidenceSection => ({
  title: "Calibration",
  items: [
    {
      _tag: "Scalar",
      label: "Calibration seams",
      value: Experimental.ExperimentalSeams.length,
      unit: "seams",
      format: "integer"
    },
    {
      _tag: "Text",
      label: "Evaluation",
      value:
        "Calibration evaluates candidate engine profiles on top of prepared text and pure layout, without changing the runtime layout path that the app uses."
    },
    {
      _tag: "Text",
      label: "Optimization",
      value:
        "Optimization composes that evaluation surface with effect-search, so tuning stays separate from the released layout API."
    },
    {
      _tag: "Text",
      label: "Stability",
      value:
        `Experimental is ${Experimental.ExperimentalStability}, and Calibration is ${Experimental.Calibration.CalibrationStability}, so tuning stays downstream of the browser and React surfaces the app uses today.`
    }
  ]
})

export const consumerProofSectionEffect = Effect.succeed(consumerProofSection())
export const browserEnvelopeSectionEffect = Effect.succeed(browserEnvelopeSection())
export const experimentalLaneSectionEffect = Effect.succeed(experimentalLaneSection())
