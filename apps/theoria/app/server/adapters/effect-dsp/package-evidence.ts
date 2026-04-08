import { Array as Arr, Effect, Schema } from "effect"

import * as Contracts from "effect-dsp/contracts"
import * as Optimizer from "effect-dsp/Optimizer"
import type * as Trace from "effect-dsp/Trace"

import type { EvidenceSection } from "../../../contracts/evidence/item.js"

const encodeUnknownJson = Schema.encodeSync(Schema.parseJson(Schema.Unknown))

const truncate = (value: string, max: number): string => value.length > max ? `${value.slice(0, max)}...` : value

const projectionOutput = (projection: Contracts.OptimizationObjectiveSurface): string =>
  truncate(encodeUnknownJson(projection.output), 120)

const projectionPrompt = (projection: Contracts.OptimizationObjectiveSurface): string =>
  truncate(projection.prompt, 120)

const projectionResponse = (projection: Contracts.OptimizationObjectiveSurface): string =>
  truncate(projection.rawResponse, 120)

export type DspEvaluationEvidence = {
  readonly projections: ReadonlyArray<Contracts.OptimizationObjectiveSurface>
  readonly usage: Contracts.Usage
}

export type DspOptimizationEventEvidence = {
  readonly events: ReadonlyArray<Optimizer.BootstrapEvent>
}

export const projectEvaluationEvidence = (options: {
  readonly moduleName: string
  readonly traces: ReadonlyArray<Trace.Entry>
  readonly usage: Contracts.Usage
}) =>
  Effect.forEach(
    Arr.filter(options.traces, (trace) => trace.moduleName === options.moduleName),
    Contracts.projectOptimizationObjective
  ).pipe(Effect.map((projections) => ({ projections, usage: options.usage })))

export const evaluationEvidenceSection = (options: {
  readonly evidence: DspEvaluationEvidence
  readonly label: string
}): EvidenceSection => ({
  title: `${options.label} Trace Evidence`,
  items: [
    {
      _tag: "Scalar",
      label: "Input tokens",
      value: options.evidence.usage.inputTokens,
      unit: "tokens",
      format: "integer"
    },
    {
      _tag: "Scalar",
      label: "Output tokens",
      value: options.evidence.usage.outputTokens,
      unit: "tokens",
      format: "integer"
    },
    {
      _tag: "Scalar",
      label: "Total tokens",
      value: options.evidence.usage.inputTokens + options.evidence.usage.outputTokens,
      unit: "tokens",
      format: "integer"
    },
    {
      _tag: "Scalar",
      label: "LM calls",
      value: options.evidence.usage.callCount,
      unit: "calls",
      format: "integer"
    },
    {
      _tag: "Table",
      label: "Trace objective projections",
      columns: ["#", "Prompt", "Raw response", "Parsed output", "Tokens", "Duration (ms)"],
      rows: Arr.map(options.evidence.projections, (projection, index) => [
        `${index + 1}`,
        projectionPrompt(projection),
        projectionResponse(projection),
        projectionOutput(projection),
        `${projection.totalTokens}`,
        projection.durationMs.toFixed(0)
      ])
    }
  ]
})

export const optimizationEventSection = (evidence: DspOptimizationEventEvidence): EvidenceSection => ({
  title: "Optimizer Event Evidence",
  items: [
    {
      _tag: "Scalar",
      label: "Event count",
      value: evidence.events.length,
      unit: "events",
      format: "integer"
    },
    {
      _tag: "Table",
      label: "BootstrapFewShot lifecycle",
      columns: ["#", "Event", "Details"],
      rows: Arr.map(evidence.events, (event, index) => {
        const formatted = Optimizer.formatBootstrapEvent(event)

        return [`${index + 1}`, formatted.tag, formatted.details]
      })
    }
  ]
})
