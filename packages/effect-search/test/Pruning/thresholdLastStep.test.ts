import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Ref, Schema } from "effect"

import * as Optimization from "../../src/Optimization.js"
import * as Pruning from "../../src/Pruning.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"
import { FixtureRegistryLive, loadFixture, TrialStatesThresholdFixture } from "../helpers/fixtures/index.js"

const loadThreshold = loadFixture("trial-states.threshold-last-step").pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(TrialStatesThresholdFixture)),
  Effect.provide(FixtureRegistryLive)
)

describe("Pruning.threshold uses the maximum reported step", () => {
  it.effect("trial-states.threshold-last-step: matches ThresholdPruner.should_prune after every report", () =>
    Effect.gen(function*() {
      const { payload } = yield* loadThreshold
      const space = yield* SearchSpace.make({ x: SearchSpace.float(0, 1) })
      yield* Effect.forEach(payload.cases, (testCase) =>
        Effect.gen(function*() {
          const decisions = yield* Ref.make(Arr.empty<Pruning.Decision>())
          const result = yield* Optimization.run(
            new Optimization.FlatOptions({
              space,
              sampler: Sampler.random({ seed: 0 }),
              direction: testCase.direction,
              trials: 1,
              pruningPolicy: Pruning.threshold(testCase.limit, testCase.direction, testCase.warmupSteps),
              objective: (_config, runtime: Pruning.Runtime) =>
                Effect.forEach(testCase.reports, (report) =>
                  runtime.report(report.step, report.value).pipe(
                    Effect.flatMap((decision) => Ref.update(decisions, Arr.append(decision)))
                  )).pipe(Effect.as(0.5))
            })
          ).pipe(Effect.result)
          const observed = yield* Ref.get(decisions)
          expect(Arr.map(observed, Pruning.isDecision("Prune")), testCase.id).toEqual(testCase.expectedShouldPrune)
          expect(
            Arr.map(Arr.filter(observed, Pruning.isDecision("Prune")), (decision) => decision.step),
            testCase.id
          ).toEqual(Arr.map(
            Arr.filter(testCase.expectedShouldPrune, (prune) => prune),
            () => testCase.expectedLastStep
          ))
          expect(result._tag, testCase.id).toBe(
            Bool.match(Arr.some(testCase.expectedShouldPrune, (prune) => prune), {
              onFalse: () => "Success",
              onTrue: () => "Failure"
            })
          )
        }))
    }))

  it.effect("decides on the maximum step whatever order the context reports arrive in", () =>
    Effect.sync(() => {
      const decide = Pruning.threshold(1, "minimize").decide
      const early = new Pruning.Report({ step: 2, value: 0.5 })
      const late = new Pruning.Report({ step: 1, value: 1.5 })
      expect(decide(new Pruning.Context({ trialNumber: 0, reports: [late, early], latestReport: late }))._tag)
        .toBe("Continue")
      expect(decide(new Pruning.Context({ trialNumber: 0, reports: [early, late], latestReport: late }))._tag)
        .toBe("Continue")
      expect(decide(new Pruning.Context({ trialNumber: 0, reports: [late, early], latestReport: early }))._tag)
        .toBe("Continue")
    }))
})
