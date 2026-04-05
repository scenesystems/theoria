import { Clock, Effect, Match, Option, Ref, Schema, Stream } from "effect"
import * as Arr from "effect/Array"
import * as Record from "effect/Record"

import { Evaluate, Example, Metric, Module, Optimizer, Signature } from "effect-dsp"

import {
  defaultDspModuleType,
  defaultDspScenarioId,
  defaultOptimizationBudget,
  type DspModuleType,
  type DspScenarioDefinition,
  type DspScenarioId,
  scenarioById
} from "../../../contracts/demo/dsp.js"
import type { StreamManifest } from "../../../contracts/stream-manifest.js"

import { DspProviderRuntime, DspProviderUnavailable } from "./provider.js"

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
  manifest !== null && manifest._tag === "effect-dsp"
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

export type DspExecutionStory = {
  readonly request: DspRunRequest
  readonly scenario: DspScenarioDefinition
  readonly provider: string
  readonly model: string
  readonly durationMs: number
  readonly baselineReport: DspEvaluationReport
  readonly optimizedReport: DspEvaluationReport
  readonly baselineScore: number
  readonly optimizedScore: number
  readonly optimization: DspOptimizationSummary
}

// ---------------------------------------------------------------------------
// Progressive execution context — resolved once, shared across phases
// ---------------------------------------------------------------------------

const resolveProvider = Effect.gen(function*() {
  const runtime = yield* DspProviderRuntime

  const layer = yield* Option.match(runtime.layer, {
    onNone: () =>
      Effect.fail(
        new DspProviderUnavailable({
          message: Option.getOrElse(runtime.capability.reason, () => "DSP provider is not configured.")
        })
      ),
    onSome: Effect.succeed
  })

  const provider = yield* Option.match(runtime.capability.provider, {
    onNone: () =>
      Effect.fail(
        new DspProviderUnavailable({
          message: Option.getOrElse(runtime.capability.reason, () => "DSP provider is not configured.")
        })
      ),
    onSome: Effect.succeed
  })

  return {
    layer,
    provider,
    model: Option.getOrElse(runtime.capability.model, () => "unknown")
  }
})

const buildSignatureAndModule = (scenario: DspScenarioDefinition, moduleType: DspModuleType) =>
  Effect.gen(function*() {
    const inputFields = Record.fromEntries(
      Arr.map(scenario.contract.inputFields, (field) => [
        field.name,
        Signature.describe(Schema.String, field.description)
      ])
    )
    const outputFields = Record.fromEntries(
      Arr.map(scenario.contract.outputFields, (field) => [
        field.name,
        Signature.describe(Schema.String, field.description)
      ])
    )
    const signature = yield* Signature.make(scenario.contract.instruction, inputFields, outputFields)

    return yield* Match.value(moduleType).pipe(
      Match.when("chainOfThought", () => Module.chainOfThought(`theoria-${scenario.id}-cot`, signature)),
      Match.orElse(() => Module.predict(`theoria-${scenario.id}-predict`, signature))
    )
  })

const metricForScenario = (scenario: DspScenarioDefinition) =>
  Match.value(scenario.id).pipe(
    Match.when("intervention-classifier", () => Metric.exactMatch("intervention")),
    Match.when("member-check-summary", () => Metric.f1("keyThemes")),
    Match.when("probe-follow-up", () => Metric.exactMatch("probeType")),
    Match.exhaustive
  )

const scenarioExamples = (scenario: DspScenarioDefinition): ReadonlyArray<Example.Example> =>
  Arr.map(scenario.examples, (example) => new Example.Example({ input: example.input, output: example.expected }))

export const reportScore = (metricName: string, report: DspEvaluationReport): number =>
  report.overallScores[metricName] ?? 0

// ---------------------------------------------------------------------------
// Phase 0: Prepare execution context (no LLM calls)
// ---------------------------------------------------------------------------

