import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option } from "effect"

import { PendingImputationPolicySpiLayer, SamplerSpi, SamplerSpiLayer } from "../../../src/Sampler/index.js"
import * as Sampler from "../../../src/Sampler/index.js"
import { decodeConfig } from "../../../src/Sampler/shared/decodeConfig.js"
import { stateOf } from "../../../src/Study/api/askTell/model.js"
import * as Study from "../../../src/Study/index.js"
import { contextForSuggestion } from "../../../src/Study/runtime/context.js"
import { readStudyState } from "../../../src/Study/runtime/runtimeState.js"
import { asSingleObjective, singleConfigTrace, singleObjective, singleObjectiveSpace } from "./helpers.js"

const tpeOptions = {
  seed: 404,
  nStartupTrials: 4,
  nEiCandidates: 16
}

describe("Study snapshot incremental recovery", () => {
  it.effect("reconstructs canonical next-suggestion parity after snapshot resume", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handle = yield* Study.open({
          space: singleObjectiveSpace,
          sampler: Sampler.tpe(tpeOptions),
          direction: "minimize",
          trials: 7,
          objective: singleObjective
        })

        yield* Effect.forEach(Arr.makeBy(6, () => undefined), () =>
          Effect.gen(function*() {
            const asked = yield* Study.ask(handle)
            const value = yield* singleObjective(asked.config)
            yield* Study.tell(handle, asked.trialNumber, value)
          }), { discard: true })

        const handleState = stateOf(handle)
        const studyState = yield* readStudyState(handleState.runtime)
        const snapshot = yield* Study.snapshot(handle)

        const restoredSampler = Sampler.tpe(tpeOptions)
        yield* restoredSampler.restore(snapshot.samplerCheckpoint)

        const suggestionContext = yield* contextForSuggestion(
          handleState.settings.objectiveSpec,
          studyState,
          handleState.settings.priorWeight,
          handleState.settings.epsilon
        ).pipe(
          Effect.provide(PendingImputationPolicySpiLayer(restoredSampler.pendingImputationPolicy))
        )
        const expectedRawConfig = yield* SamplerSpi.suggest(handleState.optimizePlan.space, suggestionContext).pipe(
          Effect.provide(SamplerSpiLayer(restoredSampler))
        )
        const expectedNextConfig = yield* decodeConfig(
          restoredSampler.kind._tag,
          handleState.optimizePlan.space,
          expectedRawConfig,
          `sampler ${restoredSampler.kind._tag} generated a config that failed search-space decoding`
        )

        const resumedResult = yield* Study.resume({
          space: singleObjectiveSpace,
          sampler: Sampler.tpe(tpeOptions),
          snapshot,
          direction: "minimize",
          trials: 1,
          objective: singleObjective
        })
        const resumedSingle = asSingleObjective(resumedResult)

        expect(Option.isSome(resumedSingle)).toBe(true)

        if (Option.isNone(resumedSingle)) {
          return
        }

        expect(singleConfigTrace(resumedSingle.value).at(-1)).toEqual(expectedNextConfig)
      })
    ))
})
