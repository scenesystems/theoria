import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import { normalizeSettings, optimizePlanFromOptions } from "../../src/Study/options.js"
import { initializeRuntime, StudyClockLayer } from "../../src/Study/runtime/runtimeState.js"
import { suggestConfigWithSampler } from "../../src/Study/runtime/trialReservation.js"
import * as Trial from "../../src/Trial/index.js"
import { makeSpace, singleObjective } from "../Study/snapshot/helpers.js"

const tpeOptions = {
  seed: 2701,
  nStartupTrials: 4,
  nEiCandidates: 4
}

const PERF_RUNS = process.env.CI ? 1 : 2
const SHORT_HISTORY = 6
const LONG_HISTORY = 18
const MAX_GROWTH_FACTOR = process.env.CI ? 6 : 5
const MAX_LONG_AVERAGE_MS = process.env.CI ? 10_000 : 5_000

const syntheticConfig = (
  trialNumber: number
): {
  readonly x: number
  readonly depth: number
  readonly optimizer: "adam" | "sgd"
} => ({
  x: ((trialNumber % 17) / 4) - 2,
  depth: (trialNumber % 5) + 1,
  optimizer: trialNumber % 2 === 0 ? "adam" : "sgd"
})

const buildHarnessState = (historyLength: number) =>
  Effect.gen(function*() {
    const sampler = Sampler.tpe(tpeOptions)
    const optimizePlan = yield* optimizePlanFromOptions({
      space: makeSpace(),
      sampler,
      direction: "minimize",
      trials: historyLength + 4,
      objective: singleObjective
    })
    const settings = normalizeSettings(optimizePlan)

    const initialTrials = yield* Effect.forEach(Arr.makeBy(historyLength, (index) => index), (trialNumber) =>
      Effect.gen(function*() {
        const config = syntheticConfig(trialNumber)
        const value = yield* singleObjective(config)

        return Trial.complete(
          Trial.makeRunning(trialNumber, config, trialNumber),
          value,
          trialNumber + 1
        )
      }))
    const runtime = yield* initializeRuntime(settings, initialTrials).pipe(Effect.provide(StudyClockLayer))

    return { optimizePlan, settings, runtime }
  })

const averageSuggestionDuration = (historyLength: number) =>
  Effect.scoped(
    Effect.gen(function*() {
      const harness = yield* buildHarnessState(historyLength)
      const startedAt = performance.now()

      yield* Effect.forEach(Arr.makeBy(PERF_RUNS, () => undefined), () =>
        suggestConfigWithSampler(
          harness.optimizePlan,
          harness.settings,
          harness.runtime,
          harness.optimizePlan.sampler
        ), { discard: true })

      return (performance.now() - startedAt) / PERF_RUNS
    })
  )

describe("incremental suggestion engine performance guard", () => {
  it.live(
    "keeps post-startup mixed-space TPE suggestion growth within the documented envelope",
    () =>
      Effect.gen(function*() {
        const shortAverageMs = yield* averageSuggestionDuration(SHORT_HISTORY)
        const longAverageMs = yield* averageSuggestionDuration(LONG_HISTORY)

        expect(longAverageMs).toBeLessThan(MAX_LONG_AVERAGE_MS)
        expect(longAverageMs / shortAverageMs).toBeLessThan(MAX_GROWTH_FACTOR)
      }),
    45_000
  )
})