export const prepareExecution = (request: DspRunRequest) =>
  Effect.gen(function*() {
    const scenario = scenarioById(request.scenarioId)
    const { layer, model, provider } = yield* resolveProvider
    const module = yield* buildSignatureAndModule(scenario, request.moduleType)
    const metric = metricForScenario(scenario)
    const examples = scenarioExamples(scenario)
    const metrics = { [scenario.metricName]: metric }
    const demoBudget = Math.max(1, Math.min(request.optimizationBudget, examples.length))
    const startedAt = yield* Clock.currentTimeMillis

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
      demoBudget,
      startedAt
    }
  })

type _PrepareResult = typeof prepareExecution extends (arg: DspRunRequest) => infer R ? R : never

export type DspExecutionContext = Effect.Effect.Success<_PrepareResult>

// ---------------------------------------------------------------------------
// Phase 1: Baseline evaluation
// ---------------------------------------------------------------------------

export const runBaseline = (ctx: DspExecutionContext) =>
  Evaluate.run({
    module: ctx.module,
    examples: ctx.examples,
    metrics: ctx.metrics,
    concurrency: 1
  }).pipe(Effect.provide(ctx.layer))

// ---------------------------------------------------------------------------
// Phase 2: Optimization
// ---------------------------------------------------------------------------

export const runOptimization = (ctx: DspExecutionContext) =>
  Effect.gen(function*() {
    const bootstrapEvents = yield* Optimizer.bootstrapFewShotStream({
      module: ctx.module,
      trainset: ctx.examples,
      metric: ctx.metric,
      maxRounds: ctx.request.optimizationBudget,
      maxBootstrappedDemos: ctx.demoBudget,
      fallbackLabeledDemoCount: ctx.demoBudget,
      threshold: 1
    }).pipe(
      Stream.provideLayer(ctx.layer),
      Stream.runCollect,
      Effect.map(Arr.fromIterable)
    )
    const optimizedParams = yield* Ref.get(ctx.module.params)
    const bootstrapSummary = Optimizer.summarizeBootstrapEvents(bootstrapEvents)

    return {
      fallbackUsed: bootstrapSummary.fallbackUsed,
      learnedDemos: optimizedParams.demos.length,
      roundsUsed: bootstrapSummary.roundsUsed,
      traceAcceptedCount: bootstrapSummary.traceAcceptedCount,
      traceRejectedCount: bootstrapSummary.traceRejectedCount
    }
  })

// ---------------------------------------------------------------------------
// Phase 3: Optimized evaluation (module already has learned demos)
// ---------------------------------------------------------------------------

export const runOptimizedEval = (ctx: DspExecutionContext) =>
  Evaluate.run({
    module: ctx.module,
    examples: ctx.examples,
    metrics: ctx.metrics,
    concurrency: 1
  }).pipe(Effect.provide(ctx.layer))

// ---------------------------------------------------------------------------
// Monolithic execution story (used by run.ts for non-streaming path)
// ---------------------------------------------------------------------------

export const dspExecutionStory = (
  request: DspRunRequest
): Effect.Effect<DspExecutionStory, unknown, DspProviderRuntime> =>
  Effect.gen(function*() {
    const ctx = yield* prepareExecution(request)
    const baselineReport = yield* runBaseline(ctx)
    const baselineScore = reportScore(ctx.scenario.metricName, baselineReport)
    const optimization = yield* runOptimization(ctx)
    const optimizedReport = yield* runOptimizedEval(ctx)
    const optimizedScore = reportScore(ctx.scenario.metricName, optimizedReport)
    const endedAt = yield* Clock.currentTimeMillis

    return {
      request: ctx.request,
      scenario: ctx.scenario,
      provider: ctx.provider,
      model: ctx.model,
      durationMs: endedAt - ctx.startedAt,
      baselineReport,
      optimizedReport,
      baselineScore,
      optimizedScore,
      optimization
    }
  })
