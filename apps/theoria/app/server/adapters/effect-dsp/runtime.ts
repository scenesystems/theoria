import { Clock, Effect, Ref, Stream } from "effect"
import * as Trace from "effect-dsp/Trace"

import { Evaluate, Optimizer } from "effect-dsp"
import * as Contracts from "effect-dsp/contracts"

import type { DspEvaluationPhaseId } from "../../../contracts/capability/effect-dsp-runtime.js"
import {
  defaultDspModuleType,
  defaultDspScenarioId,
  defaultOptimizationBudget,
  type DspModuleType,
  type DspScenarioDefinition,
  type DspScenarioId
} from "../../../contracts/capability/effect-dsp.js"
import { effectDspEntryDescriptor } from "../../../contracts/entry/descriptors/effect-dsp.js"
import type { StreamManifest } from "../../../contracts/evidence/manifest.js"

import type { DspProviderRuntime } from "../../capability/effect-dsp.js"
import {
  buildSignatureAndModule,
  metricForScenario,
  resolveProvider,
  resolveScenario,
  scenarioExamples
} from "./execution-preparation.js"
import {
  type DspEvaluationEvidence,
  type DspOptimizationEventEvidence,
  projectEvaluationEvidence
} from "./package-evidence.js"

export type DspRunRequest = {
  readonly scenarioId: DspScenarioId
  readonly moduleType: DspModuleType
  readonly optimizationBudget: number
}

export const defaultDspRunRequest: DspRunRequest = {
  scenarioId: defaultDspScenarioId,
  moduleType: defaultDspModuleType,
  optimizationBudget: defaultOptimizationBudget
}

export const requestFromManifest = (manifest: StreamManifest | null): DspRunRequest =>
  manifest !== null && manifest._tag === effectDspEntryDescriptor.entryId
    ? {
      scenarioId: manifest.scenarioId,
      moduleType: manifest.moduleType,
      optimizationBudget: manifest.optimizationBudget
    }
    : defaultDspRunRequest

export type DspEvaluationReport = {
  readonly overallScores: Readonly<Record<string, number>>
  readonly results: ReadonlyArray<{
    readonly index: number
    readonly scores: Readonly<Record<string, number>>
    readonly durationMs: number
  }>
  readonly totalExamples: number
  readonly successCount: number
}

export type DspOptimizationSummary = {
  readonly fallbackUsed: boolean
  readonly learnedDemos: number
  readonly roundsUsed: number
  readonly traceAcceptedCount: number
  readonly traceRejectedCount: number
}

export type DspEvaluationPhase = {
  readonly report: DspEvaluationReport
  readonly evidence: DspEvaluationEvidence
}

export type DspOptimizationPhase = {
  readonly summary: DspOptimizationSummary
  readonly evidence: DspOptimizationEventEvidence
}

export type DspExecutionStory = {
  readonly request: DspRunRequest
  readonly scenario: DspScenarioDefinition
  readonly provider: string
  readonly model: string
  readonly durationMs: number
  readonly baselineReport: DspEvaluationReport
  readonly baselineEvidence: DspEvaluationEvidence
  readonly optimizedReport: DspEvaluationReport
  readonly optimizedEvidence: DspEvaluationEvidence
  readonly baselineScore: number
  readonly optimizedScore: number
  readonly optimization: DspOptimizationSummary
  readonly optimizationEvidence: DspOptimizationEventEvidence
}

const toUsage = (usage: {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly callCount: number
  readonly cachedCount: number
}): Contracts.Usage =>
  Contracts.Usage.make({
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    callCount: usage.callCount,
    cachedCount: usage.cachedCount
  })

