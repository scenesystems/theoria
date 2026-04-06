import { Clock, Effect, Schema } from "effect"
import * as Arr from "effect/Array"

import * as Trial from "../src/Trial/index.js"
import * as Study from "../src/Study/index.js"
import { normalizeSettings, optimizePlanFromOptions } from "../src/Study/options.js"
import { initializeRuntime, StudyClockLayer } from "../src/Study/runtime/runtimeState.js"
import { suggestConfigWithSampler } from "../src/Study/runtime/trialReservation.js"
import { benchmarkSuitePlan } from "./plans.js"
import {
  BenchmarkArtifactJsonSchema,
  BenchmarkArtifactSchema,
  type BenchmarkSuitePlan,
  EngineBenchmarkSampleSchema,
  EngineBenchmarkResultSchema,
  type EngineBenchmarkPlan,
  ObjectiveBenchmarkSampleSchema,
  ObjectiveBenchmarkResultSchema,
  type ObjectiveBenchmarkPlan,
  SamplerBenchmarkSampleSchema,
  SamplerBenchmarkResultSchema,
  type SamplerBenchmarkPlan
} from "./schema.js"
import {
  mixedSpaceBenchmarkObjective,
  mixedSpaceBenchmarkSampler,
  mixedSpaceBenchmarkSpace,
  syntheticMixedSpaceConfig
} from "./problems/mixedSpaceTpe.js"
import { averageMilliseconds, maximumValue, measureMilliseconds, minimumValue } from "./stats.js"
export { validateBenchmarkArtifact } from "./validation.js"

const buildSamplerHarnessState = (historyLength: number, seed: number) =>
  Effect.gen(function*() {
    const sampler = mixedSpaceBenchmarkSampler(seed)
    const optimizePlan = yield* optimizePlanFromOptions({
      space: mixedSpaceBenchmarkSpace,
      sampler,
      direction: "minimize",
      trials: historyLength + 8,
      objective: mixedSpaceBenchmarkObjective
    })
    const settings = normalizeSettings(optimizePlan)
    const initialTrials = yield* Effect.forEach(Arr.makeBy(historyLength, (index) => index), (trialNumber) =>
      Effect.gen(function*() {
        const config = syntheticMixedSpaceConfig(trialNumber)
        const value = yield* mixedSpaceBenchmarkObjective(config)

        return Trial.complete(
          Trial.makeRunning(trialNumber, config, trialNumber),
          value,
          trialNumber + 1
        )
      }))
    const runtime = yield* initializeRuntime(settings, initialTrials).pipe(Effect.provide(StudyClockLayer))

    return { optimizePlan, settings, runtime }
  })

const averageSuggestionDuration = (seed: number, runsPerSeed: number, historyLength: number) =>
  Effect.scoped(
    Effect.gen(function*() {
      const harness = yield* buildSamplerHarnessState(historyLength, seed)
      const durations = yield* Effect.forEach(Arr.makeBy(runsPerSeed, () => undefined), () =>
        measureMilliseconds(
          suggestConfigWithSampler(
            harness.optimizePlan,
            harness.settings,
            harness.runtime,
            harness.optimizePlan.sampler
          )
        ).pipe(Effect.map(({ durationMs }) => durationMs))
      )

      return averageMilliseconds(durations)
    })
  )

const runSamplerSeedBenchmark = (plan: SamplerBenchmarkPlan, seed: number) =>
  Effect.gen(function*() {
    const shortAverageMs = yield* averageSuggestionDuration(seed, plan.runsPerSeed, plan.shortHistoryLength)
    const longAverageMs = yield* averageSuggestionDuration(seed, plan.runsPerSeed, plan.longHistoryLength)

    return yield* Schema.decodeUnknown(SamplerBenchmarkSampleSchema)(
      {
        seed,
        shortAverageMs,
        longAverageMs,
        growthFactor: shortAverageMs === 0 ? 0 : longAverageMs / shortAverageMs
      },
      { onExcessProperty: "error" }
    )
  })

const runAskTellCycle = (handle: Study.StudyHandle<typeof mixedSpaceBenchmarkSpace>) =>
  Effect.gen(function*() {
    const askMeasurement = yield* measureMilliseconds(Study.ask(handle))
    const value = yield* mixedSpaceBenchmarkObjective(askMeasurement.value.config)
    const tellMeasurement = yield* measureMilliseconds(Study.tell(handle, askMeasurement.value.trialNumber, value))

    return {
      askMs: askMeasurement.durationMs,
      tellMs: tellMeasurement.durationMs
    }
  })

