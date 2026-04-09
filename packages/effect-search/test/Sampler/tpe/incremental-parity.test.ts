import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect } from "effect"

import { PendingImputationPolicySpiLayer, SamplerSpi, SamplerSpiLayer } from "../../../src/Sampler/index.js"
import * as Sampler from "../../../src/Sampler/index.js"
import { decodeConfig } from "../../../src/Sampler/shared/decodeConfig.js"
import { stateOf } from "../../../src/Study/api/askTell/model.js"
import * as Study from "../../../src/Study/index.js"
import { contextForSuggestion } from "../../../src/Study/runtime/context.js"
import { readStudyState } from "../../../src/Study/runtime/runtimeState.js"
import { suggestConfigWithSampler } from "../../../src/Study/runtime/trialReservation.js"
import { singleObjective, singleObjectiveSpace } from "../../Study/snapshot/helpers.js"

const tpeOptions = {
  seed: 313,
  nStartupTrials: 4,
  nEiCandidates: 16
}

describe("Sampler TPE incremental parity", () => {
  it.effect("preserves next-suggestion parity against a full-history rebuild under a fixed checkpoint", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handle = yield* Study.open({
          space: singleObjectiveSpace,
          sampler: Sampler.tpe(tpeOptions),
          direction: "minimize",
          trials: 8,
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
        const checkpoint = yield* handleState.optimizePlan.sampler.checkpoint
        const liveSuggestion = yield* suggestConfigWithSampler(
          handleState.optimizePlan,
          handleState.settings,
          handleState.runtime,
          handleState.optimizePlan.sampler
        )

        const rebuiltSampler = Sampler.tpe(tpeOptions)
        yield* rebuiltSampler.restore(checkpoint)

        const suggestionContext = yield* contextForSuggestion(
          handleState.settings.objectiveSpec,
          studyState,
          handleState.settings.priorWeight,
          handleState.settings.epsilon
        ).pipe(
          Effect.provide(PendingImputationPolicySpiLayer(rebuiltSampler.pendingImputationPolicy))
        )
        const rebuiltRawConfig = yield* SamplerSpi.suggest(handleState.optimizePlan.space, suggestionContext).pipe(
          Effect.provide(SamplerSpiLayer(rebuiltSampler))
        )
        const rebuiltSuggestion = yield* decodeConfig(
          rebuiltSampler.kind._tag,
          handleState.optimizePlan.space,
          rebuiltRawConfig,
          `sampler ${rebuiltSampler.kind._tag} generated a config that failed search-space decoding`
        )

        expect(liveSuggestion).toEqual(rebuiltSuggestion)
      })
    ))
})
