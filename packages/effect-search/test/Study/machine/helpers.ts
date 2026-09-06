import { Effect } from "effect"

import * as Sampler from "../../../src/Sampler/index.js"
import * as SearchSpace from "../../../src/SearchSpace/index.js"
import { normalizeSettings } from "../../../src/Study/options.js"

export const makeSpace = () =>
  SearchSpace.make({
    x: SearchSpace.float(-1, 1),
    depth: SearchSpace.int(1, 3)
  })

export const makeSettings = () =>
  Effect.gen(function*() {
    const space = yield* makeSpace()
    return normalizeSettings({
      space,
      sampler: Sampler.random({ seed: 17 }),
      direction: "minimize",
      trials: 3,
      objective: () => Effect.succeed(0)
    })
  })
