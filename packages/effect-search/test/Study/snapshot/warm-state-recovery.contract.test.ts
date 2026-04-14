import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Ref } from "effect"

import { pendingAsZeroImputationPolicy } from "../../../src/Sampler/index.js"
import * as Sampler from "../../../src/Sampler/index.js"
import { stateOf } from "../../../src/Study/api/askTell/model.js"
import * as Study from "../../../src/Study/index.js"
import { initializeRuntime, readRuntimeState, StudyClockLayer } from "../../../src/Study/runtime/runtimeState.js"
import { restoreSnapshot } from "../../../src/Study/snapshot/restore.js"
import { singleObjectiveSpace } from "./helpers.js"

const tpeOptions = {
  seed: 1207,
  nStartupTrials: 2,
  nEiCandidates: 8
}

describe("Study snapshot warm-state recovery", () => {
  it.effect("rebuilds best-value, no-improvement, and pending-trial truth from canonical study history", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handle = yield* Study.open({
          space: singleObjectiveSpace,
          sampler: Sampler.tpe(tpeOptions),
          direction: "minimize",
          noImprovementWindow: 2,
          trials: 6,
          objective: () => Effect.succeed(0)
        })

        const first = yield* Study.ask(handle)
        yield* Study.tell(handle, first.trialNumber, 0)

        const second = yield* Study.ask(handle)
        yield* Study.tell(handle, second.trialNumber, 1)

        const third = yield* Study.ask(handle)
        yield* Study.tell(handle, third.trialNumber, 2)

        const pending = yield* Study.ask(handle)
        const snapshot = yield* Study.snapshot(handle)
        const handleState = stateOf(handle)
        const restoredSampler = Sampler.tpe(tpeOptions)

        const seed = yield* restoreSnapshot(
          handleState.optimizePlan.space,
          restoredSampler,
          handleState.settings.objectiveSpec,
          handleState.settings.stopMode,
          snapshot
        )

        const restoredRuntime = yield* initializeRuntime(handleState.settings, seed.initialTrials).pipe(
          Effect.provide(StudyClockLayer)
        )
        const restoredState = yield* readRuntimeState(restoredRuntime)
        const restoredBestValue = yield* Ref.get(restoredRuntime.bestValueRef)
        const restoredNoImprovementCount = yield* Ref.get(restoredRuntime.noImprovementCountRef)
        const restoredContext = restoredState.suggestionState.context(pendingAsZeroImputationPolicy)

        expect(seed.startTrialNumber).toBe(pending.trialNumber + 1)
        expect(restoredBestValue).toEqual(Option.some(0))
        expect(restoredNoImprovementCount).toBe(2)
        expect(restoredState.suggestionState.observedCompleted.map((trial) => trial.trialNumber)).toEqual([
          first.trialNumber,
          second.trialNumber,
          third.trialNumber
        ])
        expect(restoredState.suggestionState.pending.map((trial) => trial.trialNumber)).toEqual([pending.trialNumber])
        expect(restoredContext.pending.map((trial) => trial.trialNumber)).toEqual([pending.trialNumber])
        expect(restoredContext.completed.map((trial) => trial.trialNumber)).toEqual([
          first.trialNumber,
          second.trialNumber,
          third.trialNumber,
          pending.trialNumber
        ])
      })
    ))
})
