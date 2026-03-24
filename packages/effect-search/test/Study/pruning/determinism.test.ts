import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"

import { decodeSlotConfig, makeSlotSpace } from "../../../src/experimental/scenarios/slot.js"
import * as Sampler from "../../../src/Sampler/index.js"
import * as Study from "../../../src/Study/index.js"
import type * as Trial from "../../../src/Trial/index.js"

const space = makeSlotSpace(40)

const runOptions = {
  seed: 509,
  nStartupTrials: 6,
  nEiCandidates: 32,
  trials: 24,
  concurrency: 4
}

const asSingleObjective = (result: Study.StudyResult) =>
  result._tag === "SingleObjective" ? Option.some(result) : Option.none()

const encodeConfigTrace = Schema.encodeSync(Schema.parseJson(Schema.Array(space.schema)))

const encodeTrialConfigTrace = (
  trials: ReadonlyArray<Trial.Trial<unknown>>
) => encodeConfigTrace(trials.map((trial) => decodeSlotConfig(trial.config)))

const objective = (raw: unknown, runtime: Study.ObjectiveTrialRuntime) =>
  Effect.gen(function*() {
    const config = decodeSlotConfig(raw)

    yield* runtime.report(0, config.slot)

    return config.slot
  })

const pruningPolicy = new Study.PruningPolicy({
  name: "upper-slot-pruner",
  decide: ({ latestReport }) =>
    latestReport.value >= 24
      ? Study.PruneTrialDecision({
        step: latestReport.step,
        reason: "slot-above-threshold",
        policy: "upper-slot-pruner"
      })
      : Study.ContinuePruneDecision()
})

const optimizeWithPruning = (trials: number) =>
  Study.optimize({
    space,
    sampler: Sampler.tpe({
      seed: runOptions.seed,
      nStartupTrials: runOptions.nStartupTrials,
      nEiCandidates: runOptions.nEiCandidates
    }),
    direction: "minimize",
    trials,
    concurrency: runOptions.concurrency,
    pruningPolicy,
    objective
  })

const traceState = (result: Study.SingleObjectiveResult) =>
  result.trials.map((trial) => ({
    trialNumber: trial.trialNumber,
    state: trial.state._tag,
    ...(trial.state._tag === "Completed" ? { value: trial.state.value } : {}),
    ...(trial.state._tag === "Pruned"
      ? {
        step: trial.state.step,
        reason: trial.state.reason,
        policy: trial.state.policy
      }
      : {})
  }))

const comparableFirstLegSlice = (
  trials: ReadonlyArray<Trial.Trial<unknown>>,
  firstLegTrials: number
) =>
  trials
    .filter((trial) => trial.trialNumber < firstLegTrials)
    .sort((left, right) => left.trialNumber - right.trialNumber)
    .map((trial) => ({
      trialNumber: trial.trialNumber,
      state: trial.state._tag,
      config: trial.config
    }))

