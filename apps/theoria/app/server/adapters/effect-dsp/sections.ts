import * as Arr from "effect/Array"

import type { DspModuleType, DspScenarioDefinition } from "../../../contracts/capability/effect-dsp.js"
import type { EvidenceSection } from "../../../contracts/evidence/item.js"

type EvaluationSectionInput = {
  readonly label: string
  readonly metricName: string
  readonly overallScore: number
  readonly successCount: number
  readonly totalExamples: number
  readonly resultRows: ReadonlyArray<ReadonlyArray<string>>
}

type OptimizationSectionInput = {
  readonly requestedRounds: number
  readonly roundsUsed: number
  readonly learnedDemos: number
  readonly acceptedTraces: number
  readonly rejectedTraces: number
  readonly fallbackUsed: boolean
}

type ComparisonSectionInput = {
  readonly baselineScore: number
  readonly optimizedScore: number
  readonly improvementDelta: number
  readonly learnedDemos: number
}

const truncate = (value: string, max: number): string => value.length > max ? `${value.slice(0, max)}...` : value

export const scenarioSection = ({
  moduleType,
  optimizationBudget,
  scenario
}: {
  readonly moduleType: DspModuleType
  readonly optimizationBudget: number
  readonly scenario: DspScenarioDefinition
}): EvidenceSection => ({
  title: "Scenario",
  items: [
    { _tag: "Text", label: "Scenario", value: scenario.label },
    { _tag: "Text", label: "Invariant", value: `${scenario.invariant} — ${scenario.invariantDescription}` },
    { _tag: "Text", label: "Module type", value: moduleType },
    {
      _tag: "Scalar",
      label: "Optimization budget",
      value: optimizationBudget,
      unit: "rounds",
      format: "integer"
    },
    { _tag: "Text", label: "Metric", value: `${scenario.metricName} — ${scenario.metricDescription}` }
  ]
})

export const signatureSection = (scenario: DspScenarioDefinition): EvidenceSection => ({
  title: "Signature Contract",
  items: [
    { _tag: "Text", label: "Instruction", value: scenario.contract.instruction },
    {
      _tag: "Text",
      label: "Input fields",
      value: Arr.map(scenario.contract.inputFields, (field) => field.name).join(", ")
    },
    {
      _tag: "Text",
      label: "Output fields",
      value: Arr.map(scenario.contract.outputFields, (field) => field.name).join(", ")
    },
    {
      _tag: "Scalar",
      label: "Field count",
      value: scenario.contract.inputFields.length + scenario.contract.outputFields.length,
      unit: "fields",
      format: "integer"
    }
  ]
})

export const datasetSection = (scenario: DspScenarioDefinition): EvidenceSection => ({
  title: `Evaluation Dataset — ${scenario.examples.length} examples`,
  items: [{
    _tag: "Table",
    label: "Evaluation examples",
    columns: [
      "#",
      ...Arr.map(scenario.contract.inputFields, (field) => field.name),
      ...Arr.map(scenario.contract.outputFields, (field) => `→ ${field.name}`)
    ],
    rows: Arr.map(scenario.examples, (example, index) => [
      `${index + 1}`,
      ...Arr.map(scenario.contract.inputFields, (field) => truncate(example.input[field.name] ?? "", 80)),
      ...Arr.map(scenario.contract.outputFields, (field) => truncate(example.expected[field.name] ?? "", 80))
    ])
  }]
})

export const evaluationSection = ({
  label,
  metricName,
  overallScore,
  successCount,
  totalExamples,
  resultRows
}: EvaluationSectionInput): EvidenceSection => ({
  title: label,
  items: [
    {
      _tag: "Scalar",
      label: `${metricName} score`,
      value: overallScore,
      unit: "",
      format: "fixed"
    },
    {
      _tag: "Scalar",
      label: "Successes",
      value: successCount,
      unit: `/ ${totalExamples}`,
      format: "integer"
    },
    {
      _tag: "Table",
      label: "Per-example results",
      columns: ["#", "Score", "Duration (ms)"],
      rows: resultRows
    }
  ]
})

export const optimizationSection = ({
  requestedRounds,
  roundsUsed,
  learnedDemos,
  acceptedTraces,
  rejectedTraces,
  fallbackUsed
}: OptimizationSectionInput): EvidenceSection => ({
  title: "Optimization",
  items: [
    {
      _tag: "Scalar",
      label: "Requested rounds",
      value: requestedRounds,
      unit: "rounds",
      format: "integer"
    },
    {
      _tag: "Scalar",
      label: "Rounds used",
      value: roundsUsed,
      unit: "rounds",
      format: "integer"
    },
    {
      _tag: "Scalar",
      label: "Learned demos",
      value: learnedDemos,
      unit: "demos",
      format: "integer"
    },
    {
      _tag: "Scalar",
      label: "Accepted traces",
      value: acceptedTraces,
      unit: "traces",
      format: "integer"
    },
    {
      _tag: "Scalar",
      label: "Rejected traces",
      value: rejectedTraces,
      unit: "traces",
      format: "integer"
    },
    {
      _tag: "Text",
      label: "Fallback",
      value: fallbackUsed ? "Labeled few-shot fallback activated." : "Teacher bootstrapping supplied the demos."
    }
  ]
})

export const comparisonSection = ({
  baselineScore,
  optimizedScore,
  improvementDelta,
  learnedDemos
}: ComparisonSectionInput): EvidenceSection => ({
  title: "Optimization Comparison",
  items: [
    {
      _tag: "Scalar",
      label: "Baseline score",
      value: baselineScore,
      unit: "",
      format: "fixed"
    },
    {
      _tag: "Scalar",
      label: "Optimized score",
      value: optimizedScore,
      unit: "",
      format: "fixed"
    },
    {
      _tag: "Scalar",
      label: "Improvement",
      value: improvementDelta,
      unit: "",
      format: "fixed"
    },
    {
      _tag: "Scalar",
      label: "Demos learned",
      value: learnedDemos,
      unit: "demos",
      format: "integer"
    }
  ]
})

export const providerSection = (
  provider: string,
  model: string,
  durationMs: number
): EvidenceSection => ({
  title: "Provider",
  items: [
    { _tag: "Text", label: "Provider", value: provider },
    { _tag: "Text", label: "Model", value: model },
    { _tag: "Scalar", label: "Total duration", value: durationMs, unit: "ms", format: "fixed" }
  ]
})
