import { Array as Arr, Effect } from "effect"

import * as Contracts from "effect-dsp/contracts"
import type * as Optimizer from "effect-dsp/Optimizer"
import type * as Trace from "effect-dsp/Trace"

import {
  dspEvidenceItemLabels,
  dspEvidenceTitles,
  dspOptimizerEventColumns,
  dspOptimizerEventRow,
  dspTraceEvidenceSectionTitle,
  dspTraceProjectionColumns,
  dspTraceProjectionRow,
  dspUsageTotalTokens
} from "../../../contracts/capability/effect-dsp-runtime-presentation.js"
import type { DspEvaluationPhaseId } from "../../../contracts/capability/effect-dsp-runtime.js"
import type { EvidenceSection } from "../../../contracts/evidence/item.js"

export type DspEvaluationEvidence = {
  readonly phaseId: DspEvaluationPhaseId
  readonly projections: ReadonlyArray<Contracts.OptimizationObjectiveSurface>
  readonly usage: Contracts.Usage
}

export type DspOptimizationEventEvidence = {
  readonly events: ReadonlyArray<Optimizer.BootstrapEvent>
}

export const projectEvaluationEvidence = (options: {
  readonly moduleName: string
  readonly phaseId: DspEvaluationPhaseId
  readonly traces: ReadonlyArray<Trace.Entry>
  readonly usage: Contracts.Usage
}) =>
  Effect.forEach(
    Arr.filter(options.traces, (trace) => trace.moduleName === options.moduleName),
    Contracts.OptimizationObjectiveSurface.fromTraceEntry
  ).pipe(Effect.map((projections) => ({ phaseId: options.phaseId, projections, usage: options.usage })))

export const evaluationEvidenceSection = (options: {
  readonly evidence: DspEvaluationEvidence
}): EvidenceSection => ({
  title: dspTraceEvidenceSectionTitle(options.evidence.phaseId),
  items: [
    {
      _tag: "Scalar",
      label: dspEvidenceItemLabels.inputTokens,
      value: options.evidence.usage.inputTokens,
      unit: "tokens",
      format: "integer"
    },
    {
      _tag: "Scalar",
      label: dspEvidenceItemLabels.outputTokens,
      value: options.evidence.usage.outputTokens,
      unit: "tokens",
      format: "integer"
    },
    {
      _tag: "Scalar",
      label: dspEvidenceItemLabels.totalTokens,
      value: dspUsageTotalTokens(options.evidence.usage),
      unit: "tokens",
      format: "integer"
    },
    {
      _tag: "Scalar",
      label: dspEvidenceItemLabels.lmCalls,
      value: options.evidence.usage.callCount,
      unit: "calls",
      format: "integer"
    },
    {
      _tag: "Table",
      label: dspEvidenceItemLabels.traceObjectiveProjections,
      columns: [...dspTraceProjectionColumns],
      rows: Arr.map(options.evidence.projections, dspTraceProjectionRow)
    }
  ]
})

export const optimizationEventSection = (evidence: DspOptimizationEventEvidence): EvidenceSection => ({
  title: dspEvidenceTitles.optimizerEventEvidence,
  items: [
    {
      _tag: "Scalar",
      label: dspEvidenceItemLabels.eventCount,
      value: evidence.events.length,
      unit: "events",
      format: "integer"
    },
    {
      _tag: "Table",
      label: dspEvidenceItemLabels.bootstrapFewShotLifecycle,
      columns: [...dspOptimizerEventColumns],
      rows: Arr.map(evidence.events, dspOptimizerEventRow)
    }
  ]
})
