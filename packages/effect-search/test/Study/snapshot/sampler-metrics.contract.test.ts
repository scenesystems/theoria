import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import * as Sampler from "../../../src/Sampler/index.js"
import * as Study from "../../../src/Study/index.js"
import { singleObjectiveSpace } from "./helpers.js"

describe("Study snapshot sampler metrics", () => {
  it.effect("captures pending-trial truth in typed snapshot metrics", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const handle = yield* Study.open({
          space: singleObjectiveSpace,
          sampler: Sampler.tpe({ seed: 1207, nStartupTrials: 2, nEiCandidates: 8 }),
          direction: "minimize",
          trials: 4,
          objective: () => Effect.succeed(0)
        })

        const asked = yield* Study.ask(handle)
        const snapshot = yield* Study.snapshot(handle)

        expect(snapshot.nextTrialNumber).toBe(asked.trialNumber + 1)
        expect(snapshot.samplerMetrics.completedCount).toBe(0)
        expect(snapshot.samplerMetrics.pendingCount).toBe(1)
      })
    ))
})
