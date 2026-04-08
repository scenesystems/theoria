import { Effect } from "effect"
import type { ScoreNormalizationPolicy } from "effect-inference/Contracts"
import { Contracts as TextContracts, Text } from "effect-text"
import * as Browser from "effect-text/Browser"
import * as ReactText from "effect-text/React"

const renderTargetWidthPx = 420
const renderTargetLineHeightPx = 20
const renderTargetAboveFoldHeightPx = 120

const supportProfile = Browser.browserSupportProfile(Browser.BrowserSupportManifest.defaultProfileId)
const fontReadinessRevision = Browser.initialFontReadinessRevision()

const renderFitnessInput = TextContracts.renderFitnessInputFor({
  supportProfileRef: supportProfile.id,
  font: { family: supportProfile.defaultFontFamily, size: 14 },
  fontReadinessRevision,
  tolerancePx: supportProfile.parityTolerancePx,
  targetWidthPx: renderTargetWidthPx,
  lineHeightPx: renderTargetLineHeightPx,
  aboveFoldHeightPx: renderTargetAboveFoldHeightPx
})

export type WorkflowComparisonRenderEvidence = TextContracts.RenderFitnessEvidenceType

export const workflowComparisonRenderNormalization = (): ScoreNormalizationPolicy["renderFitness"] => {
  return TextContracts.renderFitnessNormalizationFor(renderFitnessInput)
}

export const renderEvidenceForText = (
  text: string
): Effect.Effect<WorkflowComparisonRenderEvidence, unknown, never> => {
  return Text.prepareWithSegments({
    text,
    font: { family: supportProfile.defaultFontFamily, size: 14 },
    whiteSpace: supportProfile.defaultWhiteSpaceMode
  }).pipe(
    Effect.provide(Text.TextLayoutLive),
    Effect.map((prepared) =>
      ReactText.projectPreparedLayout(prepared, {
        maxWidth: renderTargetWidthPx,
        lineHeight: renderTargetLineHeightPx
      })
    ),
    Effect.map((projection) => TextContracts.renderFitnessEvidenceFromSummary(renderFitnessInput, projection.summary))
  )
}
