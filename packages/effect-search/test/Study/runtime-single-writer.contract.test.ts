import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Tuple } from "effect"

import * as Sampler from "../../src/Sampler/index.js"
import * as SearchSpace from "../../src/SearchSpace/index.js"
import { stateOf } from "../../src/Study/api/askTell/model.js"
import * as Study from "../../src/Study/index.js"
import { modifyStudyState, readStudyState } from "../../src/Study/runtime/runtimeState.js"
import { maxTrialNumberFromState, trialsFromState, withFinalizedTrial } from "../../src/Study/state.js"
import { isState, Trial } from "../../src/Trial/index.js"

const makeSpace = () =>
  SearchSpace.unsafeMake({
    x: SearchSpace.float(-1, 1)
  })

describe("Study runtime single-writer contract", () => {
  it.effect("serializes concurrent runtime mutations into one canonical trial history", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const mutationCount = 8
        const handle = yield* Study.open({
          space: makeSpace(),
          sampler: Sampler.random({ seed: 2718 }),
          direction: "minimize",
          trials: mutationCount,
          objective: () => Effect.succeed(0)
        })

        const runtime = stateOf(handle).runtime
        const assignedTrialNumbers = yield* Effect.all(
          Arr.makeBy(mutationCount, () =>
            modifyStudyState(runtime, (state) => {
              const trialNumber = maxTrialNumberFromState(state) + 1
              const running = Trial.run(trialNumber, { x: trialNumber / 10 }, 0)
              const completed = Trial.complete(running, trialNumber, 1)
              return Effect.succeed(Tuple.make(trialNumber, withFinalizedTrial(state, completed)))
            })),
          { concurrency: "unbounded" }
        )

        const finalState = yield* readStudyState(runtime)
        const finalTrials = trialsFromState(finalState)

        expect([...assignedTrialNumbers].sort((left: number, right: number) => left - right)).toEqual(
          Arr.makeBy(mutationCount, (index) => index)
        )
        expect(Arr.map(finalTrials, (trial) => trial.trialNumber)).toEqual(
          Arr.makeBy(mutationCount, (index) => index)
        )
        expect(Arr.every(finalTrials, (trial) => isState("Completed")(trial.state))).toBe(true)
      })
    ))
})