describe("constant-liar + pruning determinism", () => {
  it.effect(
    "keeps constant-liar pruning behavior deterministic under bounded concurrency",
    () =>
      Effect.gen(function*() {
        const leftResult = yield* optimizeWithPruning(runOptions.trials)
        const rightResult = yield* optimizeWithPruning(runOptions.trials)

        const leftOption = asSingleObjective(leftResult)
        const rightOption = asSingleObjective(rightResult)
        expect(Option.isSome(leftOption)).toBe(true)
        expect(Option.isSome(rightOption)).toBe(true)

        if (Option.isNone(leftOption) || Option.isNone(rightOption)) {
          return
        }

        const left = leftOption.value
        const right = rightOption.value
        const leftPrunedCount = left.trials.filter((trial) => trial.state._tag === "Pruned").length
        const rightPrunedCount = right.trials.filter((trial) => trial.state._tag === "Pruned").length

        expect(encodeTrialConfigTrace(left.trials)).toBe(encodeTrialConfigTrace(right.trials))
        expect(traceState(left)).toEqual(traceState(right))
        expect(leftPrunedCount).toBeGreaterThan(0)
        expect(rightPrunedCount).toBe(leftPrunedCount)
        expect(left.bestTrial.trialNumber).toBe(right.bestTrial.trialNumber)
        expect(left.bestTrial.state.value).toBe(right.bestTrial.state.value)
      }),
    15_000
  )

  it.effect(
    "preserves prune/report/liar semantics across uninterrupted and resumed runs",
    () =>
      Effect.gen(function*() {
        const totalTrials = runOptions.trials
        const firstLegTrials = 11
        const secondLegTrials = totalTrials - firstLegTrials

        const baselineResult = yield* optimizeWithPruning(totalTrials)
        const firstLegResult = yield* optimizeWithPruning(firstLegTrials)

        const baselineOption = asSingleObjective(baselineResult)
        const firstLegOption = asSingleObjective(firstLegResult)
        expect(Option.isSome(baselineOption)).toBe(true)
        expect(Option.isSome(firstLegOption)).toBe(true)

        if (Option.isNone(baselineOption) || Option.isNone(firstLegOption)) {
          return
        }

        const snapshot = yield* Study.snapshot(firstLegOption.value)
        const resumedResultA = yield* Study.resume({
          space,
          sampler: Sampler.tpe({
            seed: runOptions.seed,
            nStartupTrials: runOptions.nStartupTrials,
            nEiCandidates: runOptions.nEiCandidates
          }),
          snapshot,
          direction: "minimize",
          trials: secondLegTrials,
          concurrency: runOptions.concurrency,
          pruningPolicy,
          objective
        })
        const resumedResultB = yield* Study.resume({
          space,
          sampler: Sampler.tpe({
            seed: runOptions.seed,
            nStartupTrials: runOptions.nStartupTrials,
            nEiCandidates: runOptions.nEiCandidates
          }),
          snapshot,
          direction: "minimize",
          trials: secondLegTrials,
          concurrency: runOptions.concurrency,
          pruningPolicy,
          objective
        })

        const resumedOptionA = asSingleObjective(resumedResultA)
        const resumedOptionB = asSingleObjective(resumedResultB)
        expect(Option.isSome(resumedOptionA)).toBe(true)
        expect(Option.isSome(resumedOptionB)).toBe(true)

        if (Option.isNone(resumedOptionA) || Option.isNone(resumedOptionB)) {
          return
        }

        const baseline = baselineOption.value
        const resumedA = resumedOptionA.value
        const resumedB = resumedOptionB.value
        const firstLegComparable = comparableFirstLegSlice(firstLegOption.value.trials, firstLegTrials)

        expect(firstLegComparable).toHaveLength(firstLegTrials)
        expect(encodeTrialConfigTrace(resumedA.trials)).toBe(encodeTrialConfigTrace(resumedB.trials))
        expect(traceState(resumedA)).toEqual(traceState(resumedB))
        expect(resumedA.bestTrial.trialNumber).toBe(resumedB.bestTrial.trialNumber)
        expect(resumedA.bestTrial.state.value).toBe(resumedB.bestTrial.state.value)

        expect(resumedA.trials).toHaveLength(totalTrials)
        expect(baseline.trials).toHaveLength(totalTrials)
        expect(comparableFirstLegSlice(resumedA.trials, firstLegTrials)).toEqual(firstLegComparable)
        expect(resumedA.completionReason).toBe("budgetExhausted")
        expect(baseline.completionReason).toBe("budgetExhausted")
        expect(resumedA.trials.filter((trial) => trial.state._tag === "Pruned").length).toBeGreaterThan(0)
        expect(baseline.trials.filter((trial) => trial.state._tag === "Pruned").length).toBeGreaterThan(0)
        expect(resumedA.trials.every((trial) => trial.state._tag !== "Running")).toBe(true)
      }),
    20_000
  )
})
