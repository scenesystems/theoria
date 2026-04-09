import {
  DspDatasetEvidenceSection
} from "../../../contracts/capability/effect-dsp-runtime-evidence/dsp-dataset-evidence.js"
import {
  DspEvaluationEvidenceSection
} from "../../../contracts/capability/effect-dsp-runtime-evidence/dsp-evaluation-evidence.js"
import {
  DspOptimizationEvidenceSection
} from "../../../contracts/capability/effect-dsp-runtime-evidence/dsp-optimization-evidence.js"
import {
  DspOutcomeEvidenceSection
} from "../../../contracts/capability/effect-dsp-runtime-evidence/dsp-outcome-evidence.js"
import {
  DspProviderEvidenceSection
} from "../../../contracts/capability/effect-dsp-runtime-evidence/dsp-provider-evidence.js"
import {
  DspScenarioEvidenceSection
} from "../../../contracts/capability/effect-dsp-runtime-evidence/dsp-scenario-evidence.js"
import {
  DspSignatureEvidenceSection
} from "../../../contracts/capability/effect-dsp-runtime-evidence/dsp-signature-evidence.js"
import type { DspModuleType, DspScenarioDefinition } from "../../../contracts/capability/effect-dsp.js"
import type { EvidenceSection } from "../../../contracts/evidence/item.js"

export const scenarioSection = ({
  moduleType,
  optimizationBudget,
  scenario
}: {
  readonly moduleType: DspModuleType
  readonly optimizationBudget: number
  readonly scenario: DspScenarioDefinition
}): EvidenceSection => DspScenarioEvidenceSection.project({ moduleType, optimizationBudget, scenario })

export const signatureSection = (scenario: DspScenarioDefinition): EvidenceSection =>
  DspSignatureEvidenceSection.project(scenario)

export const datasetSection = (scenario: DspScenarioDefinition): EvidenceSection =>
  DspDatasetEvidenceSection.project(scenario)

export const evaluationSection = ({
  phaseId,
  metricName,
  overallScore,
  successCount,
  totalExamples,
  resultRows
}: DspEvaluationEvidenceSection.Shape): EvidenceSection =>
  DspEvaluationEvidenceSection.project({
    phaseId,
    metricName,
    overallScore,
    successCount,
    totalExamples,
    resultRows
  })

export const optimizationSection = ({
  requestedRounds,
  roundsUsed,
  learnedDemos,
  acceptedTraces,
  rejectedTraces,
  fallbackUsed
}: DspOptimizationEvidenceSection.Shape): EvidenceSection =>
  DspOptimizationEvidenceSection.project({
    acceptedTraces,
    fallbackUsed,
    learnedDemos,
    rejectedTraces,
    requestedRounds,
    roundsUsed
  })

export const outcomeSection = ({
  baselineScore,
  optimizedScore,
  improvementDelta,
  learnedDemos
}: DspOutcomeEvidenceSection.Shape): EvidenceSection =>
  DspOutcomeEvidenceSection.project({ baselineScore, improvementDelta, learnedDemos, optimizedScore })

export const providerSection = (
  provider: string,
  model: string,
  durationMs: number
): EvidenceSection => DspProviderEvidenceSection.project({ durationMs, model, provider })