const runEnginePhase = (seed: number, measurementCycles: number, historyLength: number) =>
  Effect.scoped(
    Effect.gen(function*() {
      const handle = yield* Study.open({
        space: mixedSpaceBenchmarkSpace,
        sampler: mixedSpaceBenchmarkSampler(seed),
        direction: "minimize",
        trials: historyLength + measurementCycles + 8,
        objective: mixedSpaceBenchmarkObjective
      })

      yield* Effect.forEach(Arr.makeBy(historyLength, () => undefined), () => runAskTellCycle(handle), { discard: true })

      const measurements = yield* Effect.forEach(
        Arr.makeBy(measurementCycles, () => undefined),
        () => runAskTellCycle(handle)
      )
      const snapshot = yield* Study.snapshot(handle)

      return {
        askAverageMs: averageMilliseconds(Arr.map(measurements, ({ askMs }) => askMs)),
        tellAverageMs: averageMilliseconds(Arr.map(measurements, ({ tellMs }) => tellMs)),
        samplerMetrics: snapshot.samplerMetrics
      }
    })
  )

const runEngineSeedBenchmark = (plan: EngineBenchmarkPlan, seed: number) =>
  Effect.gen(function*() {
    const shortPhase = yield* runEnginePhase(seed, plan.measurementCycles, plan.shortHistoryLength)
    const longPhase = yield* runEnginePhase(seed, plan.measurementCycles, plan.longHistoryLength)

    return yield* Schema.decodeUnknown(EngineBenchmarkSampleSchema)(
      {
        seed,
        shortAskAverageMs: shortPhase.askAverageMs,
        longAskAverageMs: longPhase.askAverageMs,
        shortTellAverageMs: shortPhase.tellAverageMs,
        longTellAverageMs: longPhase.tellAverageMs,
        askGrowthFactor: shortPhase.askAverageMs === 0 ? 0 : longPhase.askAverageMs / shortPhase.askAverageMs,
        tellGrowthFactor: shortPhase.tellAverageMs === 0 ? 0 : longPhase.tellAverageMs / shortPhase.tellAverageMs,
        samplerMetrics: longPhase.samplerMetrics
      },
      { onExcessProperty: "error" }
    )
  })

const runObjectiveSeedBenchmark = (plan: ObjectiveBenchmarkPlan, seed: number) =>
  Effect.gen(function*() {
    const measurement = yield* measureMilliseconds(
      Study.optimize({
        space: mixedSpaceBenchmarkSpace,
        sampler: mixedSpaceBenchmarkSampler(seed),
        direction: "minimize",
        trials: plan.trials,
        objective: mixedSpaceBenchmarkObjective
      })
    )
    const snapshot = yield* Study.snapshot(measurement.value)

    return yield* Schema.decodeUnknown(ObjectiveBenchmarkSampleSchema)(
      {
        seed,
        wallClockMs: measurement.durationMs,
        completedTrialCount: snapshot.samplerMetrics.completedCount,
        samplerMetrics: snapshot.samplerMetrics
      },
      { onExcessProperty: "error" }
    )
  })

const firstSample = <A>(samples: ReadonlyArray<A>, timingKind: string) =>
  Effect.sync(() =>
    Arr.match(samples, {
      onEmpty: () => undefined,
      onNonEmpty: (nonEmpty) => Arr.headNonEmpty(nonEmpty)
    })
  ).pipe(
    Effect.flatMap((sample) =>
      sample === undefined ? Effect.die(`${timingKind} benchmark emitted no seeded samples`) : Effect.succeed(sample)
    )
  )

export const runSamplerBenchmark = (plan: SamplerBenchmarkPlan = benchmarkSuitePlan.sampler) =>
  Effect.gen(function*() {
    const samples = yield* Effect.forEach(plan.seeds, (seed) => runSamplerSeedBenchmark(plan, seed))
    const shortAverageMs = averageMilliseconds(Arr.map(samples, ({ shortAverageMs }) => shortAverageMs))
    const longAverageMs = averageMilliseconds(Arr.map(samples, ({ longAverageMs }) => longAverageMs))
    const growthFactor = averageMilliseconds(Arr.map(samples, ({ growthFactor }) => growthFactor))

    return yield* Schema.decodeUnknown(SamplerBenchmarkResultSchema)(
      {
        timingKind: "sampler",
        caseId: plan.caseId,
        seeds: plan.seeds,
        seedCount: plan.seeds.length,
        shortHistoryLength: plan.shortHistoryLength,
        longHistoryLength: plan.longHistoryLength,
        runsPerSeed: plan.runsPerSeed,
        shortAverageMs,
        longAverageMs,
        growthFactor,
        worstLongAverageMs: maximumValue(Arr.map(samples, ({ longAverageMs }) => longAverageMs)),
        worstGrowthFactor: maximumValue(Arr.map(samples, ({ growthFactor }) => growthFactor)),
        maxLongAverageMs: plan.maxLongAverageMs,
        maxGrowthFactor: plan.maxGrowthFactor,
        samples
      },
      { onExcessProperty: "error" }
    )
  })