const runEvaluationPhase = ({
  ctx,
  phaseId
}: {
  readonly ctx: DspExecutionContext
  readonly phaseId: DspEvaluationPhaseId
}) =>
  Trace.withUsageTracking(
    Trace.withTracing(
      Evaluate.run({
        module: ctx.module,
        examples: ctx.examples,
        metrics: ctx.metrics,
        concurrency: 1
      }).pipe(Effect.provide(ctx.layer))
    )
  ).pipe(
    Effect.flatMap((execution) =>
      projectEvaluationEvidence({
        moduleName: ctx.module.name,
        phaseId,
        traces: execution[0][1],
        usage: toUsage(execution[1])
      }).pipe(Effect.map((evidence) => ({ report: execution[0][0], evidence })))
    )
  )

export const reportScore = (metricName: string, report: DspEvaluationReport): number =>
  report.overallScores[metricName] ?? 0

export const prepareExecution = (request: DspRunRequest) =>
  Effect.gen(function*() {
    const scenario = resolveScenario(request.scenarioId)
    const { layer, model, provider } = yield* resolveProvider
    const module = yield* buildSignatureAndModule(scenario, request.moduleType)
    const metric = metricForScenario(scenario)
    const examples = scenarioExamples(scenario)
    const metrics = { [scenario.metricName]: metric }

    return {
      request,
      scenario,
      provider,
      model,
      module,
      metric,
      examples,
      metrics,
      layer,
      demoBudget: Math.max(1, Math.min(request.optimizationBudget, examples.length)),
      startedAt: yield* Clock.currentTimeMillis
    }
  })

type _PrepareResult = typeof prepareExecution extends (arg: DspRunRequest) => infer R ? R : never

export type DspExecutionContext = Effect.Effect.Success<_PrepareResult>

export const runBaseline = (ctx: DspExecutionContext) => runEvaluationPhase({ ctx, phaseId: "baseline" })

export const runOptimization = (ctx: DspExecutionContext) =>
  Effect.gen(function*() {
    const events = yield* Optimizer.bootstrapFewShotStream({
      module: ctx.module,
      trainset: ctx.examples,
      metric: ctx.metric,
      maxRounds: ctx.request.optimizationBudget,
      maxBootstrappedDemos: ctx.demoBudget,
      fallbackLabeledDemoCount: ctx.demoBudget,
      threshold: 1
    }).pipe(Stream.provideLayer(ctx.layer), Stream.runCollect)
    const eventList = [...events]
    const optimizedParams = yield* Ref.get(ctx.module.params)
    const summary = Optimizer.BootstrapEventSummary.summarize(eventList)

    return {
      summary: {
        fallbackUsed: summary.fallbackUsed,
        learnedDemos: optimizedParams.demos.length,
        roundsUsed: summary.roundsUsed,
        traceAcceptedCount: summary.traceAcceptedCount,
        traceRejectedCount: summary.traceRejectedCount
      },
      evidence: {
        events: eventList
      }
    }
  })

export const runOptimizedEval = (ctx: DspExecutionContext) => runEvaluationPhase({ ctx, phaseId: "optimized" })

export const dspExecutionStory = (
  request: DspRunRequest
): Effect.Effect<DspExecutionStory, unknown, DspProviderRuntime> =>
  Effect.gen(function*() {
    const ctx = yield* prepareExecution(request)
    const baseline = yield* runBaseline(ctx)
    const baselineScore = reportScore(ctx.scenario.metricName, baseline.report)
    const optimization = yield* runOptimization(ctx)
    const optimized = yield* runOptimizedEval(ctx)
    const optimizedScore = reportScore(ctx.scenario.metricName, optimized.report)
    const endedAt = yield* Clock.currentTimeMillis

    return {
      request: ctx.request,
      scenario: ctx.scenario,
      provider: ctx.provider,
      model: ctx.model,
      durationMs: endedAt - ctx.startedAt,
      baselineReport: baseline.report,
      baselineEvidence: baseline.evidence,
      optimizedReport: optimized.report,
      optimizedEvidence: optimized.evidence,
      baselineScore,
      optimizedScore,
      optimization: optimization.summary,
      optimizationEvidence: optimization.evidence
    }
  })
