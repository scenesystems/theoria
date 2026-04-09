import { Match, Schema } from "effect"
import type { OptimizationObjectiveSurface, Usage } from "effect-dsp/contracts"
import { type BootstrapEvent, BootstrapProgressLine } from "effect-dsp/Optimizer"

import type { DspEvaluationPhaseId, DspStageId } from "./effect-dsp-runtime.js"

const encodeUnknownJson = Schema.encodeSync(Schema.parseJson(Schema.Unknown))

const truncate = (value: string, max: number): string => value.length > max ? `${value.slice(0, max)}...` : value

export const dspEvidenceTitles = {
  optimization: "Optimization",
  optimizationOutcome: "Optimization Outcome",
  optimizerEventEvidence: "Optimizer Event Evidence",
  provider: "Provider",
  scenario: "Scenario",
  signatureContract: "Signature Contract"
}

export const dspEvidenceItemLabels = {
  acceptedTraces: "Accepted traces",
  baselineScore: "Baseline score",
  bootstrapFewShotLifecycle: "BootstrapFewShot lifecycle",
  eventCount: "Event count",
  evaluationExamples: "Evaluation examples",
  fallback: "Fallback",
  fieldCount: "Field count",
  improvement: "Improvement",
  inputFields: "Input fields",
  inputTokens: "Input tokens",
  invariant: "Invariant",
  instruction: "Instruction",
  learnedExamples: "Learned examples",
  lmCalls: "LM calls",
  metric: "Metric",
  model: "Model",
  moduleType: "Module type",
  optimizationBudget: "Optimization budget",
  optimizedScore: "Optimized score",
  outputFields: "Output fields",
  outputTokens: "Output tokens",
  perExampleResults: "Per-example results",
  provider: "Provider",
  rejectedTraces: "Rejected traces",
  requestedRounds: "Requested rounds",
  roundsUsed: "Rounds used",
  scenario: "Scenario",
  summary: "Summary",
  successes: "Successes",
  totalDuration: "Total duration",
  totalTokens: "Total tokens",
  traceObjectiveProjections: "Trace objective projections"
}

export const dspTraceProjectionColumns = ["#", "Prompt", "Raw response", "Parsed output", "Tokens", "Duration (ms)"]

export const dspOptimizerEventColumns = ["#", "Event", "Details"]

export const dspPerExampleResultColumns = ["#", "Score", "Duration (ms)"]

export const dspEvaluationSectionTitle = (phaseId: DspEvaluationPhaseId): string =>
  Match.value(phaseId).pipe(
    Match.when("baseline", () => "Baseline Evaluation"),
    Match.when("optimized", () => "Optimized Evaluation"),
    Match.exhaustive
  )

export const dspTraceEvidenceSectionTitle = (phaseId: DspEvaluationPhaseId): string =>
  `${dspEvaluationSectionTitle(phaseId)} Trace Evidence`

export const dspEvaluationDatasetTitle = (exampleCount: number): string =>
  `Evaluation Dataset — ${exampleCount} examples`

export const dspEvaluationSummary = ({
  metricName,
  overallScore,
  phaseId,
  successCount,
  totalExamples
}: {
  readonly metricName: string
  readonly overallScore: number
  readonly phaseId: DspEvaluationPhaseId
  readonly successCount: number
  readonly totalExamples: number
}): string =>
  Match.value(phaseId).pipe(
    Match.when(
      "baseline",
      () =>
        `Baseline evaluation scored ${metricName} at ${
          overallScore.toFixed(3)
        } across ${successCount}/${totalExamples} examples on the frozen dataset.`
    ),
    Match.when(
      "optimized",
      () =>
        `Optimized evaluation rescored the same dataset at ${
          overallScore.toFixed(3)
        } ${metricName} across ${successCount}/${totalExamples} examples.`
    ),
    Match.exhaustive
  )

export const dspRunSummary =
  "effect-dsp froze the approved DSP manifest, evaluated a typed module, optimized study variants, and re-evaluated the same scenario under shared runtime authority."

export const dspStageDetail = (stageId: DspStageId): string =>
  Match.value(stageId).pipe(
    Match.when("signature", () =>
      "The server is freezing the scenario contract and module shape into shared runtime authority."),
    Match.when("baseline", () =>
      "The frozen module is being scored against the labeled scenario dataset."),
    Match.when("optimizing", () =>
      "BootstrapFewShot is learning study examples without letting idle controls rewrite the run."),
    Match.when("optimized-eval", () =>
      "The optimized module is being scored against the same dataset for a clean final pass."),
    Match.when("outcome", () =>
      "The widget and evidence now converge on the same final DSP metrics."),
    Match.exhaustive
  )

export const dspStageLabel = (stageId: DspStageId): string =>
  Match.value(stageId).pipe(
    Match.when("signature", () => "Signature"),
    Match.when("baseline", () => "Baseline evaluation"),
    Match.when("optimizing", () => dspEvidenceTitles.optimization),
    Match.when("optimized-eval", () => "Optimized evaluation"),
    Match.when("outcome", () => "Outcome"),
    Match.exhaustive
  )

export const dspMetricScoreLabel = (metricName: string): string => `${metricName} score`

export const dspFallbackText = (fallbackUsed: boolean): string =>
  fallbackUsed
    ? "Labeled study examples supplied the fallback set."
    : "Teacher bootstrapping supplied the learned examples."

export const dspUsageTotalTokens = (usage: {
  readonly inputTokens: Usage["inputTokens"]
  readonly outputTokens: Usage["outputTokens"]
}): number => usage.inputTokens + usage.outputTokens

export const dspTraceProjectionRow = (
  projection: OptimizationObjectiveSurface,
  index: number
): ReadonlyArray<string> => [
  `${index + 1}`,
  truncate(projection.prompt, 120),
  truncate(projection.rawResponse, 120),
  truncate(encodeUnknownJson(projection.output), 120),
  `${projection.totalTokens}`,
  projection.durationMs.toFixed(0)
]

export const dspOptimizerEventRow = (event: BootstrapEvent, index: number): ReadonlyArray<string> => {
  const formatted = BootstrapProgressLine.project(event)

  return [`${index + 1}`, formatted.tag, formatted.details]
}