export const runEngineBenchmark = (plan: EngineBenchmarkPlan = benchmarkSuitePlan.engine) =>
  Effect.gen(function*() {
    const samples = yield* Effect.forEach(plan.seeds, (seed) => runEngineSeedBenchmark(plan, seed))
    const representativeSample = yield* firstSample(samples, "engine")

    return yield* Schema.decodeUnknown(EngineBenchmarkResultSchema)(
      {
        timingKind: "engine",
        caseId: plan.caseId,
        seeds: plan.seeds,
        seedCount: plan.seeds.length,
        shortHistoryLength: plan.shortHistoryLength,
        longHistoryLength: plan.longHistoryLength,
        measurementCycles: plan.measurementCycles,
        shortAskAverageMs: averageMilliseconds(Arr.map(samples, ({ shortAskAverageMs }) => shortAskAverageMs)),
        longAskAverageMs: averageMilliseconds(Arr.map(samples, ({ longAskAverageMs }) => longAskAverageMs)),
        shortTellAverageMs: averageMilliseconds(Arr.map(samples, ({ shortTellAverageMs }) => shortTellAverageMs)),
        longTellAverageMs: averageMilliseconds(Arr.map(samples, ({ longTellAverageMs }) => longTellAverageMs)),
        askGrowthFactor: averageMilliseconds(Arr.map(samples, ({ askGrowthFactor }) => askGrowthFactor)),
        tellGrowthFactor: averageMilliseconds(Arr.map(samples, ({ tellGrowthFactor }) => tellGrowthFactor)),
        worstLongAskAverageMs: maximumValue(Arr.map(samples, ({ longAskAverageMs }) => longAskAverageMs)),
        worstLongTellAverageMs: maximumValue(Arr.map(samples, ({ longTellAverageMs }) => longTellAverageMs)),
        worstAskGrowthFactor: maximumValue(Arr.map(samples, ({ askGrowthFactor }) => askGrowthFactor)),
        worstTellGrowthFactor: maximumValue(Arr.map(samples, ({ tellGrowthFactor }) => tellGrowthFactor)),
        maxLongAskAverageMs: plan.maxLongAskAverageMs,
        maxLongTellAverageMs: plan.maxLongTellAverageMs,
        maxAskGrowthFactor: plan.maxAskGrowthFactor,
        maxTellGrowthFactor: plan.maxTellGrowthFactor,
        samplerMetrics: representativeSample.samplerMetrics,
        samples
      },
      { onExcessProperty: "error" }
    )
  })

export const runObjectiveBenchmark = (plan: ObjectiveBenchmarkPlan = benchmarkSuitePlan.objective) =>
  Effect.gen(function*() {
    const samples = yield* Effect.forEach(plan.seeds, (seed) => runObjectiveSeedBenchmark(plan, seed))
    const representativeSample = yield* firstSample(samples, "objective")

    return yield* Schema.decodeUnknown(ObjectiveBenchmarkResultSchema)(
      {
        timingKind: "objective",
        caseId: plan.caseId,
        seeds: plan.seeds,
        seedCount: plan.seeds.length,
        trials: plan.trials,
        wallClockMs: averageMilliseconds(Arr.map(samples, ({ wallClockMs }) => wallClockMs)),
        worstWallClockMs: maximumValue(Arr.map(samples, ({ wallClockMs }) => wallClockMs)),
        maxWallClockMs: plan.maxWallClockMs,
        completedTrialCount: minimumValue(Arr.map(samples, ({ completedTrialCount }) => completedTrialCount)),
        samplerMetrics: representativeSample.samplerMetrics,
        samples
      },
      { onExcessProperty: "error" }
    )
  })

export const runBenchmarkSuite = (plan: BenchmarkSuitePlan = benchmarkSuitePlan) =>
  Effect.gen(function*() {
    const generatedAtMillis = yield* Clock.currentTimeMillis
    const sampler = yield* runSamplerBenchmark(plan.sampler)
    const engine = yield* runEngineBenchmark(plan.engine)
    const objective = yield* runObjectiveBenchmark(plan.objective)

    return yield* Schema.decodeUnknown(BenchmarkArtifactSchema)(
      {
        suite: "effect-search/benchmark",
        suiteVersion: 2,
        aggregationKind: "mean-of-seeds",
        generatedAtMillis,
        sampler,
        engine,
        objective
      },
      { onExcessProperty: "error" }
    )
  })

export const encodeBenchmarkArtifact = Schema.encode(BenchmarkArtifactJsonSchema)
