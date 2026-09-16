import { Effect } from "effect"

import { normalizeSettings } from "../../src/internal/study/options/settings.js"
import * as Sampler from "../../src/Sampler.js"
import * as SearchSpace from "../../src/SearchSpace.js"

export const makeStudyMachineSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(-1, 1),
    depth: SearchSpace.int(1, 3)
  })

export const makeStudyMachineSettings = () =>
  Effect.gen(function*() {
    const space = yield* makeStudyMachineSpace()
    return normalizeSettings({
      space,
      sampler: Sampler.random({ seed: 17 }),
      direction: "minimize",
      trials: 3,
      objective: () => Effect.succeed(0)
    })
  })
